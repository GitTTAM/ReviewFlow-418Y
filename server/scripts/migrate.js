import mongoose from "mongoose";
import { connectDatabase } from "../src/db.js";
import { migrate } from "../migrations/001-reviewflow.js";
try {
  await connectDatabase();
  await migrate();
  console.log("Migration 001-reviewflow applied; existing work preserved.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
