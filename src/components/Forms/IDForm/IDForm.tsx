"use client";

import React, { useState } from "react";
import styles from "./IDForm.module.scss";

type Props = {
  onSubmit?: (data: Record<string, string>) => void;
  fields?: Record<string, string>;
  initialValues?: Record<string, string>;
};

const defaultFields: Record<string, string> = {
  first_name: "Prenume",
  last_name: "Nume de familie",
  country: "Țara",
  serie: "Serie",
  number: "Număr",
  nationality: "Naționalitate",
  cnp: "CNP",
  birthplace: "Locul nașterii",
  address: "Adresă",
  issued_by: "Emis de",
  validity: "Valabilitate (ZZ/LL/AAAA)",
};

export default function IDForm({ onSubmit, fields, initialValues }: Props) {
  const fieldMap = fields && Object.keys(fields).length ? fields : defaultFields;
  const [values, setValues] = useState<Record<string, string>>(initialValues || {});

  function handleChange(id: string, v: string) {
    setValues((s) => ({ ...s, [id]: v }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload: Record<string, string> = {};
    Object.keys(fieldMap).forEach((id) => {
      payload[id] = values[id] ?? "";
    });
    console.log("IDForm submit", payload);
    onSubmit?.(payload);
  }

  const fullWidth = new Set(["address"]);

  return (
    <div className={styles.container}>
      <h2>ID Form</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        {Object.entries(fieldMap).map(([id, label]) => (
          <div key={id} className={`${styles.field} ${fullWidth.has(id) ? styles.full : ""}`}>
            <label htmlFor={id}>{label}</label>
            <input
              id={id}
              name={id}
              value={values[id] ?? ""}
              onChange={(e) => handleChange(id, e.target.value)}
              placeholder={typeof label === "string" ? label : ""}
              className={values[id] ? styles.filled : styles.empty}
            />
          </div>
        ))}
        <button className={styles.submit} type="submit">Submit</button>
      </form>
    </div>
  );
}
