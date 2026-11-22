// Tasfiah: replace POST scaffolds with atomic create/edit handlers.
import { Router } from "express";
import { FormQuestion, Review, ReviewForm } from "../models/index.js";
import { requireRole } from "../permissions.js";
import { AppError } from "../errors.js";
export const formsRouter = Router();
formsRouter.use((req, res, next) => {
  requireRole(req.user, "hr");
  next();
});
formsRouter.get("/", async (req, res) => {
  const forms = await ReviewForm.find().lean();
  for (const form of forms) {
    form.questions = await FormQuestion.find({ form: form._id }).sort({ position: 1 });
    form.inUse = Boolean(await Review.exists({ form: form._id }));
  }
  res.json({ forms });
});
formsRouter.post(["/", "/:id"], (req, res) => {
  throw new AppError(501, "Form write controls are not implemented. No records changed.");
});
