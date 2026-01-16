"use client";

import React, { useState } from "react";
import styles from "./CarDocumentForm.module.scss";

type Props = {
  onSubmit?: (data: Record<string, string>) => void;
  /**
   * fields: mapping of field id -> label coming from backend
   */
  fields?: Record<string, string>;
  initialValues?: Record<string, string>;
};

const defaultFields: Record<string, string> = {
  property_A: "Numar de inmatriculare",
  property_J: "Categoria Vehiculului",
  property_D_1: "Marca",
  property_D_2: "Tipul",
  property_D_3: "Descrierea comerciala",
  property_E: "Numarul de identificare al vechiculului",
  property_K: "Numarul omologarii de tip",
  property_C_2_1: "Numele de familie sau denumirea firmei",
  property_C_2_2: "Prenumele sau initiala(initialele)",
  property_C_2_3: "Adresa de domiciliu/sediu",
  property_C_3_1: "Numele de families au denumirea firmei",
  property_C_3_2: "Prenumele sau initiala(initialele)",
  property_C_3_3: "Adresa de domiciliu/sediu",
  property_B: "Data primei inmatriculari a vehiculului",
  property_H: "Perioada de valabilitate, daca nu este nelimitata",
  property_I: "Data inmatricularii la care se refera acest certificat",
  property_I_1: "Data emiterii certificatului de inmatriculare",
  property_F_1: "Masa incarcata maxim admisa",
  property_G: "Masa vehiculului in serviciu",
  property_P_1: "Capacitatea motorului (in cm3)",
  property_P_2: "Puterea neta maxima (in kW)",
  property_P_3: "Tipul de combustibil sau de sursa de putere",
  property_Q: "Raportul putere/masa(in kW/kg)",
  property_R: "Culoarea vehiculului",
  property_S_1: "Numar de locuri, inclusive locul conducatorului auto",
  property_S_2: "Numar de locuri in picioare",
  property_V_7: "Emisii CO2",
  property_V_10: "V10",
  property_Y: "Seria cartii de identitate a vechiulului",
  property_Z: "Autoritatea eminenta",
  observatii: "Observatii",
  numar_certificat: "Numar Certificat",
};

export default function CarDocumentForm({ onSubmit, fields, initialValues }: Props) {
  const fieldMap = fields && Object.keys(fields).length ? fields : defaultFields;
  const [values, setValues] = useState<Record<string, string>>(initialValues || {});

  function handleChange(id: string, v: string) {
    setValues((s) => ({ ...s, [id]: v }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // ensure every field has a string value
    const payload: Record<string, string> = {};
    Object.keys(fieldMap).forEach((id) => {
      payload[id] = values[id] ?? "";
    });
    console.log("CarDocumentForm submit", payload);
    onSubmit?.(payload);
  }

  // helper: some fields should span full width
  const fullWidth = new Set(["property_C_2_3", "property_C_3_3", "observatii", "numar_certificat"]);

  return (
    <div className={styles.container}>
      <h2>Car Document Form</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        {Object.entries(fieldMap).map(([id, label]) => (
          <div key={id} className={`${styles.field} ${fullWidth.has(id) ? styles.full : ""}`}>
            <label htmlFor={id}>{label}</label>
            <input
              id={id}
              name={id}
              value={values[id] ?? ""}
              onChange={(e) => handleChange(id, e.target.value)}
              placeholder={label}
              className={values[id] ? styles.filled : styles.empty}
            />
          </div>
        ))}

        <button className={styles.submit} type="submit">Submit</button>
      </form>
    </div>
  );
}
