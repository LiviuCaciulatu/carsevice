"use client";

import React, { useState } from "react";
// Using server-side AWS Textract for extraction; client-side Tesseract removed.


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
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    let c = ((l / 255 - 0.5) * contrast + 0.5) * 255;
    c = Math.max(0, Math.min(255, c));
    data[i] = data[i + 1] = data[i + 2] = c;
  }

  const width = canvas.width;
  const height = canvas.height;
  const copy = new Uint8ClampedArray(data);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
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
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export default function S3Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ocring, setOcring] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setMessage(null);
    setOcrText(null);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-s3", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.statusText);
      }
      const json = await res.json();
      setMessage(`Uploaded: ${json.key}`);
    } catch (err: any) {
      setMessage(`Error: ${err.message || String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const extractText = async () => {
    if (!file) return;
    setOcring(true);
    setOcrProgress(0);
    setOcrText(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract-textract", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.statusText);
      }
      const json = await res.json();
      if (json.rawText) {
        setOcrText(json.rawText);
      } else if (json.jobId) {
        // Poll status endpoint for async PDF jobs
        setMessage(`Started Textract job ${json.jobId}. Waiting for result...`);
        const jobId = json.jobId as string;
        const maxAttempts = 30; // poll up to ~1 minute
        let attempts = 0;
        let finished = false;
        while (attempts < maxAttempts && !finished) {
          try {
            await new Promise((r) => setTimeout(r, 2000));
            const sres = await fetch("/api/textract-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId }),
            });
            if (!sres.ok) {
              const t = await sres.text();
              throw new Error(t || sres.statusText);
            }
            const sj = await sres.json();
            const status = sj.status;
            if (status === "SUCCEEDED") {
              setOcrText(sj.rawText || "");
              setMessage(`Textract job ${jobId} completed.`);
              finished = true;
              break;
            } else if (status === "FAILED") {
              setMessage(`Textract job ${jobId} failed.`);
              finished = true;
              break;
            } else {
              setMessage(`Textract job ${jobId} status: ${status} (waiting)`);
            }
          } catch (err: any) {
            setMessage(`Error checking job status: ${err?.message || String(err)}`);
            // continue trying until attempts exhausted
          }
          attempts++;
        }
        if (!finished) {
          setMessage(`Timed out waiting for Textract job ${jobId}.`);
        }
      } else if (json.note) {
        setMessage(`Uploaded to S3: ${json.key}. Note: ${json.note}`);
      } else {
        setMessage(`Uploaded to S3: ${json.key}`);
      }
    } catch (e: any) {
      setMessage(`OCR error: ${e?.message || String(e)}`);
    } finally {
      setOcring(false);
      setOcrProgress(0);
    }
  };

  return (
    <div className="p-6 bg-white rounded shadow max-w-md">
      <h2 className="font-semibold mb-2">Upload image to S3</h2>
      <input type="file" accept="image/*,application/pdf" onChange={handleFile} />
      <div className="mt-3 flex gap-2">
        <button
          className="px-4 py-2 bg-gray-600 text-white rounded"
          onClick={extractText}
          disabled={!file || ocring}
        >
          {ocring ? `Extracting (${ocrProgress}%)` : "Extract text"}
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={upload}
          disabled={!file || uploading}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {ocrText && (
        <div className="mt-3">
          <h3 className="font-medium">Extracted text</h3>
          <textarea
            readOnly
            value={ocrText}
            className="w-full h-48 p-2 bg-gray-50 mt-2"
          />
        </div>
      )}

      {message && <div className="mt-3 text-sm">{message}</div>}
    </div>
  );
}
