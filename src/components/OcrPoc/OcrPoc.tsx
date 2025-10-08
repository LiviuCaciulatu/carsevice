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
  const [autoContrast, setAutoContrast] = useState<boolean>(true);

  async function runOCROnImage(file: File) {
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      const img = await loadImageFromFile(file);

      // auto-rotate: detect best orientation then rotate the image before preprocessing
      const bestRot = await detectBestRotationFromImage(img);
  const rotatedCanvas = rotateCanvasImageElement(img, bestRot);
  const preBlob = await preprocessCanvas(rotatedCanvas, { autoContrast });

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

  // auto-rotate PDF page canvas
  const bestRotPdf = await detectBestRotationFromCanvas(canvas);
  const rotated = rotateCanvas(canvas, bestRotPdf);
  const preBlob = await preprocessCanvas(rotated, { autoContrast });
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

  // Rotate an existing canvas by 0/90/180/270 degrees (clockwise) and return a new canvas
  function rotateCanvas(src: HTMLCanvasElement, degrees: number) {
    const d = ((degrees % 360) + 360) % 360;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to get canvas context");
    if (d === 90 || d === 270) {
      canvas.width = src.height;
      canvas.height = src.width;
    } else {
      canvas.width = src.width;
      canvas.height = src.height;
    }
    ctx.save();
    if (d === 90) {
      ctx.translate(canvas.width, 0);
      ctx.rotate((90 * Math.PI) / 180);
    } else if (d === 180) {
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate((180 * Math.PI) / 180);
    } else if (d === 270) {
      ctx.translate(0, canvas.height);
      ctx.rotate((270 * Math.PI) / 180);
    }
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    return canvas;
  }

  // Create a canvas from an Image element and rotate it
  function rotateCanvasImageElement(img: HTMLImageElement, degrees: number) {
    const canvas = document.createElement("canvas");
    if (degrees === 90 || degrees === 270) {
      canvas.width = img.height;
      canvas.height = img.width;
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to get canvas context");
    ctx.save();
    const d = ((degrees % 360) + 360) % 360;
    if (d === 90) {
      ctx.translate(canvas.width, 0);
      ctx.rotate((90 * Math.PI) / 180);
    } else if (d === 180) {
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate((180 * Math.PI) / 180);
    } else if (d === 270) {
      ctx.translate(0, canvas.height);
      ctx.rotate((270 * Math.PI) / 180);
    }
    ctx.drawImage(img, 0, 0, img.width, img.height);
    ctx.restore();
    return canvas;
  }

  // run a fast OCR on a blob/canvas and return a simple score based on letters/numbers count
  async function fastOcrScore(blob: Blob) {
    try {
      // prefer a quick recognition with tessedit pageseg_mode 6 (single block)
      const { data } = await Tesseract.recognize(blob, "eng", {
        tessedit_pageseg_mode: "6",
        logger: () => {},
      } as any);
      const text = data.text || "";
      // score by count of letters and digits
      const match = text.match(/[A-Za-z0-9]/g);
      return match ? match.length : 0;
    } catch (e) {
      return 0;
    }
  }

  // Try rotations on an Image element and return the best rotation (0/90/180/270)
  async function detectBestRotationFromImage(img: HTMLImageElement) {
    // make small thumbnail for speed
    const thumbW = 600;
    const scale = Math.min(1, thumbW / img.width);
    const baseCanvas = document.createElement("canvas");
    baseCanvas.width = Math.round(img.width * scale);
    baseCanvas.height = Math.round(img.height * scale);
    const ctx = baseCanvas.getContext("2d");
    if (!ctx) return 0;
    ctx.drawImage(img, 0, 0, baseCanvas.width, baseCanvas.height);

    const rotations = [0, 90, 180, 270];
    const scores: Record<number, number> = {};
    for (const r of rotations) {
      const rotated = rotateCanvas(baseCanvas, r);
      const blob: Blob = await new Promise((res) =>
        rotated.toBlob((b) => res(b as Blob), "image/png")
      );
      scores[r] = await fastOcrScore(blob);
    }
    const baseline = scores[0] || 0;
    let best = 0;
    let bestScore = baseline;
    for (const r of rotations) {
      if ((scores[r] || 0) > bestScore) {
        bestScore = scores[r];
        best = r;
      }
    }
    // conservative thresholds: require both a ratio and an absolute delta
    const ratioThreshold = 1.4; // best must be 40% better than 0°
    const absThreshold = 20; // and at least 20 more character matches
    if (best === 0) return 0;
    if (bestScore < 10) return 0; // not enough text to trust
    if (baseline === 0) {
      // if baseline had no text but best has some, only rotate if bestScore is reasonably large
      return bestScore >= absThreshold ? best : 0;
    }
    if (bestScore >= baseline * ratioThreshold && bestScore - baseline >= absThreshold) {
      return best;
    }
    return 0;
  }

  // Try rotations on a canvas and return best rotation
  async function detectBestRotationFromCanvas(src: HTMLCanvasElement) {
    const thumbW = 600;
    const scale = Math.min(1, thumbW / src.width);
    const base = document.createElement("canvas");
    base.width = Math.round(src.width * scale);
    base.height = Math.round(src.height * scale);
    const ctx = base.getContext("2d");
    if (!ctx) return 0;
    ctx.drawImage(src, 0, 0, base.width, base.height);
    const rotations = [0, 90, 180, 270];
    const scores: Record<number, number> = {};
    for (const r of rotations) {
      const rotated = rotateCanvas(base, r);
      const blob: Blob = await new Promise((res) =>
        rotated.toBlob((b) => res(b as Blob), "image/png")
      );
      scores[r] = await fastOcrScore(blob);
    }
    const baseline = scores[0] || 0;
    let best = 0;
    let bestScore = baseline;
    for (const r of rotations) {
      if ((scores[r] || 0) > bestScore) {
        bestScore = scores[r];
        best = r;
      }
    }
    const ratioThreshold = 1.4;
    const absThreshold = 20;
    if (best === 0) return 0;
    if (bestScore < 10) return 0;
    if (baseline === 0) {
      return bestScore >= absThreshold ? best : 0;
    }
    if (bestScore >= baseline * ratioThreshold && bestScore - baseline >= absThreshold) {
      return best;
    }
    return 0;
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

  async function preprocessCanvas(
    source: HTMLCanvasElement,
    options: { autoContrast?: boolean } = { autoContrast: true }
  ): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to get canvas context");

    ctx.drawImage(source, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Compute luminance stats (min, max, mean, stddev)
    let minL = 255;
    let maxL = 0;
    let sum = 0;
    let sumSq = 0;
    let pxCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      minL = Math.min(minL, l);
      maxL = Math.max(maxL, l);
      sum += l;
      sumSq += l * l;
      pxCount++;
    }
    const mean = pxCount ? sum / pxCount : 0;
    const variance = pxCount ? sumSq / pxCount - mean * mean : 0;
    const stddev = Math.sqrt(Math.max(0, variance));
    const range = maxL - minL;

    // Decide enhancement strategy (only when enabled):
    const auto = options.autoContrast !== false;
    // Decide enhancement strategy:
    // - If dynamic range is very low, do linear stretch to full 0-255
    // - Otherwise apply a mild-to-strong contrast multiplier when stddev is small
  const lowRangeThreshold = 60; // if max-min < this, consider stretch
  // Force a 50% contrast increase when autoContrast is enabled.
  // Both mild and strong contrast factors set to 1.5 (50% boost).
  const strongContrast = 3;
  const mildContrast = 3;
    if (auto) {
      if (range > 0 && range < lowRangeThreshold) {
        // linear stretch
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          let c = ((l - minL) / range) * 255;
          c = Math.max(0, Math.min(255, c));
          data[i] = data[i + 1] = data[i + 2] = c;
        }
      } else {
        // adaptive contrast: stronger when stddev is small
        const contrast = stddev < 45 ? strongContrast : mildContrast;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          let c = ((l / 255 - 0.5) * contrast + 0.5) * 255;
          c = Math.max(0, Math.min(255, c));
          data[i] = data[i + 1] = data[i + 2] = c;
        }
      }
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

  // when autoContrast toggles and we have a previewBlob, re-run preprocessing+OCR
  useEffect(() => {
    if (!previewBlob) return;
    (async () => {
      try {
        // convert previewBlob to image, build canvas, preprocess with new option, and OCR
        const img = await loadImageFromFile(previewBlob);
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const preBlob = await preprocessCanvas(canvas, { autoContrast });
        setPreviewBlob(preBlob);
        await ocrBlob(preBlob);
      } catch (e) {
        // ignore for now
      }
    })();
  }, [autoContrast]);

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

        <label className={`${styles.controls}`}>
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
        <div className={`${styles.controls}`}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={autoContrast}
              onChange={(e) => setAutoContrast(e.target.checked)}
            />
            <span className="text-sm">Auto-enhance contrast</span>
          </label>
        </div>

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

            <div className={styles.canvasWrapper}>
              <canvas
                ref={previewRef}
                style={{ maxWidth: "50%", cursor: "crosshair" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
            </div>

            {selection && (
              <div className={styles.selectionInfo}>
                Selection: x={selection.x}, y={selection.y}, w={selection.w}, h=
                {selection.h}
              </div>
            )}

            {selectionOcrText && (
              <div className={styles.selectionResult}>
                <div className="text-sm font-medium">Selection OCR result</div>
                <pre className="bg-gray-50 p-2 rounded">{selectionOcrText}</pre>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className={styles.progressWrap}>
            <div>OCR in progress: {progress}%</div>
            <progress value={progress} max={100} className="w-full"></progress>
          </div>
        )}

  {error && <div className={styles.error}>Error: {error}</div>}

        {extracted && (
          <div className="space-y-4">
            <div className={styles.parsedFields}>
              <div>
                <h2 className="font-semibold">Parsed Fields</h2>
                <pre className="bg-gray-100 p-3 rounded">
                  {JSON.stringify({ ...extracted, rawText: undefined }, null, 2)}
                </pre>
              </div>

              <div>
                <h2 className="font-semibold">Raw OCR Text</h2>
                <textarea
                  className={styles.rawTextArea}
                  value={extracted.rawText}
                  readOnly
                />
              </div>

              <div className={styles.actions}>
                <button onClick={downloadJSON} className={styles.btnPrimary}>
                  Download JSON
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
