"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Landmark, PiggyBank, Scale, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type LedgerSummaryOut, type LedgerTransactionOut } from "@/lib/api";
import { formatNaira as fmtNaira } from "@/lib/utils";
import { toast } from "sonner";

function StatCard({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: React.ElementType; tone?: string }) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone || "text-muted-foreground"}`} />
      </div>
      <p className="text-xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminLedgerPage() {
  const [summary, setSummary] = useState<LedgerSummaryOut | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransactionOut[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.adminLedgerSummary(), api.adminLedgerTransactions(100, 0)])
      .then(([s, t]) => {
        setSummary(s);
        setTransactions(t);
      })
      .catch(() => toast.error("Could not load ledger"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!summary) {
    return <p className="text-sm text-muted-foreground">Could not load ledger.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Ledger</h1>
        <div className="flex items-center gap-2">
          <Badge variant={summary.balanced ? "outline" : "destructive"} className="gap-1">
            {summary.balanced ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {summary.balanced ? "Books balanced" : "Books NOT balanced"}
          </Badge>
          <Badge variant={summary.solvent ? "outline" : "destructive"} className="gap-1">
            {summary.solvent ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {summary.solvent ? "Solvent" : `Drift: ₦${summary.settlement_drift.toLocaleString()}`}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        Every naira the platform is responsible for is tracked in a double-entry ledger — client and talent wallet
        balances, escrowed milestone funds, payment-protection holdbacks, and platform revenue are each their own
        account. "Books balanced" means every transaction ever posted summed to zero. "Solvent" means cash held at
        Monnify equals everything owed out plus revenue earned — if that drifts, it needs investigating before it
        becomes a real shortfall.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Monnify settlement (cash held)" value={fmtNaira(summary.monnify_settlement)} icon={Landmark} tone="text-blue-600" />
        <StatCard label="Platform revenue earned" value={fmtNaira(summary.platform_revenue)} icon={PiggyBank} tone="text-emerald-600" />
        <StatCard label="Client wallet liabilities" value={fmtNaira(summary.client_liabilities)} icon={Wallet} />
        <StatCard label="Talent wallet liabilities" value={fmtNaira(summary.talent_liabilities)} icon={Wallet} />
        <StatCard label="Escrowed (funded, unresolved)" value={fmtNaira(summary.platform_escrow)} icon={Scale} />
        <StatCard label="Held back (payment protection)" value={fmtNaira(summary.platform_holding)} icon={Scale} />
      </div>

      <div>
        <h2 className="font-semibold mb-3">Recent postings</h2>
        <div className="rounded-xl border bg-background divide-y">
          {transactions.length === 0 && <p className="p-4 text-sm text-muted-foreground">No ledger activity yet.</p>}
          {transactions.map((t) => (
            <div key={t.id} className="p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <Badge variant="outline" className="mr-1.5 text-[10px]">{t.type}</Badge>
                  {new Date(t.created_at).toLocaleString()}
                  {t.related_type && ` · ${t.related_type}:${t.related_id?.slice(0, 8)}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                {t.entries.map((e, i) => (
                  <p key={i} className={`text-xs font-mono ${e.amount < 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {e.amount > 0 ? "+" : ""}{e.amount.toLocaleString()}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
