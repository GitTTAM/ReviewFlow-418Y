import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import bcrypt from "bcryptjs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import mongoose from "mongoose";
import { ROOT, WORKSPACE_ID, sessionSecret } from "./config.js";
import { AppError, assert, validId } from "./errors.js";
import { FormQuestion, Review, ReviewAnswer, SignedPDF, User } from "./models/index.js";
import { assignedReviewFilter } from "./permissions.js";
import { saveReview } from "./services/reviewWorkflow.js";
import { getReviewForUser } from "./services/reviewQueries.js";
import { formsRouter } from "./routes/forms.js";
import { assignmentsRouter } from "./routes/assignments.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { employeeRouter, pdfRouter } from "./routes/employee.js";

const publicUser = (u) =>
  u ? { _id: u._id, name: u.name, email: u.email, role: u.role, active: u.active } : null;
const saveSession = (req) =>
  new Promise((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())));
const regenerate = (req) =>
  new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
const destroy = (req) =>
  new Promise((resolve, reject) => req.session.destroy((e) => (e ? reject(e) : resolve())));
const newToken = () => randomBytes(24).toString("hex");

export function createApp({
  now = () => Date.now(),
  workflowHooks = {},
  secret = sessionSecret(),
  store,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    next();
  });
  app.get("/api/health", (req, res) =>
    res.json({ message: "ReviewFlow API running", workspaceId: WORKSPACE_ID }),
  );
  app.use("/api", express.json({ limit: "256kb" }));
  app.use(
    "/api",
    session({
      name: "reviewflow.sid",
      secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store:
        store ||
        MongoStore.create({
          client: mongoose.connection.getClient(),
          dbName: mongoose.connection.name,
          collectionName: "sessions",
          ttl: 900,
        }),
      cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 900000,
      },
    }),
  );
  app.use("/api", async (req, res, next) => {
    if (req.session.userId) {
      if (now() - (req.session.lastActivity || 0) >= 900000) {
        await destroy(req);
        res.clearCookie("reviewflow.sid");
        throw new AppError(401, "Signed out after 15 minutes of inactivity. Sign in again.");
      }
      req.user = await User.findById(req.session.userId);
      if (!req.user?.active) {
        await destroy(req);
        throw new AppError(401, "Sign in again.");
      }
      req.session.lastActivity = now();
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const token = req.get("X-CSRF-Token");
      const saved = req.session.csrfToken;
      assert(
        typeof token === "string" &&
          typeof saved === "string" &&
          token.length === saved.length &&
          timingSafeEqual(Buffer.from(token), Buffer.from(saved)),
        403,
        "Session check failed. Reload this page before trying again.",
      );
      assert(req.is("application/json"), 415, "Send JSON data.");
    }
    next();
  });
  app.get("/api/auth/session", (req, res) => {
    req.session.csrfToken ||= newToken();
    res.json({ user: publicUser(req.user), csrfToken: req.session.csrfToken });
  });
  const attempts = new Map();
  app.post("/api/auth/login", async (req, res) => {
    const record = attempts.get(req.ip) || { at: now(), count: 0 };
    if (now() - record.at > 60000) {
      record.at = now();
      record.count = 0;
    }
    record.count++;
    attempts.set(req.ip, record);
    assert(record.count <= 30, 429, "Too many sign-in attempts. Wait one minute and try again.");
    const { email, password } = req.body || {};
    assert(
      typeof email === "string" &&
        typeof password === "string" &&
        email.length <= 254 &&
        password.length <= 256,
      400,
      "Enter your email and password.",
    );
    const user = await User.findOne({ email: email.trim().toLowerCase(), active: true }).select(
      "+passwordHash",
    );
    const match = user && (await bcrypt.compare(password, user.passwordHash));
    assert(match, 401, "Email or password incorrect. Try again.");
    await regenerate(req);
    req.session.userId = String(user._id);
    req.session.lastActivity = now();
    req.session.csrfToken = newToken();
    await saveSession(req);
    res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
  });
  app.use("/api", (req, res, next) => {
    assert(req.user, 401, "Sign in to continue.");
    next();
  });
  app.post("/api/auth/logout", async (req, res) => {
    await destroy(req);
    res.clearCookie("reviewflow.sid");
    res.json({ message: "Signed out." });
  });
  app.get("/api/workspace", async (req, res) => {
    let review = null;
    if (req.user.role === "manager")
      review = await Review.findOne({
        ...assignedReviewFilter(req.user),
        status: { $ne: "Completed" },
      })
        .sort({ createdAt: 1 })
        .populate("employee", "name")
        .populate("form", "name");
    res.json({ review });
  });
  app.use("/api/hr/forms", formsRouter);
  app.use("/api/hr/assignments", assignmentsRouter);
  app.use("/api/manager/reviews", dashboardRouter);
  app.use("/api/employee", employeeRouter);
  app.use("/api/reviews", pdfRouter);
  app.param("id", (req, res, next, id) => {
    assert(validId(id), 400, "Invalid record ID.");
    next();
  });
  app.get("/api/reviews/:id", async (req, res) => {
    const review = await getReviewForUser(req.user, req.params.id);
    const questions = await FormQuestion.find({ form: review.form._id }).sort({ position: 1 });
    const answers = await ReviewAnswer.find({ review: review._id });
    const pdf = await SignedPDF.findOne({ review: review._id }).select("originalName");
    res.json({
      review,
      questions,
      answers: Object.fromEntries(answers.map((a) => [String(a.question), a.value])),
      pdf,
    });
  });
  app.post("/api/reviews/:id/save", async (req, res) => {
    const result = await saveReview(
      { ...req.body, actor: req.user, reviewId: req.params.id },
      workflowHooks,
    );
    res.json({
      review: result,
      message:
        result.status === "Completed"
          ? "Review completed. Answers locked and available to the employee."
          : "Draft saved to the database. You can safely return later.",
    });
  });
  app.use("/api", (req, res) => res.status(404).json({ message: "Route not found." }));
  const dist = path.join(ROOT, "client", "dist");
  app.use(express.static(dist));
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/media/"))
      return res.status(404).send("Private files have no public URL.");
    if (existsSync(path.join(dist, "index.html"))) res.sendFile(path.join(dist, "index.html"));
    else res.status(503).send("Build the client first: npm run build");
  });
  app.use((error, req, res, next) => {
    const status = error.status || (error.code === 11000 ? 409 : 503);
    res.status(status).json({
      message: error.status
        ? error.message
        : error.code === 11000
          ? "A conflicting record already exists. Last saved data is unchanged."
          : "Save or load failed. Last saved data is unchanged. Your entries remain; try again.",
      fields: error.fields || {},
    });
  });
  return app;
}
