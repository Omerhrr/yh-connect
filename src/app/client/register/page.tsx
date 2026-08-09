import { Suspense } from "react";
import { ClientRegisterPage } from "@/components/site/pages/AuthPages";

export default function Page() {
  return (
    <Suspense>
      <ClientRegisterPage />
    </Suspense>
  );
}
