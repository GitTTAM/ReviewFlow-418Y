import mongoose from "mongoose";
const { Schema, model } = mongoose;
const ref = (name, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required });
const options = { timestamps: true, strict: "throw" };

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["hr", "manager", "employee"], required: true },
    passwordHash: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
  },
  options,
);
const formSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 160 },
    description: { type: String, default: "" },
    createdBy: ref("User"),
  },
  options,
);
const questionSchema = new Schema(
  {
    form: ref("ReviewForm"),
    prompt: { type: String, required: true, maxlength: 500 },
    kind: { type: String, enum: ["text", "dropdown"], required: true },
    required: { type: Boolean, default: true },
    options: { type: [String], default: [] },
    position: { type: Number, required: true },
  },
  options,
);
questionSchema.index({ form: 1, position: 1 }, { unique: true });
const reviewSchema = new Schema(
  {
    employee: ref("User"),
    manager: ref("User"),
    form: ref("ReviewForm"),
    status: { type: String, enum: ["Assigned", "In progress", "Completed"], default: "Assigned" },
    discussionConfirmed: { type: Boolean, default: false },
    completedBy: ref("User", false),
    completedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  options,
);
reviewSchema.index(
  { employee: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["Assigned", "In progress"] } },
    name: "one_active_review_per_employee",
  },
);
const answerSchema = new Schema(
  {
    review: ref("Review"),
    question: ref("FormQuestion"),
    value: { type: String, default: "", maxlength: 10000 },
    savedAt: { type: Date, required: true },
  },
  options,
);
answerSchema.index(
  { review: 1, question: 1 },
  { unique: true, name: "one_answer_per_review_question" },
);
const pdfSchema = new Schema(
  {
    review: { ...ref("Review"), unique: true },
    originalName: { type: String, required: true },
    storagePath: { type: String, required: true },
    uploadedBy: ref("User"),
  },
  options,
);

export const User = model("User", userSchema);
export const ReviewForm = model("ReviewForm", formSchema);
export const FormQuestion = model("FormQuestion", questionSchema);
export const Review = model("Review", reviewSchema);
export const ReviewAnswer = model("ReviewAnswer", answerSchema);
export const SignedPDF = model("SignedPDF", pdfSchema);
export const entities = [User, ReviewForm, FormQuestion, Review, ReviewAnswer, SignedPDF];
