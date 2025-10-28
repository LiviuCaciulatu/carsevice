import { NextResponse } from "next/server";
import * as TextractPkg from "@aws-sdk/client-textract";
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jobId = body?.jobId;
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    // Check S3 cache first
    try {
      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const key = `textract-results/${jobId}.json`;
      const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }));
      if (obj.Body) {
        const stream = obj.Body as any;
        const chunks: any[] = [];
        for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        const text = Buffer.concat(chunks).toString('utf8');
        const cached = JSON.parse(text);
        return NextResponse.json({ jobId, status: cached.status, rawText: cached.rawText, cached: true });
      }
    } catch (e) {
      // ignore S3 not found or permission errors and fallthrough to live Textract
    }

    const tex = new (TextractPkg as any).TextractClient({ region: process.env.AWS_REGION });

    const allLines: string[] = [];
    let nextToken: string | undefined = undefined;
    let status: string | undefined = undefined;
    do {
      const cmd: any = new (TextractPkg as any).GetDocumentTextDetectionCommand({ JobId: jobId, NextToken: nextToken });
      const out: any = await tex.send(cmd as any);
      status = out.JobStatus;
      const blocks = out.Blocks || [];
      for (const b of blocks) {
        if (b.BlockType === "LINE" && b.Text) allLines.push(b.Text);
      }
      nextToken = (out as any).NextToken;
      if (status === "IN_PROGRESS") break;
    } while (nextToken);

    return NextResponse.json({ jobId, status, rawText: allLines.join("\n") });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
