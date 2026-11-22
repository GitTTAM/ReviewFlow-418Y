import mongoose from "mongoose";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ROOT } from "../src/config.js";
import { createApp } from "../src/app.js";
import { migrate } from "../migrations/001-reviewflow.js";
import { seedDemoData } from "../src/demoData.js";
const db = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24", downloadDir: path.join(ROOT, ".local", "mongo-binaries") },
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
await mongoose.connect(db.getUri(), { autoIndex: false });
await migrate();
await seedDemoData();
const server = createApp({ secret: "isolated-browser-test-secret" }).listen(5051, "127.0.0.1", () =>
  console.log("Browser test API http://127.0.0.1:5051"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await mongoose.disconnect();
      await db.stop();
      process.exit(0);
    }),
  );
