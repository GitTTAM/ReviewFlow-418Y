// Govinda: replace 501 with assignedReviewFilter() query and error handling.
import { Router } from "express";
import { requireRole } from "../permissions.js";
import { AppError } from "../errors.js";
export const dashboardRouter = Router();
dashboardRouter.get("/", (req, res) => {
  requireRole(req.user, "manager");
  throw new AppError(
    501,
    "Assigned-review dashboard pending. Use the working review launcher on Home.",
  );
});
