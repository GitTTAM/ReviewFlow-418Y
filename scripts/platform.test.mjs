// Windows launcher checks use their own ports and database directory.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkDatabaseFiles, startLocalMongo } from "./local-mongo.mjs";
import mongoose from "mongoose";
import { LOCAL_DATABASE_URI } from "../server/src/databaseSettings.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const windowsOnly = { skip: process.platform !== "win32", timeout: 180000 };
await fs.mkdir(path.join(root, ".local"), { recursive: true });

async function powershell(script, args = [], extraEnv = {}) {
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
      {
        cwd: root,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          REVIEWFLOW_DATABASE_MODE: "local",
          MONGO_URI: LOCAL_DATABASE_URI,
          ...extraEnv,
        },
      },
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

async function runNode(script, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, script), ...args], {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Node helper timed out: ${output}`));
    }, 60000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

function browserSession(port) {
  let cookie = "",
    csrf = "";
  return async (method, route, body) => {
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
  };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("database check accepts a new folder and refuses missing metadata without changing files", async () => {
  const runtime = await fs.mkdtemp(path.join(root, ".local", "database-check-"));
  const directory = path.join(runtime, "db");
  await checkDatabaseFiles(directory);
  await fs.mkdir(directory);
  await checkDatabaseFiles(directory);
  await fs.writeFile(path.join(directory, "collection-1.wt"), "Saved review marker");
  await assert.rejects(startLocalMongo({ directory }), /WiredTiger.wt is missing or empty/);
  assert.deepEqual(await fs.readdir(directory), ["collection-1.wt"]);
  assert.equal(
    await fs.readFile(path.join(directory, "collection-1.wt"), "utf8"),
    "Saved review marker",
  );
  await fs.writeFile(path.join(directory, "WiredTiger.wt"), "");
  await assert.rejects(checkDatabaseFiles(directory), /WiredTiger.wt is missing or empty/);
});

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
    const databaseDirectory = path.join(runtime, "mongo", "db");
    await fs.mkdir(databaseDirectory, { recursive: true });
    await fs.writeFile(path.join(databaseDirectory, "collection-1.wt"), "Keep this data");
    const started = await powershell("start_platform.ps1", [...args, "-NoBrowser"]);
    assert.equal(started.code, 1, started.output);
    assert.match(started.output, /Nothing was stopped/);
    const cleared = await powershell("clear_platform_ports.ps1", args);
    assert.equal(cleared.code, 1, cleared.output);
    assert.match(cleared.output, /left running/);
    const fresh = await powershell("start_fresh_demo.ps1", [
      ...args,
      "-NoBrowser",
      "-YesUseFreshDemo",
    ]);
    assert.equal(fresh.code, 1, fresh.output);
    assert.match(fresh.output, /No database folder was moved/);
    assert.equal(
      await fs.readFile(path.join(databaseDirectory, "collection-1.wt"), "utf8"),
      "Keep this data",
    );
    assert.deepEqual(await fs.readdir(path.join(runtime, "mongo")), ["db"]);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
  } finally {
    stranger.closeAllConnections();
    await new Promise((resolve) => stranger.close(resolve));
  }
});

test(
  "incomplete database stays untouched until an explicit fresh demo backs it up and starts",
  windowsOnly,
  async () => {
    const port = await freePort(),
      databasePort = await freePort();
    const runtime = await fs.mkdtemp(path.join(root, ".local", "launcher recovery test "));
    const directory = path.join(runtime, "mongo", "db");
    const recovery = path.join(runtime, "mongo", "db-recovery");
    await fs.mkdir(directory, { recursive: true });
    await fs.mkdir(recovery);
    const originals = {
      "collection-1.wt": "Original saved data, not a working MongoDB database",
      "WiredTiger.turtle": "Original metadata marker",
    };
    for (const [name, content] of Object.entries(originals)) {
      await fs.writeFile(path.join(directory, name), content);
    }
    await fs.writeFile(path.join(recovery, "repair-attempt.txt"), "Keep the earlier recovery copy");
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
      assert.match(started.output, /WiredTiger.wt is missing or empty/);
      assert.match(started.output, /start_fresh_demo.bat/);
      assert.deepEqual((await fs.readdir(directory)).sort(), Object.keys(originals).sort());

      const refused = await powershell("start_fresh_demo.ps1", [...args, "-NoBrowser"]);
      assert.equal(refused.code, 1, refused.output);
      assert.match(refused.output, /No files moved/);
      assert.deepEqual((await fs.readdir(directory)).sort(), Object.keys(originals).sort());

      const fresh = await powershell("start_fresh_demo.ps1", [
        ...args,
        "-NoBrowser",
        "-YesUseFreshDemo",
      ]);
      assert.equal(fresh.code, 0, fresh.output);
      assert.match(fresh.output, /Previous database kept at/);
      const backups = (await fs.readdir(path.join(runtime, "mongo"))).filter((name) =>
        name.startsWith("db-backup-"),
      );
      assert.equal(backups.length, 1);
      const backup = path.join(runtime, "mongo", backups[0]);
      assert.deepEqual((await fs.readdir(backup)).sort(), Object.keys(originals).sort());
      for (const [name, content] of Object.entries(originals)) {
        assert.equal(await fs.readFile(path.join(backup, name), "utf8"), content);
      }
      assert.equal(
        await fs.readFile(path.join(recovery, "repair-attempt.txt"), "utf8"),
        "Keep the earlier recovery copy",
      );
      assert.ok((await fs.stat(path.join(directory, "WiredTiger.wt"))).size > 0);

      const session = await fetch(`http://127.0.0.1:${port}/api/auth/session`);
      const { csrfToken } = await session.json();
      const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: "POST",
        headers: {
          Cookie: session.headers.get("set-cookie").split(";")[0],
          "X-CSRF-Token": csrfToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "matt.manager@example.test", password: "ReviewFlow!2026" }),
      });
      assert.equal(login.status, 200, await login.text());
    } finally {
      const stopped = await powershell("clear_platform_ports.ps1", args);
      assert.equal(stopped.code, 0, stopped.output);
    }
  },
);

