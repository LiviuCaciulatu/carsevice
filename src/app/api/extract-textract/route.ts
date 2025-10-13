// extract-textract route
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as TextractPkg from "@aws-sdk/client-textract";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as any;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const filename = `${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();

    const s3 = new S3Client({ region: process.env.AWS_REGION });
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: filename,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type || "application/octet-stream",
      })
    );

    if (file.type === "application/pdf") {
      const snsTopicArn = process.env.AWS_TEXTRACT_SNS_TOPIC_ARN;
      const roleArn = process.env.AWS_TEXTRACT_ROLE_ARN;
      if (snsTopicArn && roleArn) {
        const tex = new (TextractPkg as any).TextractClient({ region: process.env.AWS_REGION });
        const startCmd: any = new (TextractPkg as any).StartDocumentTextDetectionCommand({
          DocumentLocation: { S3Object: { Bucket: process.env.S3_BUCKET_NAME, Name: filename } },
          NotificationChannel: { RoleArn: roleArn, SNSTopicArn: snsTopicArn },
        });
        const startOut: any = await tex.send(startCmd as any);
        return NextResponse.json({ key: filename, jobId: startOut.JobId });
      }

      return NextResponse.json({ key: filename, note: "PDF uploaded. Async Textract processing not started (SNS/ROLE not configured)." });
    }

    const tex = new (TextractPkg as any).TextractClient({ region: process.env.AWS_REGION });
    const cmd: any = new (TextractPkg as any).DetectDocumentTextCommand({ Document: { Bytes: new Uint8Array(arrayBuffer) } });
    const out: any = await tex.send(cmd as any);

    const blocks = (out.Blocks || []) as Array<{ BlockType?: string; Text?: string }>;
    const lines = blocks.filter((b) => b.BlockType === "LINE").map((b) => b.Text).filter(Boolean) as string[];
    const raw = lines.join("\n");

    return NextResponse.json({ key: filename, rawText: raw });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
