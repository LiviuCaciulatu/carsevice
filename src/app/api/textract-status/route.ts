import { NextResponse } from "next/server";
import * as TextractPkg from "@aws-sdk/client-textract";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jobId = body?.jobId;
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

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
