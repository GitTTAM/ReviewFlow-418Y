// Run once with Matt's database setup account, never on teammates' normal Start.
import "dotenv/config";
import mongoose from "mongoose";
import { databaseSettings, safeDatabaseError } from "../src/databaseSettings.js";
import { connectDatabase } from "../src/db.js";
import { migrate } from "../migrations/001-reviewflow.js";
import { User } from "../src/models/index.js";

try {
  const settings = databaseSettings();
  if (settings.mode !== "shared") {
    throw new Error("Shared setup needs an Atlas MONGO_URI and REVIEWFLOW_DATABASE_MODE=shared.");
  }
  await connectDatabase(settings.uri);
  await migrate();
  if (process.argv.includes("--seed-demo") && (await User.countDocuments()) === 0) {
    const { seedDemoData } = await import("../src/demoData.js");
    await seedDemoData();
    console.log("Fictional team demo accounts added to the empty shared database.");
  }
  console.log("Shared database setup finished. Existing work kept.");
} catch (error) {
  console.error(safeDatabaseError(error));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
