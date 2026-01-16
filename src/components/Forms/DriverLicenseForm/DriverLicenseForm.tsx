"use client";

import React, { useState } from "react";
import styles from "./DriverLicenseForm.module.scss";

type Props = {
  onSubmit?: (data: Record<string, string>) => void;
  fields?: Record<string, string>;
  initialValues?: Record<string, string>;
};

const defaultFields: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  date_of_birth: "Date of Birth",
  birthplace: "Birthplace",
  issued_date: "Issued Date",
  expiration_date: "Expiration Date",
  issued_by: "Issued By",
  license_number: "License Number",
  vehicle_codes: "Vehicle Codes",
};

export default function DriverLicenseForm({ onSubmit, fields, initialValues }: Props) {
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
    console.log("DriverLicenseForm submit", payload);
    onSubmit?.(payload);
  }

  return (
    <div className={styles.container}>
        <h2>Driver License Form</h2>
    <form className={styles.form} onSubmit={handleSubmit}>
      {Object.entries(fieldMap).map(([id, label]) => (
        <div key={id} className={`${styles.field} ${["issued_by", "vehicle_codes"].includes(id) ? styles.full : ""}`}>
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
