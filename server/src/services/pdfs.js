import { SignedPDF } from "../models/index.js";
import { assert } from "../errors.js";
import { requireRole } from "../permissions.js";
// Lucille: persist bytes + record safely, removing staged files on failure.
export async function validatePDFUpload({ actor, review, filename, buffer }) {
  requireRole(actor, "hr");
  assert(review.status === "Completed", 400, "Complete the review before adding a PDF.");
  assert(
    !(await SignedPDF.exists({ review: review._id })),
    409,
    "This review already has a signed PDF.",
  );
  assert(
    typeof filename === "string" &&
      filename.toLowerCase().endsWith(".pdf") &&
      Buffer.isBuffer(buffer) &&
      buffer.subarray(0, 5).toString() === "%PDF-",
    400,
    "Choose a valid PDF file.",
  );
  assert(buffer.length <= 10 * 1024 * 1024, 400, "Choose a PDF smaller than 10 MB.");
}
