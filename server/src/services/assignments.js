import { FormQuestion, Review } from "../models/index.js";
import { assert } from "../errors.js";
import { requireRole, sameId } from "../permissions.js";
// Ahmet: call inside your write transaction; increment Review.version on reassign.
export async function validateAssignment({
  actor,
  employee,
  manager,
  form,
  existingReview,
  session,
}) {
  requireRole(actor, "hr");
  assert(employee && manager && form, 400, "Choose an employee, a manager, and a form.");
  assert(!sameId(employee, manager), 400, "A manager cannot review themselves.");
  assert(
    employee.active &&
      ["employee", "manager"].includes(employee.role) &&
      manager.active &&
      manager.role === "manager",
    400,
    "Choose an active employee and an active manager.",
  );
  assert(
    await FormQuestion.exists({ form: form._id }).session(session || null),
    400,
    "The form needs questions before assignment.",
  );
  if (existingReview) {
    assert(existingReview.status !== "Completed", 409, "Completed reviews cannot be reassigned.");
    assert(
      sameId(existingReview.employee, employee) && sameId(existingReview.form, form),
      400,
      "Reassignment changes only the manager.",
    );
  }
  const filter = { employee: employee._id, status: { $in: ["Assigned", "In progress"] } };
  if (existingReview) filter._id = { $ne: existingReview._id };
  assert(
    !(await Review.exists(filter).session(session || null)),
    409,
    "This employee already has an active review.",
  );
}
