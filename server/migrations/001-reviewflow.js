import mongoose from "mongoose";
import { entities, Review } from "../src/models/index.js";
// Forward-only/idempotent: no dropDatabase(), syncIndexes(), or destructive seeding.
export async function migrate() {
  for (const entity of entities) {
    await entity.createCollection();
    await entity.createIndexes();
  }
  await mongoose.connection.db.command({
    collMod: Review.collection.name,
    validator: {
      $and: [
        {
          $jsonSchema: {
            bsonType: "object",
            required: ["employee", "manager", "form", "status", "discussionConfirmed", "version"],
            properties: {
              employee: { bsonType: "objectId" },
              manager: { bsonType: "objectId" },
              form: { bsonType: "objectId" },
              status: { enum: ["Assigned", "In progress", "Completed"] },
              version: { bsonType: ["int", "long", "double"], minimum: 0 },
            },
          },
        },
        { $expr: { $ne: ["$employee", "$manager"] } },
        {
          $or: [
            {
              status: "Completed",
              discussionConfirmed: true,
              completedBy: { $type: "objectId" },
              completedAt: { $type: "date" },
            },
            {
              status: { $in: ["Assigned", "In progress"] },
              discussionConfirmed: false,
              completedBy: null,
              completedAt: null,
            },
          ],
        },
      ],
    },
    validationLevel: "strict",
    validationAction: "error",
  });
  await mongoose.connection.db
    .collection("migrations")
    .updateOne(
      { _id: "001-reviewflow" },
      { $setOnInsert: { appliedAt: new Date() } },
      { upsert: true },
    );
}
