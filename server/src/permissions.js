import { AppError, assert } from "./errors.js";
export const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);
export function requireRole(user, ...roles) {
  assert(
    user && user.active && roles.includes(user.role),
    403,
    "This page is not available for your role.",
  );
}
export function visibleReviewFilter(user) {
  if (user.role === "hr") return {};
  const ownFinal = { employee: user._id, status: "Completed" };
  return user.role === "manager" ? { $or: [{ manager: user._id }, ownFinal] } : ownFinal;
}
export function requireRead(user, review) {
  assert(
    user.role === "hr" ||
      (user.role === "manager" && sameId(review.manager, user)) ||
      (sameId(review.employee, user) && review.status === "Completed"),
    403,
    "You cannot open this review.",
  );
}
export function requireEdit(user, review) {
  requireRole(user, "manager");
  assert(sameId(review.manager, user), 403, "Only the assigned manager can change this review.");
  assert(
    review.status !== "Completed",
    403,
    "Completed reviews are locked. Answers cannot be changed.",
  );
}
export function assignedReviewFilter(user) {
  requireRole(user, "manager");
  return { manager: user._id };
}
export function employeeResultFilter(user) {
  requireRole(user, "employee", "manager");
  return { employee: user._id, status: "Completed" };
}
export function requirePDFRead(user, review) {
  requireRead(user, review);
  assert(review.status === "Completed", 403, "PDFs are available only after completion.");
}
