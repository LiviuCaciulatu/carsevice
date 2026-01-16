"use client";

import React, { useState, useRef } from "react";
import styles from "./CessionContract.module.scss";

type Props = {
  onSubmit?: (data: Record<string, string>) => void;
  fields?: Record<string, string>;
  initialValues?: Record<string, string>;
};

const defaultFields: Record<string, string> = {
  contract_nr: "Nr.",
  contract_date: "Data",
  cedent_name: "Nume Cedent",
  cedent_address: "Adresa Cedent",
  cedent_id: "CUI/CNP Cedent",
  cesionar_name: "Cesionar",
  cesionar_address: "Adresa Cesionar",
  amount: "Suma",
  debtor_name: "Debitor",
  debtor_details: "Detalii debitor",
  invoice_ref: "Factura/Referinta",
  observations: "Observatii",
  date: "Data",
  signature: "Semnatura",
};

// Local AutoInput (module-level so it doesn't remount)
function AutoInput(props: React.InputHTMLAttributes<HTMLInputElement> & { fieldId?: string }) {
  const { fieldId, style, ...rest } = props as any;
  const val = (rest.value as string) ?? "";
  const len = Math.min(Math.max((val || "").toString().length, 1), 80);
  const s: React.CSSProperties = { ...(style || {}) };
  s.minWidth = s.minWidth ?? "6ch";
  if (val) s.width = `${len}ch`;
  const id = fieldId ?? (rest.id as string | undefined);
  return <input {...(rest as any)} id={id} style={s} />;
}

