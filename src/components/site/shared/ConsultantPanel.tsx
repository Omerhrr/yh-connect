"use client";

import { useCallback, useEffect, useState } from "react";
import { UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api, ApiError, type ConsultantState, type ProjectOut } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { formatNaira } from "@/lib/utils";

const VERDICT_TONE: Record<string, string> = {
  recommend: "bg-emerald-100 text-emerald-700",
  not_recommend: "bg-red-100 text-red-600",
  neutral: "bg-muted text-muted-foreground",
};
const VERDICT_LABEL: Record<string, string> = { recommend: "Recommended", not_recommend: "Not recommended", neutral: "Note" };

/** Consultant/middleman section (F11). Shows what the viewer needs:
 *  client: choose/remove a consultant and read their notes;
 *  professional: apply to consult;
 *  appointed consultant: see bids and post recommendations. */
export function ConsultantPanel({ project }: { project: ProjectOut }) {
  const user = useAuth((s) => s.user);
  const [state, setState] = useState<ConsultantState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [fee, setFee] = useState("");
  const [body, setBody] = useState("");
  const [bidId, setBidId] = useState("");
  const [verdict, setVerdict] = useState<"recommend" | "not_recommend" | "neutral">("neutral");

  const load = useCallback(() => {
    api.consultantState(project.id).then(setState).catch(() => setState(null));
  }, [project.id]);
  useEffect(load, [load]);

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

  if (!state || !user) return null;
  const isClient = state.role === "client";
  const isConsultant = state.role === "consultant";
  const isPro = user.role === "professional";
  if (!state.needs_consultant && !isClient) return null;
  if (!isClient && !isConsultant && !(isPro && !state.consultant_id)) return null;

  const bidLabel = (id?: string | null) => {
    const b = state.bids.find((x) => x.id === id);
    return b ? `on ${b.professional_name}'s bid` : "";
  };

  return (
    <div className="rounded-xl border bg-background p-4 md:p-5 space-y-3">
      <h2 className="font-semibold flex items-center gap-2"><UserCog className="h-4 w-4 text-muted-foreground" /> Consultant</h2>

      {isClient && !state.needs_consultant && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">Want a consultant to supervise this project and advise on bids?</p>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => api.setNeedsConsultant(project.id, true), "Consultant requested")}>Request a consultant</Button>
        </div>
      )}

      {isClient && state.needs_consultant && !state.consultant_id && (
        <>
          <p className="text-sm text-muted-foreground">Professionals can apply to consult. Choose one to appoint. Hiring the consultant is separate from hiring someone to do the work.</p>
          {state.applications.filter((a) => a.status === "pending").length === 0 && <p className="text-sm text-muted-foreground">No applications yet.</p>}
          {state.applications.filter((a) => a.status === "pending").map((a) => (
            <div key={a.id} className="border-t pt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.professional_name}{a.proposed_fee != null && <span className="text-muted-foreground font-normal"> · fee {formatNaira(a.proposed_fee)}</span>}</p>
                {a.note && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{a.note}</p>}
              </div>
              <Button size="sm" disabled={busy} onClick={() => run(() => api.consultantAppoint(project.id, a.id), "Consultant appointed")}>Appoint</Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api.setNeedsConsultant(project.id, false), "Consultant request removed")}>I no longer need one</Button>
        </>
      )}

      {isClient && state.consultant_id && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm">Appointed: <span className="font-medium">{state.consultant_name}</span></p>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => confirm("Remove this consultant?") && run(() => api.consultantRemove(project.id), "Consultant removed")}>Remove</Button>
        </div>
      )}

      {isPro && !isConsultant && !state.consultant_id && state.needs_consultant && (
        state.my_application?.status === "pending" ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">You've applied to consult. The client will respond.</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => api.consultantWithdraw(project.id), "Application withdrawn")}>Withdraw</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">This client wants a consultant to supervise the project. You can apply separately from bidding on the work.</p>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you're a good fit..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
            <div className="flex gap-2 items-center">
              <Input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Proposed fee (₦, optional)" className="h-9 max-w-[220px]" />
              <Button size="sm" disabled={busy} onClick={() => run(() => api.consultantApply(project.id, { note: note || undefined, proposed_fee: fee ? Number(fee) : null }), "Application sent")}>Apply to consult</Button>
            </div>
          </div>
        )
      )}

      {isConsultant && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">You're the consultant on this project. Review bids and give the client your recommendation.</p>
          {state.bids.length > 0 && (
            <div className="space-y-1.5">
              {state.bids.map((b) => (
                <p key={b.id} className="text-xs">
                  <span className="font-medium">{b.professional_name}</span> · {formatNaira(b.amount)}{b.estimated_days ? ` · ${b.estimated_days} days` : ""} · {b.status}
                </p>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <select value={bidId} onChange={(e) => setBidId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">General note</option>
                {state.bids.map((b) => <option key={b.id} value={b.id}>{b.professional_name} · {formatNaira(b.amount)}</option>)}
              </select>
              <select value={verdict} onChange={(e) => setVerdict(e.target.value as typeof verdict)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="neutral">Note</option>
                <option value="recommend">Recommend</option>
                <option value="not_recommend">Don't recommend</option>
              </select>
            </div>
            <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Your advice to the client..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
            <Button size="sm" disabled={busy || !body.trim()} onClick={() => run(async () => {
              await api.consultantAddNote(project.id, { body, bid_id: bidId || null, verdict });
              setBody("");
            }, "Note sent to client")}>Post</Button>
          </div>
        </div>
      )}

      {(isClient || isConsultant) && state.notes.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          {state.notes.map((n) => (
            <div key={n.id} className="text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{n.consultant_name}</span>
                <Badge className={`text-[10px] rounded-full ${VERDICT_TONE[n.verdict]}`}>{VERDICT_LABEL[n.verdict]}</Badge>
                {bidLabel(n.bid_id) && <span className="text-xs text-muted-foreground">{bidLabel(n.bid_id)}</span>}
                <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</span>
              </div>
              <p className="whitespace-pre-wrap mt-0.5">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
