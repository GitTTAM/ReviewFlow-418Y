import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdir, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ROOT } from "../server/src/config.js";

// An interrupted folder copy can leave collection files without their metadata.
// Refuse that folder before MongoDB writes to it. Starting normally never resets data.
export async function checkDatabaseFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const hasDatabaseFiles = entries.some(
    (name) => name.endsWith(".wt") || name.startsWith("WiredTiger") || name === "storage.bson",
  );
  if (!hasDatabaseFiles) return;

  let metadata;
  try {
    metadata = await stat(path.join(directory, "WiredTiger.wt"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!metadata?.isFile() || metadata.size === 0) {
    throw new Error(
      `The local database is incomplete: WiredTiger.wt is missing or empty. ` +
        `Existing files were left untouched in ${directory}. ` +
        "To use new fictional demo data, run start_fresh_demo.bat; it keeps the old folder as a backup. " +
        "To keep your saved reviews, restore an intact database backup instead.",
    );
  }
}

// The desktop launcher and the manual npm command use the same persistent setup.
export async function startLocalMongo({
  port = 28018,
  directory = path.join(ROOT, ".local", "mongo", "db"),
} = {}) {
  await checkDatabaseFiles(directory);
  await mkdir(directory, { recursive: true });
  try {
    return await MongoMemoryReplSet.create({
      binary: { version: "7.0.24", downloadDir: path.join(ROOT, ".local", "mongo-binaries") },
      instanceOpts: [{ port, dbPath: directory, storageEngine: "wiredTiger" }],
      replSet: { name: "reviewflow", count: 1, storageEngine: "wiredTiger" },
    });
  } catch (error) {
    throw new Error(
      `MongoDB could not start: ${error.message} ` +
        `The database folder was kept at ${directory}. ` +
        "If you only need new fictional demo data, use start_fresh_demo.bat to back up this folder and start fresh. " +
        "Otherwise keep the folder and check .local/platform/error.log before changing anything.",
      { cause: error },
    );
  }
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
