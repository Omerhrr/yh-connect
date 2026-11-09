"use client";

import { Eye } from "lucide-react";
import type { AdminArea } from "@/lib/adminAccess";
import { useCanManage } from "@/lib/useCanManage";

/** For form-heavy admin pages: view-only staff still see everything, but every
 *  input and button inside is natively disabled (via <fieldset disabled>) and a
 *  small banner explains why. Full-edit staff see the page unchanged. */
export function ViewOnlyGuard({ area, children }: { area: AdminArea; children: React.ReactNode }) {
  const canManage = useCanManage(area);
  if (canManage) return <>{children}</>;
  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Eye className="h-3.5 w-3.5" /> View only. Your role can look at this section but not change it.
      </div>
      <fieldset disabled className="contents">{children}</fieldset>
    </>
  );
}
