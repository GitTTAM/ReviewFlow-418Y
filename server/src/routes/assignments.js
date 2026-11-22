// Ahmet: use validateAssignment(), transactions, and version increments.
import { Router } from "express";
import { Review, ReviewForm, User } from "../models/index.js";
import { requireRole } from "../permissions.js";
import { AppError } from "../errors.js";
export const assignmentsRouter = Router();
assignmentsRouter.use((req, res, next) => {
  requireRole(req.user, "hr");
  next();
});
assignmentsRouter.get("/", async (req, res) =>
  res.json({
    reviews: await Review.find().populate("employee manager", "name").populate("form", "name"),
    users: await User.find().select("name role active"),
    forms: await ReviewForm.find(),
  }),
);
assignmentsRouter.post(["/", "/:id"], (req, res) => {
  throw new AppError(501, "Assignment write controls are not implemented. No records changed.");
});
