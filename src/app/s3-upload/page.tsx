import S3Uploader from "@/components/S3Uploader/S3Uploader";

export default function Page() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">S3 Upload</h1>
      <S3Uploader />
    </div>
  );
}