export default function CessionContract({ onSubmit, fields, initialValues }: Props) {
  const fieldMap = fields && Object.keys(fields).length ? fields : defaultFields;
  const [values, setValues] = useState<Record<string, string>>(initialValues || {});
  const containerRef = useRef<HTMLDivElement | null>(null);

  function handleChange(id: string, v: string) {
    setValues((s) => ({ ...s, [id]: v }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload: Record<string, string> = {};
    Object.keys(fieldMap).forEach((id) => (payload[id] = values[id] ?? ""));
    onSubmit?.(payload);
  }

  async function handleDownloadPDF() {
    if (!containerRef.current) return alert("Nothing to export");
    const el = containerRef.current as HTMLElement;
    el.classList.add(styles.pdfExporting);
    const actions = el.querySelector(`.${styles.actions}`) as HTMLElement | null;
    const prevDisplay = actions ? actions.style.display : null;
    if (actions) actions.style.display = "none";

    try {
      const html2canvasModule = await import("html2canvas");
      const { jsPDF } = await import("jspdf");
      const html2canvas = (html2canvasModule as any).default ?? html2canvasModule;
      const prevBg = el.style.background;
      el.style.background = "#ffffff";
      const canvas = await html2canvas(el, { scale: Math.max(2, (window.devicePixelRatio || 1) * 2), useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgProps = (pdf as any).getImageProperties(imgData);
      const imgScale = Math.max(pdfW / imgProps.width, pdfH / imgProps.height);
      const imgW = imgProps.width * imgScale;
      const imgH = imgProps.height * imgScale;
      const x = (pdfW - imgW) / 2;
      let pos = 0;
      let left = imgH - pdfH;
      pdf.addImage(imgData, "PNG", x, pos, imgW, imgH);
      while (left > -0.5) { pos -= pdfH; pdf.addPage(); pdf.addImage(imgData, "PNG", x, pos, imgW, imgH); left -= pdfH; }
      pdf.save("cession-contract.pdf");
      el.style.background = prevBg;
    } catch (err) {
      console.error(err);
      const w = window.open("", "_blank", "noopener,noreferrer");
      if (w) { w.document.write(el.outerHTML); w.document.close(); w.focus(); setTimeout(() => w.print(), 250); }
    } finally {
      if (actions) actions.style.display = prevDisplay ?? "";
      el.classList.remove(styles.pdfExporting);
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.headerCenter}>
          <h1 className={styles.title}>CONTRACT DE CESIUNE DE CREANȚĂ</h1>
          <div className={styles.row}>
          <div className={styles.companyLine}>
            {fieldMap.contract_nr} <AutoInput className={values["contract_nr"] ? styles.filled : styles.empty} fieldId="contract_nr" value={values["contract_nr"] ?? ""} onChange={(e) => handleChange("contract_nr", e.target.value)} />
          </div>
            {fieldMap.contract_date}: <AutoInput className={values["contract_date"] ? styles.filled : styles.empty} fieldId="contract_date" value={values["contract_date"] ?? ""} onChange={(e) => handleChange("contract_date", e.target.value)} />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.full}>
            <p>
              Având în vedere că <strong>CEDENTUL</strong> deține o creanță în cuantum total de
              <AutoInput className={values["amount"] ? styles.filled : styles.empty} fieldId="amount" value={values["amount"] ?? ""} onChange={(e) => handleChange("amount", e.target.value)} />
              lei împotriva asiguratului / debitorului <AutoInput className={values["debtor_name"] ? styles.filled : styles.empty} fieldId="debtor_name" value={values["debtor_name"] ?? ""} onChange={(e) => handleChange("debtor_name", e.target.value)} />
              (detalii: <AutoInput className={values["debtor_details"] ? styles.filled : styles.empty} fieldId="debtor_details" value={values["debtor_details"] ?? ""} onChange={(e) => handleChange("debtor_details", e.target.value)} />),
              părțile convin prezenta cesiune de creanță după cum urmează:
            </p>
          </div>

          <div className={styles.full}>
            <h3>Preambul</h3>
            <p>
              Prin prezentul contract, <AutoInput className={values["cedent_name"] ? styles.filled : styles.empty} fieldId="cedent_name" value={values["cedent_name"] ?? ""} onChange={(e) => handleChange("cedent_name", e.target.value)} />
              , cu sediul în <AutoInput className={values["cedent_address"] ? styles.filled : styles.empty} fieldId="cedent_address" value={values["cedent_address"] ?? ""} onChange={(e) => handleChange("cedent_address", e.target.value)} />,
              identificat(ă) cu <AutoInput className={values["cedent_id"] ? styles.filled : styles.empty} fieldId="cedent_id" value={values["cedent_id"] ?? ""} onChange={(e) => handleChange("cedent_id", e.target.value)} />
              , cedentul transmite în favoarea <AutoInput className={values["cesionar_name"] ? styles.filled : styles.empty} fieldId="cesionar_name" value={values["cesionar_name"] ?? ""} onChange={(e) => handleChange("cesionar_name", e.target.value)} />
              , cu sediul în <AutoInput className={values["cesionar_address"] ? styles.filled : styles.empty} fieldId="cesionar_address" value={values["cesionar_address"] ?? ""} onChange={(e) => handleChange("cesionar_address", e.target.value)} />
              , dreptul de a încasa creanța menționată mai sus.
            </p>
          </div>

          <div className={styles.full}>
            <h4>ART. 1 - OBIECTUL CONTRACTULUI</h4>
            <p>
              Obiectul prezentului contract constă în transmiterea în mod irevocabil și necondiționat de către Cedent în favoarea Cesionarului a dreptului de creanță indicat în preambul, împreună cu accesoriile sale.
            </p>
          </div>

          <div className={styles.full}>
            <h4>ART. 2 - PREȚUL CESIUNII</h4>
            <p>
              Părțile convin că prețul cesiunii este de <AutoInput className={values["price"] ? styles.filled : styles.empty} fieldId="price" value={values["price"] ?? ""} onChange={(e) => handleChange("price", e.target.value)} /> lei, plătibil conform înțelegerii părților.
            </p>
          </div>

          <div className={styles.full}>
            <h4>ART. 3 - OBLIGAȚIILE PĂRȚILOR</h4>
            <p>
              Cedentul declară că are capacitatea deplină de exercițiu și că nu există acte sau contracte care să împiedice cesiunea. Cesionarul acceptă cesiunea și se obligă să respecte drepturile și obligațiile preluate.
            </p>
          </div>

          <div className={styles.full}>
            <label>Alte observații</label>
            <textarea className={values["observations"] ? styles.filled : styles.empty} value={values["observations"] ?? ""} onChange={(e) => handleChange("observations", e.target.value)} />
          </div>

          <div className={styles.footerRow}>
            <div>
              <label>DATA</label>
              <AutoInput className={values["date"] ? styles.filled : styles.empty} fieldId="date" value={values["date"] ?? ""} onChange={(e) => handleChange("date", e.target.value)} />
            </div>
            <div>
              <label>SEMNĂTURA</label>
              <AutoInput className={values["signature"] ? styles.filled : styles.empty} fieldId="signature" value={values["signature"] ?? ""} onChange={(e) => handleChange("signature", e.target.value)} />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.submit} type="submit">Submit</button>
          <button className={styles.submit} type="button" onClick={handleDownloadPDF}>Download PDF</button>
        </div>
      </form>
    </div>
  );
}
