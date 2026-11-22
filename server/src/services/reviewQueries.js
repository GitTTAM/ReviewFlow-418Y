import { Review } from "../models/index.js";
import { assert, validId } from "../errors.js";
import { requireRead } from "../permissions.js";
export async function getReviewForUser(user, id) {
  assert(validId(id), 400, "Invalid review ID.");
  const review = await Review.findById(id)
    .populate("employee manager completedBy", "name email role")
    .populate("form");
  assert(review, 404, "Review not found.");
  requireRead(user, review);
  return review;
}
