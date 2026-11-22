import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { apiRequest, getReview, saveReview } from "../api.js";
import { AccessDenied, ErrorState, useAuth } from "../App.jsx";

export function Login() {
  const { setUser, expired, setExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
      setUser(data.user);
      setExpired(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-layout">
      <section>
        <p className="eyebrow">A CLEARER REVIEW PROCESS</p>
        <h1>
          Good feedback.
          <br />A lasting record.
        </h1>
        <p className="lead">
          Save your progress, discuss the review, and share the completed result.
        </p>
        <div className="steps">
          <span>Draft</span>
          <span>Discuss</span>
          <span>Complete</span>
        </div>
      </section>
      <section className="card">
        <p className="eyebrow">WELCOME BACK</p>
        <h2>Sign in to ReviewFlow</h2>
        <p className="muted">Use your team demo account.</p>
        {expired && (
          <div role="alert" className="notice error">
            Signed out after inactivity. Unsaved entries were not saved. Sign in again.
          </div>
        )}
        {error && <ErrorState error={error} />}
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button disabled={busy}>Sign in</button>
        </form>
        <p className="fine">
          Sessions expire after 15 minutes without a request. Save drafts before stepping away.
        </p>
      </section>
    </div>
  );
}
// Temporary manager launcher until the full assigned-review dashboard is ready.
export function Home() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setData(await apiRequest("/workspace"));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }
  useEffect(() => {
    if (user.role === "manager") load();
  }, [user.role]);
  if (user.role === "employee") return <Navigate to="/employee/results" replace />;
  if (user.role === "hr")
    return (
      <>
        <p className="eyebrow">HR WORKSPACE</p>
        <h1>Review operations.</h1>
        <p className="lead">Shared records are ready. These are teammate starting screens.</p>
        <div className="grid">
          <section className="card">
            <h2>Review forms</h2>
            <p>Create and edit controls come next.</p>
            <Link to="/hr/forms">Open form workspace</Link>
          </section>
          <section className="card">
            <h2>Assignments</h2>
            <p>Inspect seeded assignments. HR write controls come next.</p>
            <Link to="/hr/assignments">Open assignments</Link>
          </section>
        </div>
      </>
    );
  const review = data?.review;
  return (
    <>
      <p className="eyebrow">MANAGER WORKSPACE</p>
      <h1>Pick up where you left off.</h1>
      <p className="lead">
        A direct path to your next review while the full dashboard is being built.
      </p>
      {error ? (
        <ErrorState error={error} retry={load} />
      ) : !data ? (
        <p role="status">Loading your review…</p>
      ) : (
        <section className="card launch">
          <div>
            <span className="pill">WORKING DEMO · US-01 / US-02</span>
            <h2>Your next unfinished review</h2>
            {review ? (
              <>
                <p>
                  {review.employee.name} · {review.form.name}
                </p>
                <p className="muted">
                  {review.status} · Saved version {review.version}
                </p>
              </>
            ) : (
              <p>No unfinished review assigned to you.</p>
            )}
          </div>
          {review && (
            <Link className="button" to={`/reviews/${review._id}/edit`}>
              Open review
            </Link>
          )}
        </section>
      )}
      <p className="muted">
        Saved drafts stay private. Employees see the result only after completion.
      </p>
    </>
  );
}
export function ReviewEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [discussion, setDiscussion] = useState(false);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Reloading is explicit: failed saves must leave the manager's typed entries alone.
  async function load() {
    try {
      const loaded = await getReview(id);
      setData(loaded);
      setAnswers(
        Object.fromEntries(loaded.questions.map((q) => [q._id, loaded.answers[q._id] || ""])),
      );
      setDiscussion(false);
      setLoadError(null);
      setError(null);
      setMessage("");
    } catch (e) {
      setLoadError(e);
    }
  }
  useEffect(() => {
    setData(null);
    load();
  }, [id]);
  async function submit(event) {
    event.preventDefault();
    const action = event.nativeEvent.submitter?.value || "draft";
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const saved = await saveReview(id, {
        answers,
        version: data.review.version,
        action,
        discussionConfirmed: discussion,
      });
      setData((current) => ({ ...current, review: { ...current.review, ...saved.review } }));
      // The API returns success only after the database transaction commits.
      setMessage(saved.message);
      if (action === "complete") navigate(`/reviews/${id}`, { state: { message: saved.message } });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (loadError?.status === 403 || error?.status === 403) return <AccessDenied />;
  if (loadError) return <ErrorState error={loadError} retry={load} />;
  if (!data) return <p role="status">Loading saved questions and answers…</p>;
  if (data.review.status === "Completed") return <Navigate to={`/reviews/${id}`} replace />;
  const fields = error?.fields || {};
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MANAGER REVIEW · UI-04</p>
          <h1>{data.review.employee.name}</h1>
          <p className="lead">{data.review.form.name}</p>
        </div>
        <span className="pill">{data.review.status}</span>
      </div>
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      <div className="editor-layout">
        <section className="card">
          <h2>Review questions</h2>
          <p className="muted">{data.review.form.description}</p>
          <form onSubmit={submit} noValidate>
            {error && (
              <div className="notice error" role="alert">
                <strong>{error.message}</strong>
                <ul>
                  {Object.entries(fields).map(([key, value]) => (
                    <li key={key}>
                      <a href={`#q_${key}`}>{value}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.questions.map((q) => (
              <div className="field" key={q._id}>
                <label htmlFor={`q_${q._id}`}>{q.prompt}</label>
                <span className="hint" id={`hint_${q._id}`}>
                  {q.required ? "Required to complete" : "Optional"}
                </span>
                {q.kind === "dropdown" ? (
                  <select
                    id={`q_${q._id}`}
                    value={answers[q._id]}
                    onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
                    aria-describedby={`hint_${q._id}`}
                    aria-invalid={Boolean(fields[q._id])}
                  >
                    <option value="">Select an answer</option>
                    {q.options.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    id={`q_${q._id}`}
                    rows={4}
                    maxLength={10000}
                    value={answers[q._id]}
                    onChange={(e) => setAnswers({ ...answers, [q._id]: e.target.value })}
                    aria-describedby={`hint_${q._id}`}
                    aria-invalid={Boolean(fields[q._id])}
                  />
                )}
                {fields[q._id] && <p className="error-text">{fields[q._id]}</p>}
              </div>
            ))}
            <div className="discussion">
              <input
                id="q_discussionConfirmed"
                type="checkbox"
                checked={discussion}
                onChange={(e) => setDiscussion(e.target.checked)}
              />
              <label htmlFor="q_discussionConfirmed">
                I confirm I discussed this review with the employee.
              </label>
            </div>
            {fields.discussionConfirmed && (
              <p className="error-text">{fields.discussionConfirmed}</p>
            )}
            <div className="actions">
              <button
                type="submit"
                name="action"
                value="draft"
                className="secondary"
                disabled={busy}
              >
                Save draft
              </button>
              <button type="submit" name="action" value="complete" disabled={busy}>
                Complete review
              </button>
            </div>
          </form>
        </section>
        <aside>
          <div className="card">
            <p className="eyebrow">BEFORE YOU COMPLETE</p>
            <h2>A final record.</h2>
            <p>Answer every required question and confirm your conversation with the employee.</p>
            <hr />
            <p>Drafts can be incomplete. Save any time.</p>
            <p>Completed answers are locked and shared with the employee immediately.</p>
            <p className="fine">
              15-minute inactivity timeout. Save before stepping away. Saved version{" "}
              {data.review.version}.
            </p>
            <button className="quiet" onClick={load} disabled={busy}>
              Reopen last saved version
            </button>
            <p className="fine">Reopening replaces unsaved entries with the saved answers.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
export function ReviewResult() {
  const { id } = useParams();
  const [data, setData] = useState(null),
    [error, setError] = useState(null);
  async function load() {
    try {
      setData(await getReview(id));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }
  useEffect(() => {
    setData(null);
    load();
  }, [id]);
  if (error?.status === 403) return <AccessDenied />;
  if (error) return <ErrorState error={error} retry={load} />;
  if (!data) return <p role="status">Loading review…</p>;
  const { review, questions, answers, pdf } = data;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REVIEW RECORD</p>
          <h1>{review.employee.name}</h1>
          <p className="lead">{review.form.name}</p>
        </div>
        <span className="pill">{review.status}</span>
      </div>
      <section className="card">
        <dl className="metadata">
          <div>
            <dt>Reviewer</dt>
            <dd>{(review.completedBy || review.manager).name}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>
              {review.completedAt
                ? new Date(review.completedAt).toLocaleString()
                : "Not yet completed"}
            </dd>
          </div>
          <div>
            <dt>Employee discussion</dt>
            <dd>{review.discussionConfirmed ? "Confirmed" : "Not confirmed"}</dd>
          </div>
        </dl>
        <div className={`notice ${review.status === "Completed" ? "success" : ""}`}>
          {review.status === "Completed"
            ? "Completed answers are locked. This result is available without a PDF."
            : "Read-only draft preview. Hidden from the employee."}
        </div>
        {questions.map((q) => (
          <article className="answer" key={q._id}>
            <h2>{q.prompt}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{answers[q._id] || "No answer saved."}</p>
          </article>
        ))}
      </section>
      <section className="card">
        <h2>Signed PDF</h2>
        <p>
          {pdf
            ? "Fictional sample PDF record present. Authorized download is Lucille's remaining task."
            : "No signed PDF attached. The completed review above is available now."}
        </p>
      </section>
    </>
  );
}
