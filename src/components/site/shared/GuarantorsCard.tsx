"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError, type GuarantorOut } from "@/lib/api";
import { useFeatures } from "@/lib/features";

const TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-600",
  revoked: "bg-muted text-muted-foreground",
};

/** Settings card: name a guarantor (must already be on the platform) and
 *  respond to requests other people have sent you. */
export function GuarantorsCard(props: { canRequest?: boolean }) {
  const { guarantors } = useFeatures();
  if (!guarantors) return null;
  return <GuarantorsCardInner {...props} />;
}

function GuarantorsCardInner({ canRequest = true }: { canRequest?: boolean }) {
  const [mine, setMine] = useState<GuarantorOut[]>([]);
  const [requests, setRequests] = useState<GuarantorOut[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (canRequest) api.myGuarantors().then(setMine).catch(() => setMine([]));
    api.guarantorRequests().then(setRequests).catch(() => setRequests([]));
  };
  useEffect(load, []);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const activeMine = mine.filter((g) => g.status === "pending" || g.status === "accepted");

  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Guarantors</h3>
      </div>

      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Requests for you</p>
          {pendingRequests.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.professional_name} wants you as their guarantor</p>
                {r.message && <p className="text-xs text-muted-foreground">{r.message}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => run(() => api.respondGuarantor(r.id, true), "You're now their guarantor")}>Accept</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => api.respondGuarantor(r.id, false), "Declined")}>Decline</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canRequest && (
        <>
          <p className="text-sm text-muted-foreground">
            A guarantor is someone already on YH Connect who vouches for the quality of your work. Accepted guarantors show on your public profile. Up to 3.
          </p>
          {mine.length > 0 && (
            <div className="space-y-2">
              {mine.filter((g) => g.status !== "revoked").map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <p className="text-sm font-medium">{g.guarantor_name}</p>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs rounded-full capitalize ${TONE[g.status]}`}>{g.status}</Badge>
                    {(g.status === "pending" || g.status === "accepted") && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api.revokeGuarantor(g.id), "Removed")}>Remove</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeMine.length < 3 && (
            <div className="space-y-2">
              <input
                type="email"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Guarantor's email (must have a YH Connect account)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Optional note"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy || !email.trim()}
                onClick={() => run(async () => { await api.requestGuarantor(email.trim(), message.trim() || undefined); setEmail(""); setMessage(""); }, "Request sent")}
              >
                Request guarantor
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
