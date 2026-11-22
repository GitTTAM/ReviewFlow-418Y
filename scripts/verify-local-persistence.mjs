// Explicit local smoke check. Capture modifies only Jordan's fictional draft.
import mongoose from "mongoose";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../server/src/config.js";
import { connectDatabase } from "../server/src/db.js";
import { FormQuestion, Review, ReviewAnswer, User } from "../server/src/models/index.js";
import { saveReview } from "../server/src/services/reviewWorkflow.js";
try {
  await connectDatabase();
  const employee = await User.findOne({ email: "jordan.employee@example.test" }),
    actor = await User.findOne({ email: "matt.manager@example.test" });
  let review = await Review.findOne({ employee: employee._id });
  const file = path.join(ROOT, ".local", "persistence-snapshot.json");
  if (process.argv[2] === "capture") {
    const questions = await FormQuestion.find({ form: review.form }).sort({ position: 1 });
    const current = await ReviewAnswer.find({ review: review._id });
    const answers = Object.fromEntries(
      questions.map((q) => [
        String(q._id),
        current.find((a) => String(a.question) === String(q._id))?.value || "",
      ]),
    );
    answers[String(questions[0]._id)] = "Persistence smoke: survives a full local MongoDB restart.";
    await saveReview({
      actor,
      reviewId: String(review._id),
      answers,
      version: review.version,
      action: "draft",
    });
  } else if (process.argv[2] !== "check") throw new Error("Use capture or check.");
  review = await Review.findById(review._id).lean();
  const answers = await ReviewAnswer.find({ review: review._id }).sort({ question: 1 }).lean();
  const data = JSON.stringify({ review, answers });
  if (process.argv[2] === "capture") {
    await writeFile(file, data);
    console.log("Captured saved draft. Stop and restart app + npm run db, then run check.");
  } else {
    if (data !== (await readFile(file, "utf8"))) throw new Error("Persistence snapshot differs.");
    console.log("PASS: saved draft unchanged after restart.");
  }
} finally {
  await mongoose.disconnect();
}
