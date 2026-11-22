// Tasfiah: extend with successful create/edit and atomic-failure HTTP tests.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { validateFormDefinition } from "../src/services/formDefinitions.js";
import { startFixture } from "./helpers.js";
let fx;
before(async () => {
  fx = await startFixture();
});
after(async () => {
  if (fx) await fx.stop();
});
test("Tasfiah boundary: missing name/questions, invalid dropdown and in-use edit rejected", async () => {
  const args = {
    actor: fx.users["hr@example.test"],
    name: "New form",
    questions: [{ prompt: "Feedback", kind: "text" }],
  };
  for (const changes of [
    { name: "" },
    { questions: [] },
    { existingFormId: fx.form._id },
    { questions: [{ prompt: "Choice", kind: "dropdown", options: [] }] },
  ])
    await assert.rejects(validateFormDefinition({ ...args, ...changes }));
  await validateFormDefinition({ ...args, existingFormId: fx.unused._id });
});
