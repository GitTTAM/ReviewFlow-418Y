// Windows launcher checks use their own ports and database directory.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const windowsOnly = { skip: process.platform !== "win32", timeout: 180000 };

async function powershell(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(root, "devkit", script),
        ...args,
      ],
      { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Launcher timed out: ${output}`));
    }, 150000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    // Windows background helpers can inherit pipe handles. Wait for the actual
    // PowerShell exit, then close our readers instead of waiting for EOF forever.
    child.on("exit", (code) => {
      clearTimeout(timer);
      setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        resolve({ code, output });
      }, 50);
    });
  });
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("launcher preflight checks prerequisites without starting services", windowsOnly, async () => {
  const result = await powershell("start_platform.ps1", ["-PreflightOnly", "-NoWait"]);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Preflight passed/);
});

test(
  "launcher starts once, preserves a draft across stop/restart, and cleanup is idempotent",
  windowsOnly,
  async () => {
    const port = await freePort(),
      databasePort = await freePort();
    const runtime = await fs.mkdtemp(path.join(root, ".local", "launcher-test-"));
    const args = [
      "-NoWait",
      "-Port",
      String(port),
      "-DatabasePort",
      String(databasePort),
      "-RuntimeDirectory",
      runtime,
    ];
    let cookie = "",
      csrf = "";
    async function api(method, route, body) {
      const response = await fetch(`http://127.0.0.1:${port}/api${route}`, {
        method,
        headers: { Cookie: cookie, "X-CSRF-Token": csrf, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const newCookie = response.headers.get("set-cookie");
      if (newCookie) cookie = newCookie.split(";")[0];
      const data = await response.json();
      if (data.csrfToken) csrf = data.csrfToken;
      assert.equal(response.status, 200, JSON.stringify(data));
      return data;
    }
    async function signIn() {
      await api("GET", "/auth/session");
      await api("POST", "/auth/login", {
        email: "matt.manager@example.test",
        password: "ReviewFlow!2026",
      });
    }
    try {
      const started = await powershell("start_platform.ps1", [...args, "-NoBrowser"]);
      assert.equal(started.code, 0, started.output);
      const firstState = JSON.parse(await fs.readFile(path.join(runtime, "state.json"), "utf8"));
      await signIn();
      const { review } = await api("GET", "/workspace");
      const detail = await api("GET", `/reviews/${review._id}`);
      const answers = Object.fromEntries(
        detail.questions.map((question) => [
          question._id,
          question.kind === "dropdown"
            ? "Meets expectations"
            : "Draft kept across desktop restart.",
        ]),
      );
      await api("POST", `/reviews/${review._id}/save`, {
        answers,
        version: review.version,
        action: "draft",
      });

      const repeated = await powershell("start_platform.ps1", [...args, "-NoBrowser"]);
      assert.equal(repeated.code, 0, repeated.output);
      assert.match(repeated.output, /already running/);
      const sameState = JSON.parse(await fs.readFile(path.join(runtime, "state.json"), "utf8"));
      assert.equal(sameState.launcherPid, firstState.launcherPid);

      const preview = await powershell("clear_platform_ports.ps1", [...args, "-WhatIf"]);
      assert.equal(preview.code, 0, preview.output);
      await api("GET", "/workspace");
      const stopped = await powershell("clear_platform_ports.ps1", args);
      assert.equal(stopped.code, 0, stopped.output);
      await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`));

      const restarted = await powershell("start_platform.ps1", [...args, "-NoBrowser"]);
      assert.equal(restarted.code, 0, restarted.output);
      cookie = "";
      csrf = "";
      await signIn();
      const reopened = await api("GET", `/reviews/${review._id}`);
      assert.deepEqual(reopened.answers, answers);
      assert.equal(reopened.review.status, "In progress");
      assert.equal(reopened.review.version, 1);
    } finally {
      const stopped = await powershell("clear_platform_ports.ps1", args);
      assert.equal(stopped.code, 0, stopped.output);
      const repeated = await powershell("clear_platform_ports.ps1", args);
      assert.equal(repeated.code, 0, repeated.output);
    }
  },
);

test("launcher and cleanup leave unrelated listeners running", windowsOnly, async () => {
  const stranger = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Another app", workspaceId: "another-folder" }));
  });
  await new Promise((resolve) => stranger.listen(0, "127.0.0.1", resolve));
  const port = stranger.address().port,
    databasePort = await freePort();
  const runtime = await fs.mkdtemp(path.join(root, ".local", "launcher-conflict-"));
  const args = [
    "-NoWait",
    "-Port",
    String(port),
    "-DatabasePort",
    String(databasePort),
    "-RuntimeDirectory",
    runtime,
  ];
  try {
    const started = await powershell("start_platform.ps1", [...args, "-NoBrowser"]);
    assert.equal(started.code, 1, started.output);
    assert.match(started.output, /Nothing was stopped/);
    const cleared = await powershell("clear_platform_ports.ps1", args);
    assert.equal(cleared.code, 1, cleared.output);
    assert.match(cleared.output, /left running/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
  } finally {
    stranger.closeAllConnections();
    await new Promise((resolve) => stranger.close(resolve));
  }
});
