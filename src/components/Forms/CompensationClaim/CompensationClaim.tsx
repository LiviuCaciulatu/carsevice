"use client";

import React, { useState, useRef } from "react";
import styles from "./CompensationClaim.module.scss";

// Stable AutoInput component (defined at module scope so identity doesn't change)
function AutoInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { fieldId?: string }
) {
  const { fieldId, style, ...rest } = props as any;
  const val = (rest.value as string) ?? "";
  const len = Math.min(Math.max((val || "").toString().length, 1), 80);
  const s: React.CSSProperties = { ...(style || {}) };
  s.minWidth = s.minWidth ?? "20ch";
  if (val) s.width = `${len}ch`;
  const id = fieldId ?? (rest.id as string | undefined);
  return <input {...(rest as any)} id={id} style={s} />;
}

type Props = {
  onSubmit?: (data: Record<string, string>) => void;
  fields?: Record<string, string>;
  initialValues?: Record<string, string>;
};

const defaultFields: Record<string, string> = {
  in_atentia: "In Atentia",
  dosar_dauna_nr: "Dosarul de dauna Nr.",
  claimant_name: "Nume (Subsemnatul)",
  cnp: "CNP",
  role: "Calitate",
  vehicle_make: "Marca",
  vehicle_model: "Tipul",
  registration_number: "Numar inmatriculare",
  claim_number: "Numarul daunei",
  suma_1: "Suma 1",
  bank_1: "Banca 1",
  iban_1: "IBAN 1",
  account_holder_1: "Titular cont 1",
  suma_2: "Suma 2",
  bank_2: "Banca 2",
  iban_2: "IBAN 2",
  account_holder_2: "Titular cont 2",
  observatii:
    "Pentru solutionarea dosarului de dauna anexez urmatoarele documente",
  date: "Data",
  signature: "Semnatura/Stampila",
};

