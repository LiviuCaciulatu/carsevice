import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as any;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const filename = `${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const client = new S3Client({ region: process.env.AWS_REGION });
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: filename,
        Body: new Uint8Array(arrayBuffer),
        ContentType: file.type || "application/octet-stream",
      })
    );
    return NextResponse.json({ key: filename });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
