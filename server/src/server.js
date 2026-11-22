import mongoose from "mongoose";
import { connectDatabase } from "./db.js";
import { createApp } from "./app.js";
import { PORT } from "./config.js";
try {
  await connectDatabase();
  if (!(await mongoose.connection.db.collection("migrations").findOne({ _id: "001-reviewflow" })))
    throw new Error("Run npm run migrate before startup.");
  const server = createApp().listen(PORT, "127.0.0.1", () =>
    console.log(`ReviewFlow: http://127.0.0.1:${PORT}`),
  );
  let stopping = false;
  function stop() {
    if (stopping) return;
    stopping = true;
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    server.closeIdleConnections();
  }
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
  // Only the parent desktop supervisor can send this IPC message.
  process.on("message", (message) => {
    if (message?.type === "reviewflow:stop") stop();
  });
} catch (error) {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
}
