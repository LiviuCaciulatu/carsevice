import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const run = async () => {
  try {
    const res = await client.send(new ListBucketsCommand({}));
    console.log("Buckets:", res.Buckets || []);
  } catch (err) {
    console.error("Error listing buckets:", err);
    process.exitCode = 1;
  }
};
run();
