import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getAssignedReviews } from "../api.js";
import { AccessDenied, ErrorState } from "../App.jsx";

export default function ManagerDashboard() {
  const [state, setState] = useState({ phase: "loading", reviews: [], error: null });
  const requestNumber = useRef(0);

  async function load() {
    const currentRequest = ++requestNumber.current;
    // Never leave a previous (possibly outdated) list visible during a failure or retry.
    setState({ phase: "loading", reviews: [], error: null });
    try {
      const data = await getAssignedReviews();
      if (currentRequest !== requestNumber.current) return;
      setState({ phase: "ready", reviews: data.reviews, error: null });
    } catch (error) {
      if (currentRequest !== requestNumber.current) return;
      setState({
        phase: error.status === 403 ? "denied" : "error",
        reviews: [],
        error,
      });
    }
  }

  useEffect(() => {
    load();
    // Ignore the result of a request when the user navigates away.
    return () => {
      requestNumber.current += 1;
    };
  }, []);

  if (state.phase === "denied") return <AccessDenied />;

  return (
    <>
      <p className="eyebrow">MANAGER WORKSPACE · US-04 · UI-03 / 07 / 08</p>
      <h1>My assigned reviews.</h1>
      <p className="lead">See which employee reviews still need work and open the right review.</p>

      {state.phase === "loading" && <p role="status">Loading assigned reviews…</p>}

      {state.phase === "error" && (
        <section className="card">
          <h2>Reviews could not be loaded.</h2>
          <ErrorState error={state.error} retry={load} />
        </section>
      )}

      {state.phase === "ready" && state.reviews.length === 0 && (
        <section className="card">
          <h2>No assigned reviews.</h2>
          <p>You do not have any reviews assigned to you.</p>
          <Link to="/">Return to my workspace</Link>
        </section>
      )}

      {state.phase === "ready" && state.reviews.length > 0 && (
        <section className="card">
          <h2>Assigned reviews ({state.reviews.length})</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Review form</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {state.reviews.map((review) => {
                  const completed = review.status === "Completed";
                  return (
                    <tr key={review._id}>
                      <td>{review.employeeName}</td>
                      <td>{review.formName}</td>
                      <td><span className="pill">{review.status}</span></td>
                      <td>
                        <Link
                          to={`/reviews/${review._id}${completed ? "" : "/edit"}`}
                          aria-label={`${completed ? "View" : "Open"} review for ${review.employeeName}`}
                        >
                          {completed ? "View review" : "Open review"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
