import { Suspense } from "react";
import { ResetPasswordPage } from "@/components/site/pages/AuthPages";

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}
