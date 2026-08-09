"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, type AdminWalletSummary, type AdminWalletTransactionOut } from "@/lib/api";
import { WALLET_TX_TYPE_COLORS as TYPE_COLORS, WALLET_TX_STATUS_COLORS as STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";

function fmtNaira(n: number) {
  return `₦${n.toLocaleString()}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold mt-1 ${tone || ""}`}>{value}</p>
    </div>
  );
}

export default function AdminPaymentsPage() {
  const [summary, setSummary] = useState<AdminWalletSummary | null>(null);
  const [txs, setTxs] = useState<AdminWalletTransactionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectId, setProjectId] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.adminWalletSummary(),
      api.adminWalletTransactions({
        type_filter: typeFilter || undefined,
        status_filter: statusFilter || undefined,
        project_id: projectId || undefined,
      }),
    ])
      .then(([s, t]) => {
        setSummary(s);
        setTxs(t);
      })
      .catch(() => toast.error("Could not load payments"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Payments</h1>
      <p className="text-sm text-muted-foreground">
        Platform-wide escrow activity. Figures reflect simulated Monnify transactions until live payment keys are activated.
      </p>

      {summary && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Stat label="Total topped up" value={fmtNaira(summary.total_topped_up)} />
          <Stat label="Total funded" value={fmtNaira(summary.total_funded)} />
          <Stat label="Released to talent" value={fmtNaira(summary.total_released)} />
          <Stat label="Withdrawn by talent" value={fmtNaira(summary.total_withdrawn)} />
          <Stat label="Refunded" value={fmtNaira(summary.total_refunded)} />
          <Stat label="Currently in escrow" value={fmtNaira(summary.total_in_escrow)} tone="text-emerald-600" />
          <Stat label="Platform fees earned" value={fmtNaira(summary.total_platform_fees)} tone="text-emerald-600" />
        </div>
      )}
      {summary && (summary.pending_transaction_count > 0 || summary.failed_transaction_count > 0) && (
        <p className="text-xs text-muted-foreground">
          {summary.pending_transaction_count > 0 && <>{summary.pending_transaction_count} pending transaction{summary.pending_transaction_count === 1 ? "" : "s"}. </>}
          {summary.failed_transaction_count > 0 && <>{summary.failed_transaction_count} failed transaction{summary.failed_transaction_count === 1 ? "" : "s"}.</>}
        </p>
      )}

      <div className="grid sm:grid-cols-4 gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="topup">Top-up</option>
          <option value="funding">Funding</option>
          <option value="release">Release</option>
          <option value="refund">Refund</option>
          <option value="withdrawal">Withdrawal</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="successful">Successful</option>
          <option value="failed">Failed</option>
        </select>
        <Input
          placeholder="Filter by project ID..."
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <Button onClick={load} size="sm">Apply Filters</Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && txs.length === 0 && <p className="text-sm text-muted-foreground">No transactions match your filters.</p>}

      <div className="rounded-xl border bg-background divide-y">
        {txs.map((tx) => (
          <div key={tx.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{tx.project_title || (tx.type === "topup" ? "Wallet top-up" : tx.type === "withdrawal" ? "Wallet withdrawal" : "Untitled project")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tx.client_name && <>Client: {tx.client_name}</>}
                  {tx.professional_name && <> · Pro: {tx.professional_name}</>}
                  {!tx.client_name && !tx.professional_name && "—"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge className={`text-xs rounded-full ${TYPE_COLORS[tx.type]}`}>{tx.type}</Badge>
                <Badge className={`text-xs rounded-full ${STATUS_COLORS[tx.status]}`}>{tx.status}</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {fmtNaira(tx.amount)}
                {tx.platform_fee > 0 && <> · fee {fmtNaira(tx.platform_fee)}</>}
                {tx.monnify_reference && <> · ref {tx.monnify_reference}</>}
              </span>
              <span>{new Date(tx.created_at).toLocaleString()}</span>
            </div>
            {tx.note && <p className="text-xs text-muted-foreground">{tx.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
