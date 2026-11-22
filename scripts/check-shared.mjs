// Read-only connection check. This never seeds, migrates, or resets the database.
import "dotenv/config";
import mongoose from "mongoose";
import { databaseSettings, safeDatabaseError } from "../server/src/databaseSettings.js";

let client;
let uri;

try {
  const settings = databaseSettings();
  uri = settings.uri;
  if (settings.mode !== "shared") {
    throw new Error(
      "This checkout uses the local demo. Put your private Atlas block in .env, then try again.",
    );
  }

  client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  await client.connect();
  const database = client.db();
  await database.command({ ping: 1 });
  const migration = await database.collection("migrations").findOne({ _id: "001-reviewflow" });
  if (!migration) {
    throw new Error("The shared database needs its first setup. Ask me before changing it.");
  }

  const [users, reviews] = await Promise.all([
    database.collection("users").countDocuments(),
    database.collection("reviews").countDocuments(),
  ]);
  console.log("PASS: connected to shared database reviewflow_team; migration is present.");
  console.log(`Current data: ${users} app accounts, ${reviews} reviews.`);
  console.log("No database records changed. Next, use Start Platform and try saving a draft.");
} catch (error) {
  console.error(`Shared database check failed: ${safeDatabaseError(error, uri)}`);
  process.exitCode = 1;
} finally {
  if (client) await client.close();
}
