import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ROOT } from "../server/src/config.js";
// The desktop launcher and the manual npm command use the same persistent setup.
export async function startLocalMongo({
  port = 28018,
  directory = path.join(ROOT, ".local", "mongo", "db"),
} = {}) {
  await mkdir(directory, { recursive: true });
  return MongoMemoryReplSet.create({
    binary: { version: "7.0.24", downloadDir: path.join(ROOT, ".local", "mongo-binaries") },
    instanceOpts: [{ port, dbPath: directory, storageEngine: "wiredTiger" }],
    replSet: { name: "reviewflow", count: 1, storageEngine: "wiredTiger" },
  });
}

const runFromTerminal =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (runFromTerminal) {
  const repl = await startLocalMongo();
  console.log("Local MongoDB: mongodb://127.0.0.1:28018/reviewflow?replicaSet=reviewflow");
  console.log("Data persists in .local/mongo/db. Ctrl+C stops MongoDB without clearing data.");
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      await repl.stop({ doCleanup: false });
      process.exit(0);
    });
  }
}
