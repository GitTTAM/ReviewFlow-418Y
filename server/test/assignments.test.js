// Ahmet: extend with real assignment/reassignment and old/new manager tests.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { Review } from "../src/models/index.js";
import { validateAssignment } from "../src/services/assignments.js";
import { startFixture } from "./helpers.js";
let fx;
before(async () => {
  fx = await startFixture();
});
after(async () => {
  if (fx) await fx.stop();
});
test("Ahmet boundary: self-review, duplicate active and completed reassignment rejected", async () => {
  const actor = fx.users["hr@example.test"],
    manager = fx.users["matt.manager@example.test"];
  const args = {
    actor,
    employee: fx.users["jordan.employee@example.test"],
    manager,
    form: fx.form,
  };
  await assert.rejects(validateAssignment(args), /active review/);
  await assert.rejects(validateAssignment({ ...args, employee: manager }), /themselves/);
  const existingReview = await Review.findOne({
    employee: fx.users["casey.employee@example.test"]._id,
  });
  await assert.rejects(
    validateAssignment({
      ...args,
      employee: fx.users["casey.employee@example.test"],
      existingReview,
    }),
    /Completed/,
  );
});
