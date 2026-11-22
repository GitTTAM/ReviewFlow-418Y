import { Router } from "express";
import { Review } from "../models/index.js";
import { assignedReviewFilter, requireRole } from "../permissions.js";

export const dashboardRouter = Router();

// US-04: the account comes from the server session, never from a client-supplied manager ID.
dashboardRouter.get("/", async (req, res) => {
  requireRole(req.user, "manager");

  const reviews = await Review.find(assignedReviewFilter(req.user))
    .select("_id employee form status createdAt")
    .populate("employee", "name")
    .populate("form", "name")
    .sort({ createdAt: 1, _id: 1 });

  res.json({
    reviews: reviews.map((review) => ({
      _id: review._id,
      employeeName: review.employee?.name || "Employee unavailable",
      formName: review.form?.name || "Review form unavailable",
      status: review.status,
    })),
  });
});
