"use client";

import { useState, useRef, useEffect } from "react";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import styles from "./OcrPoc.module.scss";

const pdfjsAny = pdfjsLib as any;
try {
  pdfjsAny.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@latest/legacy/build/pdf.worker.min.js`;
} catch (e) {
  console.warn("Could not set pdfjs workerSrc:", e);
}

type Extracted = {
  rawText: string;
  name?: string;
  dob?: string;
  idNumber?: string;
  registration?: string;
  vin?: string;
};

export default function OcrPoc() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [selection, setSelection] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [selectedField, setSelectedField] = useState<string>("name");
  const [selectionOcrText, setSelectionOcrText] = useState<string | null>(null);

  async function runOCROnImage(file: File) {
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      const img = await loadImageFromFile(file);
      const preBlob = await preprocessImageElement(img);

      const { data } = await Tesseract.recognize(preBlob, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text" && m.progress) {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const raw = data.text;
      const parsed = parseFields(raw);
      setExtracted({ rawText: raw, ...parsed });
      setPreviewBlob(preBlob);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  async function runOCROnPDF(file: File) {
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      const array = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: array }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Unable to get canvas context");
      await page.render({ canvasContext: ctx, viewport }).promise;
      const preBlob = await preprocessCanvas(canvas);
      setPreviewBlob(preBlob);
      await ocrBlob(preBlob);
    } catch (e: any) {
      setError(String(e));
      setLoading(false);
    }
  }

  async function ocrBlob(blob: Blob) {
    try {
      const { data } = await Tesseract.recognize(blob, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text" && m.progress) {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const raw = data.text;
      const parsed = parseFields(raw);
      setExtracted({ rawText: raw, ...parsed });
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  async function preprocessImageElement(img: HTMLImageElement): Promise<Blob> {
    const maxWidth = 1500;
    const scale = Math.min(1, maxWidth / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to get canvas context");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return preprocessCanvas(canvas);
  }

  async function preprocessCanvas(source: HTMLCanvasElement): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to get canvas context");

    ctx.drawImage(source, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const contrast = 1.15;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // luminance
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      let c = ((l / 255 - 0.5) * contrast + 0.5) * 255;
      c = Math.max(0, Math.min(255, c));
      data[i] = data[i + 1] = data[i + 2] = c;
    }

    const width = canvas.width;
    const height = canvas.height;
    const copy = new Uint8ClampedArray(data);
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const kSize = 3;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let idx = (y * width + x) * 4;
        let accum = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const srcIdx = ((y + ky) * width + (x + kx)) * 4;
            accum += copy[srcIdx] * kernel[k++];
          }
        }
        const val = Math.max(0, Math.min(255, accum));
        data[idx] = data[idx + 1] = data[idx + 2] = val;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png"
      );
    });
  }

  useEffect(() => {
    if (!previewBlob || !previewRef.current) return;
    (async () => {
      const img = await loadImageFromFile(previewBlob);
      const canvas = previewRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (selection) {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
      }
    })();
  }, [previewBlob, selection]);

  function toCanvasCoords(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
    const canvas = previewRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round(
      (e.clientY - rect.top) * (canvas.height / rect.height)
    );
    return { x, y };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!previewRef.current) return;
    const pos = toCanvasCoords(e);
    setSelStart(pos);
    setIsSelecting(true);
    setSelection(null);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isSelecting || !selStart) return;
    const pos = toCanvasCoords(e);
    const x = Math.min(selStart.x, pos.x);
    const y = Math.min(selStart.y, pos.y);
    const w = Math.abs(pos.x - selStart.x);
    const h = Math.abs(pos.y - selStart.y);
    setSelection({ x, y, w, h });
  }

  function handleMouseUp() {
    setIsSelecting(false);
    setSelStart(null);
  }

  async function ocrSelectionAssign() {
    if (!selection || !previewRef.current) return;
    const canvas = previewRef.current;
    const crop = document.createElement("canvas");
    crop.width = selection.w;
    crop.height = selection.h;
    const ctx = crop.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      canvas,
      selection.x,
      selection.y,
      selection.w,
      selection.h,
      0,
      0,
      selection.w,
      selection.h
    );
    const blob: Blob = await new Promise((res) =>
      crop.toBlob((b) => res(b as Blob), "image/png")
    );
    setLoading(true);
    try {
      const { data } = await Tesseract.recognize(blob, "eng");
      const text = data.text.trim();
      setSelectionOcrText(text);
      setExtracted(
        (prev) =>
          ({ ...(prev || { rawText: "" }), [selectedField]: text } as Extracted)
      );
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type === "application/pdf") {
      void runOCROnPDF(file);
    } else if (file.type.startsWith("image/")) {
      void runOCROnImage(file);
    } else {
      setError("Unsupported file type");
    }
  }

  function parseFields(raw: string) {
    const normalize = (s: string) =>
      s
        .replace(/\u00A0/g, " ")
        .replace(/\|/g, "I")
        .replace(/\u2019/g, "'")
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[Oo]\s?(?=[0-9])/, "0")
        .replace(/\bI(?=[0-9]{3,})/g, "1")
        .replace(/\s{2,}/g, " ")
        .trim();

    const rawNorm = normalize(raw);
    const lines = rawNorm
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const joined = lines.join(" \n ");

    const dateRegexes = [
      /\b(0?[1-9]|[12][0-9]|3[01])[\/.\-](0?[1-9]|1[0-2])[\/.\-](\d{2,4})\b/,
      /\b(\d{4})[\/.\-](0?[1-9]|1[0-2])[\/.\-](0?[1-9]|[12][0-9]|3[01])\b/,
    ];
    let dobMatch: RegExpMatchArray | null = null;
    for (const r of dateRegexes) {
      const m = joined.match(r);
      if (m) {
        dobMatch = m;
        break;
      }
    }

    const vinCandidate = joined.match(/[A-HJ-NPR-Z0-9\-]{10,20}/i);
    let vin: string | undefined;
    if (vinCandidate) {
      let v = vinCandidate[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
      v = v.replace(/O/g, "0").replace(/I/g, "1").replace(/Q/g, "0");
      if (v.length === 17) vin = v;
    }

    const idMatch = joined.match(/\b[A-Z0-9]{6,20}\b/i);

    let name: string | undefined;
    for (const l of lines) {
      const wordCount = l.split(/\s+/).length;
      if (/^[A-Za-z ,.'-]{3,80}$/.test(l) && wordCount >= 2 && wordCount <= 4) {
        if (/[a-z]/.test(l) || l.includes(" ")) {
          name = l;
          break;
        }
      }
    }

    const regMatch = joined.match(/\b[A-Z0-9\- ]{4,12}\b/i);

    const labelExtract = (label: string) => {
      const idx = joined.toLowerCase().indexOf(label.toLowerCase());
      if (idx === -1) return undefined;
      const after = joined
        .substring(idx + label.length, idx + label.length + 80)
        .trim();
      const match = after.match(/[A-Za-z0-9 ,.'\-\/]{3,80}/);
      return match ? match[0].trim() : undefined;
    };

    const anchoredName =
      labelExtract("name") ||
      labelExtract("holder") ||
      labelExtract("nom") ||
      undefined;
    const anchoredDob =
      labelExtract("date of birth") ||
      labelExtract("dob") ||
      labelExtract("birth") ||
      undefined;
    const anchoredVin =
      labelExtract("vin") || labelExtract("chassis") || undefined;

    return {
      name: anchoredName || name,
      dob: anchoredDob || (dobMatch ? dobMatch[0] : undefined),
      idNumber: idMatch ? idMatch[0] : undefined,
      registration: regMatch ? regMatch[0] : undefined,
      vin: vin || anchoredVin,
    };
  }

  function downloadJSON() {
    if (!extracted) return;
    const blob = new Blob([JSON.stringify(extracted, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className={styles.ocrCard}>
        <h1 className={`${styles.ocrTitle} text-2xl mb-4`}>Document OCR POC</h1>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-slate-700">
            Upload ID or Registration (image or PDF)
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="mt-2"
          />
        </label>

        {previewBlob && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm">Field:</label>
              <select
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="name">Name</option>
                <option value="dob">Date of Birth</option>
                <option value="idNumber">ID Number</option>
                <option value="registration">Registration</option>
                <option value="vin">VIN</option>
              </select>
              <button
                onClick={ocrSelectionAssign}
                className="ml-2 px-3 py-1 bg-green-600 text-white rounded"
              >
                OCR selection
              </button>
              <button
                onClick={() => {
                  setSelection(null);
                  setSelectionOcrText(null);
                }}
                className="ml-2 px-3 py-1 bg-gray-200 rounded"
              >
                Clear selection
              </button>
            </div>

            <div className="border p-2 inline-block">
              <canvas
                ref={previewRef}
                style={{ maxWidth: "100%", cursor: "crosshair" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
            </div>

            {selection && (
              <div className="text-sm text-slate-600 mt-2">
                Selection: x={selection.x}, y={selection.y}, w={selection.w}, h=
                {selection.h}
              </div>
            )}

            {selectionOcrText && (
              <div className="mt-2">
                <div className="text-sm font-medium">Selection OCR result</div>
                <pre className="bg-gray-50 p-2 rounded">{selectionOcrText}</pre>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="mb-4">
            <div>OCR in progress: {progress}%</div>
            <progress value={progress} max={100} className="w-full"></progress>
          </div>
        )}

        {error && <div className="text-red-600 mb-4">Error: {error}</div>}

        {extracted && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">Parsed Fields</h2>
              <pre className="bg-gray-100 p-3 rounded">
                {JSON.stringify({ ...extracted, rawText: undefined }, null, 2)}
              </pre>
            </div>

            <div>
              <h2 className="font-semibold">Raw OCR Text</h2>
              <textarea
                className="w-full h-48 p-3 bg-gray-50"
                value={extracted.rawText}
                readOnly
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadJSON}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Download JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