test("fresh demo refuses junction paths and leaves their targets alone", windowsOnly, async () => {
  const runtime = await fs.mkdtemp(path.join(root, ".local", "launcher-junction-"));
  const target = await fs.mkdtemp(path.join(root, ".local", "junction-target-"));
  await fs.mkdir(path.join(target, "db"));
  await fs.writeFile(path.join(target, "db", "keep.txt"), "Do not move");
  await fs.symlink(target, path.join(runtime, "mongo"), "junction");
  const fresh = await powershell("start_fresh_demo.ps1", [
    "-NoWait",
    "-NoBrowser",
    "-YesUseFreshDemo",
    "-RuntimeDirectory",
    runtime,
  ]);
  assert.equal(fresh.code, 1, fresh.output);
  assert.match(fresh.output, /without junctions or symlinks/);
  assert.equal(await fs.readFile(path.join(target, "db", "keep.txt"), "utf8"), "Do not move");
  assert.deepEqual(await fs.readdir(target), ["db"]);

  const brokenRuntime = await fs.mkdtemp(path.join(root, ".local", "launcher-broken-junction-"));
  await fs.symlink(
    path.join(target, "missing-target"),
    path.join(brokenRuntime, "mongo"),
    "junction",
  );
  const broken = await powershell("start_fresh_demo.ps1", [
    "-NoWait",
    "-NoBrowser",
    "-YesUseFreshDemo",
    "-RuntimeDirectory",
    brokenRuntime,
  ]);
  assert.equal(broken.code, 1, broken.output);
  assert.match(broken.output, /without junctions or symlinks/);
  assert.deepEqual(await fs.readdir(target), ["db"]);
});

