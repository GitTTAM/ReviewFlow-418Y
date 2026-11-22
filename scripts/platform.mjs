// Hidden desktop supervisor. PowerShell handles the visible startup progress.
// Stop requests are local files tied to one run, never an unauthenticated API route.
import "dotenv/config";
import { fork } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const port = Number(args.get("--port") || 5050);
const databasePort = Number(args.get("--db-port") || 28018);
const defaultRuntime = path.join(root, ".local", "platform");
const runtime = path.resolve(args.get("--runtime") || defaultRuntime);
if (!runtime.startsWith(root)) throw new Error("Runtime must be inside this ReviewFlow folder.");
const databaseDirectory = path.join(
  runtime === defaultRuntime ? path.join(root, ".local") : runtime,
  "mongo",
  "db",
);
fs.mkdirSync(runtime, { recursive: true });

const stateFile = path.join(runtime, "state.json");
const lockFile = path.join(runtime, "supervisor.lock");
const stopFile = path.join(runtime, "stop-request.json");
const state = {
  instanceId: randomUUID(),
  workspaceId: createHash("sha256").update(root.toLowerCase()).digest("hex").slice(0, 16),
  launcherPid: process.pid,
  appPid: null,
  startedAt: new Date().toISOString(),
  port,
  databasePort,
  databaseDirectory,
  status: "starting",
  stage: "Preparing ReviewFlow...",
};
let mongo,
  mongoose,
  app,
  timer,
  stopping = false,
  ownsLock = false;

function updateState(status, stage) {
  Object.assign(state, { status, stage });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(stage);
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function finish(error) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  if (error) console.error(error.stack || error.message);
  if (app && app.exitCode === null) {
    if (app.connected) app.send({ type: "reviewflow:stop" });
    await Promise.race([once(app, "exit"), new Promise((resolve) => setTimeout(resolve, 8000))]);
    if (app.exitCode === null) app.kill();
  }
  if (mongoose) await mongoose.disconnect();
  if (mongo) await mongo.stop({ doCleanup: false });
  if (ownsLock) {
    updateState(
      error ? "error" : "stopped",
      error ? error.message : "ReviewFlow stopped. Saved data kept.",
    );
    fs.unlinkSync(lockFile);
  }
  process.exit(error ? 1 : 0);
}

function portIsOpen(number) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: number });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

async function run() {
  if (fs.existsSync(lockFile)) {
    const previous = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    if (processIsRunning(previous.pid))
      throw new Error("A ReviewFlow supervisor is already running.");
    fs.unlinkSync(lockFile);
  }
  fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid }), { flag: "wx" });
  ownsLock = true;
  updateState("starting", "Starting the local database...");
  const defaultURI = "mongodb://127.0.0.1:28018/reviewflow?replicaSet=reviewflow";
  if (process.env.MONGO_URI && process.env.MONGO_URI !== defaultURI) {
    throw new Error(
      "The one-click launcher uses the local demo database. Use the README's manual commands for a custom MONGO_URI.",
    );
  }
  process.env.MONGO_URI = `mongodb://127.0.0.1:${databasePort}/reviewflow?replicaSet=reviewflow`;
  process.env.PORT = String(port);

  // Imports happen after the local ports are chosen, before config.js reads them.
  const { startLocalMongo } = await import("./local-mongo.mjs");
  const alreadyRunning = await portIsOpen(databasePort);
  if (!alreadyRunning)
    mongo = await startLocalMongo({ port: databasePort, directory: databaseDirectory });
  mongoose = (await import("mongoose")).default;
  const { connectDatabase } = await import("../server/src/db.js");
  await connectDatabase();
  if (alreadyRunning) {
    const options = await mongoose.connection.db.admin().command({ getCmdLineOpts: 1 });
    const existingPath = options.parsed?.storage?.dbPath;
    if (
      !existingPath ||
      path.resolve(existingPath).toLowerCase() !== databaseDirectory.toLowerCase()
    ) {
      throw new Error(
        `Database port ${databasePort} belongs to another folder. Nothing was stopped.`,
      );
    }
  }

  updateState("starting", "Checking the database setup...");
  const { migrate } = await import("../server/migrations/001-reviewflow.js");
  await migrate();
  const { User } = await import("../server/src/models/index.js");
  if ((await User.countDocuments()) === 0) {
    updateState("starting", "Adding the first set of fictional demo accounts...");
    const { seedDemoData } = await import("../server/src/demoData.js");
    await seedDemoData();
  }
  await mongoose.disconnect();

  updateState("starting", "Starting the app...");
  app = fork(path.join(root, "server", "src", "server.js"), [], {
    cwd: root,
    env: process.env,
    windowsHide: true,
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  state.appPid = app.pid;
  app.on("error", (error) => finish(error));
  app.on("exit", (code) => {
    if (!stopping) finish(new Error(`ReviewFlow app exited (${code}). See error.log.`));
  });
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      const health = await response.json();
      if (health.workspaceId === state.workspaceId) {
        updateState("ready", `ReviewFlow is ready at http://127.0.0.1:${port}`);
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The app did not become ready. Check error.log.");
}

timer = setInterval(() => {
  try {
    if (fs.existsSync(stopFile)) {
      const request = JSON.parse(fs.readFileSync(stopFile, "utf8"));
      if (request.instanceId === state.instanceId) finish();
    }
  } catch {
    /* A request may still be writing; read it again on the next tick. */
  }
}, 500);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => finish());
run().catch((error) => finish(error));
