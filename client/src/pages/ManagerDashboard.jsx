// Govinda starts here: call getAssignedReviews(), replace 501 server scaffold.
import React from "react";
import { Link } from "react-router-dom";
export default function ManagerDashboard() {
  return (
    <>
      <p className="eyebrow">GOVINDA · UI-03 / 07 / 08 STARTING SCREEN</p>
      <h1>Assigned reviews.</h1>
      <section className="card">
        <h2>Dashboard work starts here.</h2>
        <p>
          Build the full list, empty state, and load-error/retry state. Shared access-denied page
          already works.
        </p>
        <Link className="button" to="/">
          Open working review launcher
        </Link>
      </section>
    </>
  );
}
