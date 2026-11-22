import { Review } from "../models/index.js";
import { assert } from "../errors.js";
import { requireRole } from "../permissions.js";
// Tasfiah: call inside the transaction that writes the complete form definition.
export async function validateFormDefinition({ actor, name, questions, existingFormId, session }) {
  requireRole(actor, "hr");
  if (existingFormId)
    assert(
      !(await Review.exists({ form: existingFormId }).session(session || null)),
      409,
      "This form is already in use. Create a new form instead.",
    );
  assert(
    typeof name === "string" && name.trim() && name.length <= 160,
    400,
    "Enter a form name of 160 characters or fewer.",
  );
  assert(Array.isArray(questions) && questions.length > 0, 400, "Add at least one question.");
  for (const q of questions) {
    assert(
      typeof q.prompt === "string" && q.prompt.trim() && q.prompt.length <= 500,
      400,
      "Every question needs text of 500 characters or fewer.",
    );
    assert(
      ["text", "dropdown"].includes(q.kind),
      400,
      "Choose text or dropdown for every question.",
    );
    if (q.kind === "dropdown")
      assert(
        Array.isArray(q.options) &&
          q.options.length > 0 &&
          q.options.every((v) => typeof v === "string" && v.trim()) &&
          new Set(q.options).size === q.options.length,
        400,
        "Dropdown questions need distinct nonempty options.",
      );
  }
}
