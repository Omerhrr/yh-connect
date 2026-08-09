import { Suspense } from "react";
import { VerifyEmailPage } from "@/components/site/pages/AuthPages";

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailPage />
    </Suspense>
  );
}
