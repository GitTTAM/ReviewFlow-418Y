import mongoose from "mongoose";
import { MONGO_URI } from "./config.js";
export async function connectDatabase(uri = MONGO_URI) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "ReviewFlow requires a MongoDB replica set for atomic saves. Run npm run db first.",
    );
}
