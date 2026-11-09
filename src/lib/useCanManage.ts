"use client";

import { useAuth } from "@/store/auth";
import { canAccess, type AdminArea } from "@/lib/adminAccess";

/** True when the signed-in admin may change things in this area (view-only
 *  staff get false, so pages can hide their edit controls). */
export function useCanManage(area: AdminArea): boolean {
  const user = useAuth((s) => s.user);
  return canAccess(user, area, "manage");
}
