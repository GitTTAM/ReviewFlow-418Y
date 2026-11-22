import mongoose from "mongoose";
import { connectDatabase } from "../src/db.js";
import { seedDemoData } from "../src/demoData.js";
import { entities } from "../src/models/index.js";
// Deletes only the six entity collections + sessions in local reviewflow database.
try {
  if (!process.argv.includes("--yes-delete-local-data"))
    throw new Error(
      "Destructive reset requires --yes-delete-local-data. All local reviews, users and sessions will be erased. Stop the app first.",
    );
  await connectDatabase();
  const hosts = mongoose.connection.getClient().options.hosts;
  if (
    mongoose.connection.name !== "reviewflow" ||
    !hosts.every((h) => ["127.0.0.1", "localhost"].includes(h.host))
  )
    throw new Error("Reset refused: only loopback database named reviewflow is permitted.");
  for (const entity of entities) await entity.deleteMany({});
  await mongoose.connection.db.collection("sessions").deleteMany({});
  const { review } = await seedDemoData();
  console.log(`Local demo reset. Matt's review: /reviews/${review._id}/edit`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
