import mongoose from "mongoose";
import { MONGO_URI } from "./config.js";
import { safeDatabaseError } from "./databaseSettings.js";
export async function connectDatabase(uri = MONGO_URI) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid")
      throw new Error(
        "ReviewFlow requires a MongoDB replica set for atomic saves. Use Atlas or npm run db.",
      );
  } catch (error) {
    // Drop the original error object: it may contain a credential-bearing URI.
    throw new Error(safeDatabaseError(error, uri));
  }
}
