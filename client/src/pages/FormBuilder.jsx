// Tasfiah starts here. Write controls deliberately left for US-05/09.
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getForms } from "../api.js";
import { ErrorState } from "../App.jsx";

export default function FormBuilder() {
  const { id } = useParams();
  const [forms, setForms] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setForms((await getForms()).forms);
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
      <p className="eyebrow">TASFIAH · UI-02 STARTING SCREEN</p>
      <h1>Review forms.</h1>
      <div className="notice">
        Create and edit controls are not implemented. Seeded forms support development.
      </div>
      {error && <ErrorState error={error} retry={load} />}
      {forms.map((form) => (
        <section className="card" key={form._id}>
          <h2>{form.name}</h2>
          <p>
            {form.inUse
              ? "In use — definition must stay protected."
              : "Unused — ready for the future editor."}
          </p>
          <Link to={`/hr/forms/${form._id}`}>Inspect form</Link>
          {id === form._id &&
            form.questions.map((question) => (
              <p key={question._id}>
                {question.prompt} · {question.kind} · {question.options.join(", ")}
              </p>
            ))}
        </section>
      ))}
    </>
  );
}
