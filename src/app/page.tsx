import OcrPoc from "@/components/OcrPoc/OcrPoc";
import S3Uploader from "@/components/S3Uploader/S3Uploader";

export default function Home() {
  return (
    <>
      <OcrPoc />
      <S3Uploader />
    </>
  );
}

