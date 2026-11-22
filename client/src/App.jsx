import React, { createContext, useContext, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { apiRequest, getSession } from "./api.js";
import { Home, Login, ReviewEditor, ReviewResult } from "./pages/ReviewWorkflow.jsx";
import FormBuilder from "./pages/FormBuilder.jsx";
import Assignments from "./pages/Assignments.jsx";
import ManagerDashboard from "./pages/ManagerDashboard.jsx";
import EmployeeResults from "./pages/EmployeeResults.jsx";

// Shared session state for the navigation and every protected screen.
const Auth = createContext(null);
export const useAuth = () => useContext(Auth);

export function ErrorState({ error, retry }) {
  return (
    <div className="notice error" role="alert">
      <p>{error.message || String(error)}</p>
      {retry && (
        <button className="secondary" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function AccessDenied() {
  return (
    <>
      <p className="eyebrow">ACCESS DENIED · UI-08</p>
      <h1>This review is unavailable.</h1>
      <section className="card">
        <p>
          Your role, assignment, or completed status prevents this action. Completed answers cannot
          be changed.
        </p>
        <Link className="button" to="/">
          Return to my workspace
        </Link>
      </section>
    </>
  );
}
export function RoleGate({ roles, children }) {
  const { user } = useAuth();
  return !user ? (
    <Navigate to="/login" replace />
  ) : roles && !roles.includes(user.role) ? (
    <AccessDenied />
  ) : (
    children
  );
}
function Shell() {
  const { user, setUser, expired, setExpired } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  async function logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST", body: {} });
      setUser(null);
      setExpired(false);
      navigate("/login");
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brandmark">R</span>ReviewFlow
        </Link>
        <span className="project">TEAM 02 · MILESTONE 4</span>
        {user && (
          <div className="identity">
            <span>
              {user.name} <span className="muted">/ {user.role}</span>
            </span>
            <button className="quiet" onClick={logout}>
              Sign out
            </button>
          </div>
        )}
      </header>
      {user && (
        <nav aria-label="Main navigation">
          <Link to="/">Home</Link>
          {user.role === "manager" && (
            <>
              <Link to="/manager/reviews">Assigned reviews</Link>
              <Link to="/employee/results">My results</Link>
            </>
          )}
          {user.role === "employee" && <Link to="/employee/results">My results</Link>}
          {user.role === "hr" && (
            <>
              <Link to="/hr/forms">Review forms</Link>
              <Link to="/hr/assignments">Assignments</Link>
            </>
          )}
        </nav>
      )}
      <main id="main">
        {error && <ErrorState error={error} />}
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route
            path="/"
            element={
              <RoleGate>
                <Home />
              </RoleGate>
            }
          />
          <Route
            path="/reviews/:id/edit"
            element={
              <RoleGate roles={["manager"]}>
                <ReviewEditor />
              </RoleGate>
            }
          />
          <Route
            path="/reviews/:id"
            element={
              <RoleGate>
                <ReviewResult />
              </RoleGate>
            }
          />
          <Route
            path="/hr/forms"
            element={
              <RoleGate roles={["hr"]}>
                <FormBuilder />
              </RoleGate>
            }
          />
          <Route
            path="/hr/forms/:id"
            element={
              <RoleGate roles={["hr"]}>
                <FormBuilder />
              </RoleGate>
            }
          />
          <Route
            path="/hr/assignments"
            element={
              <RoleGate roles={["hr"]}>
                <Assignments />
              </RoleGate>
            }
          />
          <Route
            path="/manager/reviews"
            element={
              <RoleGate roles={["manager"]}>
                <ManagerDashboard />
              </RoleGate>
            }
          />
          <Route
            path="/employee/results"
            element={
              <RoleGate roles={["employee", "manager"]}>
                <EmployeeResults />
              </RoleGate>
            }
          />
          <Route
            path="*"
            element={
              <>
                <h1>Page not found.</h1>
                <Link to="/">Return home</Link>
              </>
            }
          />
        </Routes>
      </main>
      <footer>
        ReviewFlow / Local classroom prototype <span>Private feedback. Shared with care.</span>
      </footer>
    </>
  );
}
export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [expired, setExpired] = useState(false);

  async function load() {
    try {
      const data = await getSession();
      setUser(data.user);
      setReady(true);
      setError(null);
    } catch (e) {
      if (e.status === 401) {
        setExpired(true);
        await load();
      } else setError(e);
    }
  }
  useEffect(() => {
    load();
    const timeout = async () => {
      setUser(null);
      setExpired(true);
      // Destroy a session that is just short of its server deadline, then obtain
      // a fresh CSRF token. Server still enforces expiry when JS is suspended.
      try {
        await apiRequest("/auth/logout", { method: "POST", body: {} });
      } catch {}
      try {
        await getSession();
      } catch {
        try {
          await getSession();
        } catch (e) {
          setError(e);
        }
      }
    };
    window.addEventListener("reviewflow:signed-out", timeout);
    return () => window.removeEventListener("reviewflow:signed-out", timeout);
  }, []);
  useEffect(() => {
    if (!user) return;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => window.dispatchEvent(new Event("reviewflow:signed-out")), 900000);
    };
    resetTimer();
    window.addEventListener("reviewflow:activity", resetTimer);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("reviewflow:activity", resetTimer);
    };
  }, [user]);
  if (!ready)
    return (
      <main>
        {error ? (
          <ErrorState error={error} retry={load} />
        ) : (
          <p role="status">Loading ReviewFlow…</p>
        )}
      </main>
    );
  return (
    <Auth.Provider value={{ user, setUser, expired, setExpired }}>
      <Shell />
    </Auth.Provider>
  );
}
