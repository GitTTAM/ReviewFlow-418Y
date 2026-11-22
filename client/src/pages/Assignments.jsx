// Ahmet starts here. Assignment and reassignment remain US-06/10 work.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAssignments } from "../api.js";
import { ErrorState } from "../App.jsx";

export default function Assignments() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setData(await getAssignments());
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
      <p className="eyebrow">AHMET · UI-05 STARTING SCREEN</p>
      <h1>Review assignments.</h1>
      <div className="notice">
        Seeded records only. HR assignment and reassignment controls remain to build. Draft
        carryover is an open team decision.
      </div>
      {error && <ErrorState error={error} retry={load} />}
      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Manager</th>
              <th>Status</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {data?.reviews.map((review) => (
              <tr key={review._id}>
                <td>{review.employee.name}</td>
                <td>{review.manager.name}</td>
                <td>{review.status}</td>
                <td>
                  <Link to={`/reviews/${review._id}`}>Read review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
