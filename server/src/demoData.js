import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./config.js";
import { FormQuestion, Review, ReviewAnswer, ReviewForm, SignedPDF, User } from "./models/index.js";
export const DEMO_PASSWORD = "ReviewFlow!2026";
export const DEMO_ACCOUNTS = [
  ["matt.manager@example.test", "Matt Demo", "manager"],
  ["riley.manager@example.test", "Riley Demo", "manager"],
  ["empty.manager@example.test", "Morgan Demo", "manager"],
  ["hr@example.test", "Harper Demo", "hr"],
  ["jordan.employee@example.test", "Jordan Demo", "employee"],
  ["casey.employee@example.test", "Casey Demo", "employee"],
  ["taylor.employee@example.test", "Taylor Demo", "employee"],
  ["jamie.employee@example.test", "Jamie Demo", "employee"],
];
export function samplePDF() {
  const text = "BT /F1 14 Tf 50 740 Td (FICTIONAL DEMO - NOT A REAL SIGNATURE) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = pdf.length;
  pdf +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  return Buffer.from(pdf + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
}
export async function seedDemoData() {
  let result;
  // Stage a fixed fictional sample; does not overwrite any user-uploaded bytes.
  const directory = path.join(ROOT, ".local", "media");
  await mkdir(directory, { recursive: true });
  const pdfPath = path.join(directory, "fictional-sample.pdf");
  try {
    await writeFile(pdfPath, samplePDF(), { flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  await mongoose.connection.transaction(async (session) => {
    const users = {};
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    for (const [email, name, role] of DEMO_ACCOUNTS)
      users[email] = await User.findOneAndUpdate(
        { email },
        { $setOnInsert: { email, name, role, passwordHash, active: true } },
        { upsert: true, new: true, session },
      );
    const hr = users["hr@example.test"],
      matt = users["matt.manager@example.test"],
      riley = users["riley.manager@example.test"];
    let form = await ReviewForm.findOne({ name: "Team growth review", createdBy: hr._id }).session(
      session,
    );
    if (!form) {
      [form] = await ReviewForm.create(
        [
          {
            name: "Team growth review",
            description: "Reflect on impact, collaboration, and the next development goal.",
            createdBy: hr._id,
          },
        ],
        { session },
      );
      await FormQuestion.create(
        [
          {
            form: form._id,
            prompt: "What went well this review period?",
            kind: "text",
            required: true,
            position: 1,
          },
          {
            form: form._id,
            prompt: "How would you rate collaboration?",
            kind: "dropdown",
            options: ["Developing", "Meets expectations", "Exceeds expectations"],
            required: true,
            position: 2,
          },
          {
            form: form._id,
            prompt: "What is the next development goal?",
            kind: "text",
            required: true,
            position: 3,
          },
          {
            form: form._id,
            prompt: "Any additional context?",
            kind: "text",
            required: false,
            position: 4,
          },
        ],
        { session, ordered: true },
      );
    }
    let unused = await ReviewForm.findOne({
      name: "Unused practice form",
      createdBy: hr._id,
    }).session(session);
    if (!unused) {
      [unused] = await ReviewForm.create([{ name: "Unused practice form", createdBy: hr._id }], {
        session,
      });
      await FormQuestion.create(
        [
          {
            form: unused._id,
            prompt: "Practice feedback",
            kind: "text",
            required: true,
            position: 1,
          },
        ],
        { session },
      );
    }
    const questions = await FormQuestion.find({ form: form._id })
      .sort({ position: 1 })
      .session(session);
    for (const [email, manager, completed, pdf] of [
      ["jordan.employee@example.test", matt, false, false],
      ["jamie.employee@example.test", riley, false, false],
      ["casey.employee@example.test", riley, true, false],
      ["taylor.employee@example.test", riley, true, true],
      ["matt.manager@example.test", riley, true, false],
    ]) {
      let review = await Review.findOne({ employee: users[email]._id, form: form._id }).session(
        session,
      );
      if (!review) {
        [review] = await Review.create(
          [
            {
              employee: users[email]._id,
              manager: manager._id,
              form: form._id,
              status: completed ? "Completed" : "Assigned",
              completedBy: completed ? manager._id : null,
              completedAt: completed ? new Date() : null,
              discussionConfirmed: completed,
            },
          ],
          { session },
        );
        for (const q of completed ? questions : email.startsWith("jordan") ? [questions[0]] : [])
          await ReviewAnswer.create(
            [
              {
                review: review._id,
                question: q._id,
                value: completed
                  ? q.kind === "dropdown"
                    ? "Meets expectations"
                    : "Fictional completed feedback for the demo."
                  : "Initial saved note: Jordan documented the handoff clearly.",
                savedAt: new Date(),
              },
            ],
            { session },
          );
        if (pdf)
          await SignedPDF.create(
            [
              {
                review: review._id,
                originalName: "fictional-signed-review.pdf",
                storagePath: pdfPath,
                uploadedBy: hr._id,
              },
            ],
            { session },
          );
      }
      if (email.startsWith("jordan")) result = { review, users, form, unused, questions };
    }
  });
  return result;
}
