// Lucille: employee list + private PDF handlers live together here.
import { Router } from "express";
import { Review, SignedPDF } from "../models/index.js";
import { employeeResultFilter, requirePDFRead, requireRole } from "../permissions.js";
import { getReviewForUser } from "../services/reviewQueries.js";
import { AppError, assert } from "../errors.js";
export const employeeRouter = Router(),
  pdfRouter = Router();
employeeRouter.get("/results", async (req, res) =>
  res.json({
    reviews: await Review.find(employeeResultFilter(req.user))
      .sort({ completedAt: -1 })
      .populate("form", "name")
      .populate("completedBy", "name"),
  }),
);
pdfRouter.get("/:id/pdf", async (req, res) => {
  const review = await getReviewForUser(req.user, req.params.id);
  requirePDFRead(req.user, review);
  assert(await SignedPDF.exists({ review: review._id }), 404, "No signed PDF attached.");
  throw new AppError(501, "Authorized PDF download is Lucille's remaining task.");
});
pdfRouter.post("/:id/pdf", async (req, res) => {
  requireRole(req.user, "hr");
  const review = await getReviewForUser(req.user, req.params.id);
  assert(review.status === "Completed", 400, "Complete the review before uploading a PDF.");
  throw new AppError(501, "PDF upload is Lucille's remaining task. No file changed.");
});
