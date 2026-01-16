
import IDForm from "@/components/Forms/IDForm/IDForm";
import CarDocumentForm from "@/components/Forms/CarDocumentForm/CarDocumentForm";
import DriverLicenseForm from "@/components/Forms/DriverLicenseForm/DriverLicenseForm";
import CompensationClaim from "@/components/Forms/CompensationClaim/CompensationClaim";
import CessionContract from "@/components/Forms/CessionContract/CessionContract";

export default function Home() {
  return (
    <>

        <IDForm />
        <DriverLicenseForm />
        <CarDocumentForm />
        <CompensationClaim />
        <CessionContract />
    </>
  );
}