export default function CompensationClaim({
  onSubmit,
  fields,
  initialValues,
}: Props) {
  const fieldMap =
    fields && Object.keys(fields).length ? fields : defaultFields;
  const [values, setValues] = useState<Record<string, string>>(
    initialValues || {}
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  function handleChange(id: string, v: string) {
    setValues((s) => ({ ...s, [id]: v }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload: Record<string, string> = {};
    Object.keys(fieldMap).forEach((id) => {
      payload[id] = values[id] ?? "";
    });
    console.log("CompensationClaim submit", payload);
    onSubmit?.(payload);
  }

  // Auto-sizing input used to be defined here; moved to module-scope `AutoInput`.

  function handleDownloadPDF() {
    if (!containerRef?.current) {
      alert("Nothing to export");
      return;
    }

    (async () => {
      const actionsSelector = `.${styles.actions}`;
      const element = containerRef.current as HTMLElement;
      const actionsEl = element.querySelector(
        actionsSelector
      ) as HTMLElement | null;
      const prevDisplay = actionsEl ? actionsEl.style.display : null;
      // add module class to hide outlines/controls during capture
      element.classList.add(styles.pdfExporting);
      if (actionsEl) actionsEl.style.display = "none";

      try {
        const html2canvasModule = await import("html2canvas");
        const { jsPDF } = await import("jspdf");
        const html2canvas =
          (html2canvasModule as any).default ?? html2canvasModule;

        // increase scale for sharper output on A4; respect devicePixelRatio
        const canvasScale = Math.max(2, (window.devicePixelRatio || 1) * 2);
        // ensure white background for PDF
        const prevBg = element.style.background;
        element.style.background = "#ffffff";

        const canvas = await html2canvas(element, {
          scale: canvasScale,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF({ unit: "pt", format: "a4" });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgProps = (pdf as any).getImageProperties(imgData);

        // scale image so it fills the PDF page (cover behavior)
        const imgScale = Math.max(
          pdfWidth / imgProps.width,
          pdfHeight / imgProps.height
        );
        const imgWidth = imgProps.width * imgScale;
        const imgHeight = imgProps.height * imgScale;

        // center image horizontally (can be negative if imgWidth > pdfWidth)
        const x = (pdfWidth - imgWidth) / 2;

        let heightLeft = imgHeight - pdfHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", x, position, imgWidth, imgHeight);

        while (heightLeft > -0.5) {
          position = position - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", x, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save("compensation-claim.pdf");
        // restore background
        element.style.background = prevBg;
      } catch (err) {
        console.error(err);
        alert(
          "Failed to generate PDF with library — falling back to print dialog."
        );
        const win = window.open("", "_blank", "noopener,noreferrer");
        if (!win) return;
        win.document.write(element.outerHTML);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
      } finally {
        if (actionsEl) actionsEl.style.display = prevDisplay ?? "";
        element.classList.remove(styles.pdfExporting);
      }
    })();
  }

  const fullWidth = new Set(["observatii", "signature"]);
  const textareas = new Set(["observatii"]);

  return (
    <div className={styles.container} ref={containerRef}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.headerCenter}>
          <div className={styles.companyLine}>
            IN ATENTIA:{" "}
            <AutoInput
              fieldId="in_atentia"
              className={values["in_atentia"] ? styles.filled : styles.empty}
              value={values["in_atentia"] ?? ""}
              onChange={(e) => handleChange("in_atentia", e.target.value)}
              placeholder=""
            />
          </div>
          <h1 className={styles.title}>CERERE DE DESPĂGUBIRE</h1>
          <div className={styles.row}>
            DOSARUL DE DAUNĂ Nr.:{" "}
            <AutoInput
              fieldId="dosar_dauna_nr"
              className={
                values["dosar_dauna_nr"] ? styles.filled : styles.empty
              }
              value={values["dosar_dauna_nr"] ?? ""}
              onChange={(e) => handleChange("dosar_dauna_nr", e.target.value)}
              // placeholder=""
            />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.line}>
            <span>Subsemnatul</span>
            <AutoInput
              fieldId="claimant_name"
              className={values["claimant_name"] ? styles.filled : styles.empty}
              value={values["claimant_name"] ?? ""}
              onChange={(e) => handleChange("claimant_name", e.target.value)}
            />
            <span>având CNP</span>
            <AutoInput
              fieldId="cnp"
              className={values["cnp"] ? styles.filled : styles.empty}
              value={values["cnp"] ?? ""}
              onChange={(e) => handleChange("cnp", e.target.value)}
            />
            <span>, în calitate de</span>
            <AutoInput
              fieldId="role"
              className={values["role"] ? styles.filled : styles.empty}
              value={values["role"] ?? ""}
              onChange={(e) => handleChange("role", e.target.value)}
            />
            <span>, având în vedere daunele autovehiculului marca</span>
            <AutoInput
              fieldId="vehicle_make"
              className={values["vehicle_make"] ? styles.filled : styles.empty}
              value={values["vehicle_make"] ?? ""}
              onChange={(e) => handleChange("vehicle_make", e.target.value)}
            />
            <span>tipul</span>
            <AutoInput
              fieldId="vehicle_model"
              className={values["vehicle_model"] ? styles.filled : styles.empty}
              value={values["vehicle_model"] ?? ""}
              onChange={(e) => handleChange("vehicle_model", e.target.value)}
            />
            <span>înmatriculat cu nr.</span>
            <AutoInput
              fieldId="registration_number"
              className={
                values["registration_number"] ? styles.filled : styles.empty
              }
              value={values["registration_number"] ?? ""}
              onChange={(e) =>
                handleChange("registration_number", e.target.value)
              }
            />
          </div>

          <div className={styles.line}>
            <span>mentionate in dosarul de dauna cu numarul:</span>
            <AutoInput
              fieldId="claim_number"
              className={values["claim_number"] ? styles.filled : styles.empty}
              value={values["claim_number"] ?? ""}
              onChange={(e) => handleChange("claim_number", e.target.value)}
            />
            <span>
              , va rog sa aprobati plata despagubirii, dupa cum urmeaza:
            </span>
          </div>
          <br />
          <div className={styles.amountGrid}>
            <div className={styles.amountRow}>
              <label>Suma:</label>
              <AutoInput
                fieldId="suma_1"
                className={values["suma_1"] ? styles.filled : styles.empty}
                value={values["suma_1"] ?? ""}
                onChange={(e) => handleChange("suma_1", e.target.value)}
              />
              <label>în contul deschis la banca</label>
              <AutoInput
                fieldId="bank_1"
                className={values["bank_1"] ? styles.filled : styles.empty}
                value={values["bank_1"] ?? ""}
                onChange={(e) => handleChange("bank_1", e.target.value)}
              />
              <label>, conform:</label>
              <AutoInput
                fieldId="conform_1"
                className={values["conform_1"] ? styles.filled : styles.empty}
                value={values["conform_1"] ?? ""}
                onChange={(e) => handleChange("conform_1", e.target.value)}
              />
              <label>IBAN</label>
              <AutoInput
                fieldId="iban_1"
                className={values["iban_1"] ? styles.filled : styles.empty}
                value={values["iban_1"] ?? ""}
                onChange={(e) => handleChange("iban_1", e.target.value)}
              />
              <label>titular cont</label>
              <AutoInput
                fieldId="account_holder_1"
                className={
                  values["account_holder_1"] ? styles.filled : styles.empty
                }
                value={values["account_holder_1"] ?? ""}
                onChange={(e) =>
                  handleChange("account_holder_1", e.target.value)
                }
              />
            </div>

            <div className={styles.amountRow}>
              <label>Suma:</label>
              <AutoInput
                fieldId="suma_2"
                className={values["suma_2"] ? styles.filled : styles.empty}
                value={values["suma_2"] ?? ""}
                onChange={(e) => handleChange("suma_2", e.target.value)}
              />
              <label>în contul deschis la banca</label>
              <AutoInput
                fieldId="bank_2"
                className={values["bank_2"] ? styles.filled : styles.empty}
                value={values["bank_2"] ?? ""}
                onChange={(e) => handleChange("bank_2", e.target.value)}
              />
              <label>, conform:</label>
              <AutoInput
                fieldId="conform_2"
                className={values["conform_2"] ? styles.filled : styles.empty}
                value={values["conform_2"] ?? ""}
                onChange={(e) => handleChange("conform_2", e.target.value)}
              />
              <label>IBAN</label>
              <AutoInput
                fieldId="iban_2"
                className={values["iban_2"] ? styles.filled : styles.empty}
                value={values["iban_2"] ?? ""}
                onChange={(e) => handleChange("iban_2", e.target.value)}
              />
              <label>titular cont</label>
              <AutoInput
                fieldId="account_holder_2"
                className={
                  values["account_holder_2"] ? styles.filled : styles.empty
                }
                value={values["account_holder_2"] ?? ""}
                onChange={(e) =>
                  handleChange("account_holder_2", e.target.value)
                }
              />
            </div>
          </div>

          <div className={styles.full}>
            <label>
              Pentru solutionarea dosarului de dauna anexez urmatoarele
              documente:
            </label>
            <br />
            <textarea
              className={values["observatii"] ? styles.filled : styles.empty}
              value={values["observatii"] ?? ""}
              onChange={(e) => handleChange("observatii", e.target.value)}
            />
          </div>

          <div className={styles.declaration}>
            <p>
              · Raspund de exactitatea, realitatea si corectitatea actelor depuse
            </p>
            <p>
              · Ma oblig sa restitui despagubirea primita, in cazul in care actele
              incheiate de organele de politie, de unitatile de pompieri sau de
              alte autoritati competente sa cerceteze evenimentele asigurate
              sunt anulate.
            </p>
            <p>
              · DECLAR PE PROPRIE RASPUNDERE CA NU POSED ACELAS TIP DE ASIGURARE
              PENTRU ACEST AUTOVEHICUL INCHEIATA SI LA ALTE SOCIETATI DE
              ASIGURARE
            </p>
            <p>
              · DECLAR PE PROPRIA RASPUNDERE CA NU MAI PRETIND DESPAGUBIRI PENTRU
              ACEST EVENIMENT DE LA O ALTA SOCIETATE DE ASIGURARI SAU DE LA
              PERSOANA VINOVATA
            </p>
            <p>
              · Cerere de plata formulata si completata in baza prevederilor Legii
              132/2017 si a Normei ASF 20/2017.
            </p>
            <p>
              · In caz de neachitare integrala in termenul prevazut de lege,
              asiguratorul intra sub incidenta art.21, al. 5 din legea 132/2017
              si va fi obligat la plata penalitatilor de intarziere de 0.2% pe
              zi.
            </p>
          </div>

          <div className={styles.footerRow}>
            <div>
              <label>DATA</label>
              <AutoInput
                fieldId="date"
                className={values["date"] ? styles.filled : styles.empty}
                value={values["date"] ?? ""}
                onChange={(e) => handleChange("date", e.target.value)}
              />
            </div>
            <div>
              <label>SEMNĂTURA/ȘTAMPILA</label>
              <AutoInput
                fieldId="signature"
                className={values["signature"] ? styles.filled : styles.empty}
                value={values["signature"] ?? ""}
                onChange={(e) => handleChange("signature", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.submit} type="submit">
            Submit
          </button>
          <button
            className={styles.submit}
            type="button"
            onClick={handleDownloadPDF}
          >
            Download PDF
          </button>
        </div>
      </form>
    </div>
  );
}
