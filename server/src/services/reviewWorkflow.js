import mongoose from "mongoose";
import { FormQuestion, Review, ReviewAnswer } from "../models/index.js";
import { AppError, assert, validId } from "../errors.js";
import { requireEdit } from "../permissions.js";

export function validateAnswers(questions, answers, complete, discussionConfirmed) {
  const fields = {};
  assert(
    answers && typeof answers === "object" && !Array.isArray(answers),
    400,
    "Send answers for this form.",
  );
  const keys = questions.map((q) => String(q._id));
  assert(
    Object.keys(answers).length === keys.length &&
      Object.keys(answers).every((k) => keys.includes(k)),
    400,
    "Answers must match this form's questions. Reload the review.",
  );
  const cleaned = {};
  for (const q of questions) {
    const key = String(q._id),
      value = answers[key];
    if (typeof value !== "string" || value.length > 10000)
      fields[key] = `${q.prompt}: enter text of 10,000 characters or fewer.`;
    else {
      cleaned[key] = value.trim();
      if (value.trim() && q.kind === "dropdown" && !q.options.includes(value.trim()))
        fields[key] = `${q.prompt}: select one of the listed options.`;
      else if (complete && q.required && !value.trim())
        fields[key] = `${q.prompt}: this answer is required.`;
    }
  }
  if (complete && discussionConfirmed !== true)
    fields.discussionConfirmed = "Confirm the employee discussion before completing.";
  if (Object.keys(fields).length)
    throw new AppError(
      400,
      "Review not saved. Correct the issues below; your other entries remain.",
      fields,
    );
  return cleaned;
}

// Test dependency injection stays in createApp options; no HTTP failure switch exists.
export async function saveReview(
  { actor, reviewId, answers, version, action, discussionConfirmed },
  hooks = {},
) {
  assert(validId(reviewId), 400, "Invalid review ID.");
  assert(["draft", "complete"].includes(action), 400, "Choose Save draft or Complete review.");
  assert(
    Number.isSafeInteger(version) && version >= 0,
    400,
    "Reload the saved review before trying again.",
  );
  let result;
  await mongoose.connection.transaction(
    async (session) => {
      const review = await Review.findById(reviewId).session(session);
      assert(review, 404, "Review not found.");
      requireEdit(actor, review);
      const questions = await FormQuestion.find({ form: review.form })
        .sort({ position: 1 })
        .session(session);
      const complete = action === "complete";
      const cleaned = validateAnswers(questions, answers, complete, discussionConfirmed);
      const reserved = await Review.updateOne(
        {
          _id: reviewId,
          version,
          manager: actor._id,
          status: { $in: ["Assigned", "In progress"] },
        },
        { $inc: { version: 1 } },
        { session },
      );
      assert(
        reserved.modifiedCount === 1,
        409,
        "This review changed in another tab or assignment. Your entries remain here; reopen the saved version before retrying.",
      );
      const now = new Date();
      for (const [question, value] of Object.entries(cleaned)) {
        await ReviewAnswer.updateOne(
          { review: reviewId, question },
          { $set: { value, savedAt: now } },
          { upsert: true, session, runValidators: true },
        );
        await hooks.afterAnswerWrite?.();
      }
      const final = {
        status: complete ? "Completed" : "In progress",
        discussionConfirmed: complete,
        completedBy: complete ? actor._id : null,
        completedAt: complete ? now : null,
      };
      await Review.updateOne({ _id: reviewId }, { $set: final }, { session, runValidators: true });
      await hooks.beforeCommit?.();
      result = { ...final, _id: reviewId, version: version + 1 };
    },
    { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
  );
  return result;
}
