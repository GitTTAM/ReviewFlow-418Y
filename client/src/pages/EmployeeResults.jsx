// Lucille starts here: preserve basic read flow; add completed PDF controls.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEmployeeResults } from "../api.js";
import { ErrorState } from "../App.jsx";

export default function EmployeeResults() {
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setReviews((await getEmployeeResults()).reviews);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <p className="eyebrow">MY RESULTS · UI-09 FOUNDATION</p>
      <h1>Your completed feedback.</h1>
      <p className="lead">Only completed reviews appear here.</p>
      {error ? (
        <ErrorState error={error} retry={load} />
      ) : reviews === null ? (
        <p role="status">Loading results…</p>
      ) : reviews.length === 0 ? (
        <section className="card">
          <h2>No completed review yet.</h2>
          <p>Your review appears here after your manager completes it.</p>
        </section>
      ) : (
        reviews.map((review) => (
          <section className="card launch" key={review._id}>
            <div>
              <span className="pill">Completed</span>
              <h2>{review.form.name}</h2>
              <p>
                {review.completedBy.name} · {new Date(review.completedAt).toLocaleDateString()}
              </p>
            </div>
            <Link className="button" to={`/reviews/${review._id}`}>
              Read result
            </Link>
          </section>
        ))
      )}
    </>
  );
}
