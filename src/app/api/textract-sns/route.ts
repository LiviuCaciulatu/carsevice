import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as TextractPkg from '@aws-sdk/client-textract';

export const runtime = 'nodejs';

async function streamToString(stream: any) {
  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const payload = JSON.parse(bodyText);

    // Subscription confirmation
    if (payload.Type === 'SubscriptionConfirmation' && payload.SubscribeURL) {
      // Confirm by visiting the SubscribeURL (global fetch in Node runtime)
      await fetch(payload.SubscribeURL);
      return NextResponse.json({ ok: true, note: 'Subscription confirmed' });
    }

    // Notification
    if (payload.Type === 'Notification' && payload.Message) {
      let message: any;
      try { message = JSON.parse(payload.Message); } catch { message = payload.Message; }

      const jobId = message?.JobId || message?.jobId;
      const status = message?.Status || message?.status || message?.JobStatus;

      if (!jobId) return NextResponse.json({ ok: false, error: 'No JobId in SNS message' }, { status: 400 });

      // Only process SUCCEEDED jobs
      if (String(status).toUpperCase() !== 'SUCCEEDED') {
        return NextResponse.json({ ok: true, note: `Job ${jobId} status ${status} ignored` });
      }

      const tex = new (TextractPkg as any).TextractClient({ region: process.env.AWS_REGION });

      // collect lines from Textract
      const allLines: string[] = [];
      let nextToken: string | undefined = undefined;
      do {
        const cmd: any = new (TextractPkg as any).GetDocumentTextDetectionCommand({ JobId: jobId, NextToken: nextToken });
        const out: any = await tex.send(cmd as any);
        const blocks = out.Blocks || [];
        for (const b of blocks) if (b.BlockType === 'LINE' && b.Text) allLines.push(b.Text);
        nextToken = out.NextToken;
        if (out.JobStatus === 'IN_PROGRESS') break;
      } while (nextToken);

      const result = { jobId, status: 'SUCCEEDED', rawText: allLines.join('\n') };

      // store result in S3 so textract-status can return it quickly
      const s3 = new S3Client({ region: process.env.AWS_REGION });
      const key = `textract-results/${jobId}.json`;
      await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: JSON.stringify(result), ContentType: 'application/json' }));

      return NextResponse.json({ ok: true, stored: key });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported SNS message type' }, { status: 400 });
  } catch (err: any) {
    console.error('SNS handler error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
