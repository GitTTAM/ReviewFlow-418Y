import mongoose from "mongoose";
import { connectDatabase } from "../src/db.js";
import { seedDemoData } from "../src/demoData.js";
try {
  await connectDatabase();
  if (!(await mongoose.connection.db.collection("migrations").findOne({ _id: "001-reviewflow" })))
    throw new Error("Run npm run migrate first.");
  const { review } = await seedDemoData();
  console.log(
    `Fictional data ready; existing answers and passwords preserved. Matt's review: /reviews/${review._id}/edit`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
