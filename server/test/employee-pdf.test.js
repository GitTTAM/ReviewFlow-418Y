// Lucille: extend with successful upload/download, private files and rollback.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { Review } from "../src/models/index.js";
import { validatePDFUpload } from "../src/services/pdfs.js";
import { startFixture, Session } from "./helpers.js";
let fx;
before(async () => {
  fx = await startFixture();
});
after(async () => {
  if (fx) await fx.stop();
});
test("Lucille boundary: empty/no-PDF/sample-PDF fixtures and authorized download scaffold", async () => {
  const client = new Session(fx);
  await client.login("jordan.employee@example.test");
  assert.equal((await client.request("GET", "/employee/results")).reviews.length, 0);
  const taylor = await Review.findOne({ employee: fx.users["taylor.employee@example.test"]._id });
  await client.request("GET", `/reviews/${taylor._id}/pdf`, undefined, 403);
  await client.login("taylor.employee@example.test");
  await client.request("GET", `/reviews/${taylor._id}/pdf`, undefined, 501);
  const casey = await Review.findOne({ employee: fx.users["casey.employee@example.test"]._id });
  await assert.rejects(
    validatePDFUpload({
      actor: fx.users["hr@example.test"],
      review: casey,
      filename: "fake.pdf",
      buffer: Buffer.from("not a PDF"),
    }),
    /valid PDF/,
  );
  await assert.rejects(
    validatePDFUpload({
      actor: fx.users["hr@example.test"],
      review: fx.review,
      filename: "demo.pdf",
      buffer: Buffer.from("%PDF-demo"),
    }),
    /Complete/,
  );
});