test(
  "fresh demo refuses a database used by a manually started MongoDB on a different port",
  windowsOnly,
  async () => {
    const runtime = await fs.mkdtemp(path.join(root, ".local", "launcher-manual-db-"));
    const directory = path.join(runtime, "mongo", "db");
    const mongo = await startLocalMongo({ directory, port: await freePort() });
    try {
      const fresh = await powershell("start_fresh_demo.ps1", [
        "-NoWait",
        "-NoBrowser",
        "-YesUseFreshDemo",
        "-RuntimeDirectory",
        runtime,
        "-Port",
        String(await freePort()),
        "-DatabasePort",
        String(await freePort()),
      ]);
      assert.equal(fresh.code, 1, fresh.output);
      assert.match(fresh.output, /still in use by MongoDB/);
      assert.deepEqual(await fs.readdir(path.join(runtime, "mongo")), ["db"]);
      assert.ok((await fs.stat(path.join(directory, "WiredTiger.wt"))).size > 0);
    } finally {
      await mongo.stop({ doCleanup: false });
    }
  },
);

test(
  "two shared launchers see the same saved draft and stop without touching the database",
  windowsOnly,
  async () => {
    const runtimeA = await fs.mkdtemp(path.join(root, ".local", "shared-app-a-"));
    const runtimeB = await fs.mkdtemp(path.join(root, ".local", "shared-app-b-"));
    const databaseRuntime = await fs.mkdtemp(path.join(root, ".local", "shared-database-"));
    const mongo = await startLocalMongo({
      port: await freePort(),
      directory: path.join(databaseRuntime, "db"),
    });
    const env = { REVIEWFLOW_DATABASE_MODE: "shared", MONGO_URI: mongo.getUri("reviewflow_team") };
    const stranger = http.createServer((request, response) =>
      response.end("Keep this unrelated service online"),
    );
    await new Promise((resolve) => stranger.listen(0, "127.0.0.1", resolve));
    const portA = await freePort(),
      portB = await freePort();
    const args = (runtime, port) => [
      "-NoWait",
      "-NoBrowser",
      "-Port",
      String(port),
      "-DatabasePort",
      String(stranger.address().port),
      "-RuntimeDirectory",
      runtime,
    ];
    const clearArgs = (runtime, port) => args(runtime, port).filter((arg) => arg !== "-NoBrowser");
    const apiA = browserSession(portA),
      apiB = browserSession(portB);
    const inspector = new mongoose.mongo.MongoClient(env.MONGO_URI);
    try {
      await inspector.connect();
      const beforeSetup = await powershell("start_platform.ps1", args(runtimeA, portA), env);
      assert.equal(beforeSetup.code, 1, beforeSetup.output);
      assert.match(beforeSetup.output, /needs its first setup/);
      assert.equal(await inspector.db().collection("users").countDocuments(), 0);

      const setup = await runNode("server/scripts/setup-shared.js", ["--seed-demo"], env);
      assert.equal(setup.code, 0, setup.output);
      for (const [runtime, port] of [
        [runtimeA, portA],
        [runtimeB, portB],
      ]) {
        const started = await powershell("start_platform.ps1", args(runtime, port), env);
        assert.equal(started.code, 0, started.output);
        const state = JSON.parse(await fs.readFile(path.join(runtime, "state.json"), "utf8"));
        assert.equal(state.databaseMode, "shared");
        assert.equal(state.databasePort, null);
        assert.equal(state.databaseDirectory, null);
        assert.equal(JSON.stringify(state).includes(env.MONGO_URI), false);
        await assert.rejects(fs.stat(path.join(runtime, "mongo")), { code: "ENOENT" });
      }
      for (const api of [apiA, apiB]) {
        await api("GET", "/auth/session");
        await api("POST", "/auth/login", {
          email: "matt.manager@example.test",
          password: "ReviewFlow!2026",
        });
      }
      const { review } = await apiA("GET", "/workspace");
      const detail = await apiA("GET", `/reviews/${review._id}`);
      const answers = Object.fromEntries(
        detail.questions.map((question) => [
          question._id,
          question.kind === "dropdown"
            ? "Meets expectations"
            : "Saved through the first shared app.",
        ]),
      );
      await apiA("POST", `/reviews/${review._id}/save`, {
        answers,
        version: review.version,
        action: "draft",
      });
      assert.deepEqual((await apiB("GET", `/reviews/${review._id}`)).answers, answers);

      const setupAgain = await runNode("server/scripts/setup-shared.js", ["--seed-demo"], env);
      assert.equal(setupAgain.code, 0, setupAgain.output);
      assert.deepEqual((await apiB("GET", `/reviews/${review._id}`)).answers, answers);
      const reset = await runNode("server/scripts/reset-demo.js", ["--yes-delete-local-data"], env);
      assert.equal(reset.code, 1, reset.output);
      assert.match(reset.output, /Reset refused/);

      const localMarker = path.join(runtimeA, "mongo", "db");
      await fs.mkdir(localMarker, { recursive: true });
      await fs.writeFile(
        path.join(localMarker, "keep.txt"),
        "Keep the separate local database too",
      );
      const fresh = await powershell(
        "start_fresh_demo.ps1",
        [...args(runtimeA, portA), "-YesUseFreshDemo"],
        env,
      );
      assert.equal(fresh.code, 1, fresh.output);
      assert.match(fresh.output, /Fresh demo is only for the local database/);
      assert.equal(
        await fs.readFile(path.join(localMarker, "keep.txt"), "utf8"),
        "Keep the separate local database too",
      );
      assert.deepEqual(await fs.readdir(path.join(runtimeA, "mongo")), ["db"]);

      const stopped = await powershell("clear_platform_ports.ps1", clearArgs(runtimeA, portA), env);
      assert.equal(stopped.code, 0, stopped.output);
      assert.match(stopped.output, /shared database stays online/);
      assert.deepEqual((await apiB("GET", `/reviews/${review._id}`)).answers, answers);
      assert.equal((await fetch(`http://127.0.0.1:${stranger.address().port}`)).status, 200);
    } finally {
      for (const [runtime, port] of [
        [runtimeA, portA],
        [runtimeB, portB],
      ]) {
        const stopped = await powershell("clear_platform_ports.ps1", clearArgs(runtime, port), env);
        assert.equal(stopped.code, 0, stopped.output);
      }
      stranger.closeAllConnections();
      await new Promise((resolve) => stranger.close(resolve));
      await inspector.close();
      await mongo.stop({ doCleanup: false });
    }
  },
);

test(
  "a failed shared connection shows a private error and never falls back to local MongoDB",
  windowsOnly,
  async () => {
    const runtime = await fs.mkdtemp(path.join(root, ".local", "shared-unavailable-"));
    const fakePassword = "fake-unavailable-test-password";
    const uri = `mongodb://demo:${fakePassword}@127.0.0.1:${await freePort()}/reviewflow_team`;
    const result = await runNode(
      "scripts/platform.mjs",
      [
        "--runtime",
        runtime,
        "--port",
        String(await freePort()),
        "--db-port",
        String(await freePort()),
      ],
      { REVIEWFLOW_DATABASE_MODE: "shared", MONGO_URI: uri },
    );
    assert.equal(result.code, 1, result.output);
    const state = JSON.parse(await fs.readFile(path.join(runtime, "state.json"), "utf8"));
    assert.equal(state.status, "error");
    assert.equal(state.databaseMode, "shared");
    for (const output of [JSON.stringify(state), result.output]) {
      assert.equal(output.includes(fakePassword), false);
      assert.equal(output.includes(uri), false);
    }
    await assert.rejects(fs.stat(path.join(runtime, "mongo")), { code: "ENOENT" });
  },
);
