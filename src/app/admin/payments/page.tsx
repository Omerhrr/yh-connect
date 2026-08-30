"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Download,
  Landmark,
  Lock,
  RefreshCw,
  ShieldAlert,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, type AdminWalletSummary, type AdminWalletTransactionOut, type AdminWalletTxFilters } from "@/lib/api";
import { WALLET_TX_TYPE_COLORS as TYPE_COLORS, WALLET_TX_STATUS_COLORS as STATUS_COLORS } from "@/lib/statusColors";
import { toast } from "sonner";
import Link from "next/link";
import { formatNaira as fmtNaira } from "@/lib/utils";

const PAGE_SIZE = 30;
const STUCK_MINUTES = 30;

const TYPE_ICON: Record<string, React.ElementType> = {
  topup: ArrowDownToLine,
  funding: Wallet,
  release: Banknote,
  refund: RefreshCw,
  withdrawal: ArrowUpFromLine,
  adjustment: Landmark,
};

function StatCard({ label, value, tone, icon: Icon, hint }: { label: string; value: string; tone?: string; icon?: React.ElementType; hint?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <p className={`text-lg font-bold mt-1 ${tone || ""}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function isStuck(tx: AdminWalletTransactionOut) {
  if (tx.status !== "pending") return false;
  const ageMs = Date.now() - new Date(tx.created_at).getTime();
  return ageMs > STUCK_MINUTES * 60 * 1000;
}

type FilterState = {
  type: string;
  status: string;
  project: string;
  user: string;
  from: string;
  to: string;
  q: string;
};

const EMPTY_FILTERS: FilterState = { type: "", status: "", project: "", user: "", from: "", to: "", q: "" };

function readFiltersFromUrl(): FilterState {
  if (typeof window === "undefined") return EMPTY_FILTERS;
  const params = new URLSearchParams(window.location.search);
  return {
    type: params.get("type") || "",
    status: params.get("status") || "",
    project: params.get("project") || "",
    user: params.get("user") || "",
    from: params.get("from") || "",
    to: params.get("to") || "",
    q: params.get("q") || "",
  };
}

function toApiFilters(f: FilterState): AdminWalletTxFilters {
  const out: AdminWalletTxFilters = {};
  if (f.type) out.type_filter = f.type;
  if (f.status) out.status_filter = f.status;
  if (f.project) out.project_id = f.project;
  if (f.user) out.user_id = f.user;
  if (f.from) out.date_from = `${f.from}T00:00:00`;
  if (f.to) out.date_to = `${f.to}T23:59:59`;
  if (f.q) out.q = f.q;
  return out;
}

export default function AdminPaymentsPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [hydrated, setHydrated] = useState(false);

  const [projectDraft, setProjectDraft] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");

  const [summary, setSummary] = useState<AdminWalletSummary | null>(null);
  const [txs, setTxs] = useState<AdminWalletTransactionOut[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [userName, setUserName] = useState("");

  const loadingRef = useRef(false);
  const txsLenRef = useRef(0);
  txsLenRef.current = txs.length;

  useEffect(() => {
    const f = readFiltersFromUrl();
    setFilters(f);
    setProjectDraft(f.project);
    setSearchDraft(f.q);
    setFromDraft(f.from);
    setToDraft(f.to);
    setHydrated(true);
  }, []);

  const syncUrl = (f: FilterState) => {
    const params = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    const qs = params.toString();
    window.history.replaceState(null, "", `/admin/payments${qs ? `?${qs}` : ""}`);
  };

  const load = useCallback(async (nextFilters: FilterState, append: boolean) => {
    loadingRef.current = true;
    setLoading(true);
    const apiFilters = toApiFilters(nextFilters);
    try {
      const offset = append ? txsLenRef.current : 0;
      const [t, c] = await Promise.all([
        api.adminWalletTransactions({ ...apiFilters, limit: PAGE_SIZE, offset }),
        api.adminWalletTransactionsCount(apiFilters),
      ]);
      setTxs((prev) => (append ? [...prev, ...t] : t));
      setTotal(c.total);
      if (!append) {
        api.adminWalletSummary().then(setSummary).catch(() => undefined);
      }
    } catch {
      toast.error("Could not load payments");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setTxs([]);
    load(filters, false);
    if (filters.user) {
      api.adminUserDetail(filters.user).then((u) => setUserName(`${u.first_name} ${u.last_name}`)).catch(() => setUserName(""));
    } else {
      setUserName("");
    }
  }, [hydrated, filters.type, filters.status, filters.project, filters.user, filters.from, filters.to, filters.q]);

  const commit = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    syncUrl(next);
  };

  const applyDropdown = (key: "type" | "status", value: string) => commit({ [key]: value });

  const applyTextFilters = () => commit({ project: projectDraft, q: searchDraft, from: fromDraft, to: toDraft });

  const clearAll = () => {
    setProjectDraft(""); setSearchDraft(""); setFromDraft(""); setToDraft("");
    setFilters(EMPTY_FILTERS);
    syncUrl(EMPTY_FILTERS);
  };

  const clearUserFilter = () => commit({ user: "" });

  const filtersActive = !!(filters.type || filters.status || filters.project || filters.q || filters.from || filters.to || filters.user);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.exportWalletTransactions(toApiFilters(filters));
      toast.success("Export started, check your downloads");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not export transactions");
    } finally {
      setExporting(false);
    }
  };

  const titleFor = (tx: AdminWalletTransactionOut) =>
    tx.project_title || (tx.type === "topup" ? "Wallet top-up" : tx.type === "withdrawal" ? "Wallet withdrawal" : tx.type === "adjustment" ? "Admin adjustment" : "Untitled project");

  const hasMore = total !== null && txs.length < total;
  const stuckCount = summary?.stuck_pending_count ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform-wide escrow activity. Figures reflect simulated Monnify transactions until live payment keys are activated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => load(filters, false)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {!summary && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[68px] rounded-xl" />)}
        </div>
      )}
      {summary && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="Total topped up" value={fmtNaira(summary.total_topped_up)} icon={ArrowDownToLine} />
          <StatCard label="Total funded" value={fmtNaira(summary.total_funded)} icon={Wallet} />
          <StatCard label="Released to talent" value={fmtNaira(summary.total_released)} icon={Banknote} />
          <StatCard label="Withdrawn by talent" value={fmtNaira(summary.total_withdrawn)} icon={ArrowUpFromLine} />
          <StatCard label="Refunded" value={fmtNaira(summary.total_refunded)} icon={RefreshCw} />
          <StatCard label="Currently in escrow" value={fmtNaira(summary.total_in_escrow)} tone="text-emerald-600" icon={Lock} />
          <StatCard
            label="Held by disputes"
            value={fmtNaira(summary.total_held_in_disputes)}
            tone={summary.total_held_in_disputes > 0 ? "text-amber-600" : undefined}
            icon={ShieldAlert}
            hint={summary.total_held_in_disputes > 0 ? "Included in escrow, frozen pending resolution" : undefined}
          />
          <StatCard label="Platform fees earned" value={fmtNaira(summary.total_platform_fees)} tone="text-emerald-600" icon={Landmark} />
        </div>
      )}

      {summary && (summary.pending_transaction_count > 0 || summary.failed_transaction_count > 0 || stuckCount > 0) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            {summary.pending_transaction_count > 0 && <>{summary.pending_transaction_count} pending transaction{summary.pending_transaction_count === 1 ? "" : "s"}. </>}
            {stuckCount > 0 && (
              <button className="underline font-medium" onClick={() => commit({ status: "pending" })}>
                {stuckCount} of them have been pending over {STUCK_MINUTES} minutes and may need manual reconciliation with Monnify.
              </button>
            )}
            {summary.failed_transaction_count > 0 && <> {summary.failed_transaction_count} failed transaction{summary.failed_transaction_count === 1 ? "" : "s"}.</>}
          </p>
        </div>
      )}

      <div className="rounded-xl border bg-background p-4 space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={filters.type}
            onChange={(e) => applyDropdown("type", e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="topup">Top-up</option>
            <option value="funding">Funding</option>
            <option value="release">Release</option>
            <option value="refund">Refund</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => applyDropdown("status", e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
          </select>
          <Input
            placeholder="Search name, email, reference, note..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyTextFilters()}
          />
          <Input
            placeholder="Filter by project ID..."
            value={projectDraft}
            onChange={(e) => setProjectDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyTextFilters()}
          />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From date</label>
            <Input type="date" value={fromDraft} onChange={(e) => setFromDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyTextFilters()} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To date</label>
            <Input type="date" value={toDraft} onChange={(e) => setToDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyTextFilters()} />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyTextFilters} size="sm">Apply filters</Button>
            {filtersActive && (
              <Button variant="outline" size="sm" onClick={clearAll}>
                <X className="h-3.5 w-3.5 mr-1" /> Clear all
              </Button>
            )}
          </div>
        </div>
      </div>

      {filters.user && (
        <div className="flex items-center gap-2">
          <Badge className="text-xs rounded-full bg-blue-100 text-blue-700">
            Showing {userName || "this user"}&apos;s transactions
          </Badge>
          <button onClick={clearUserFilter} className="text-xs text-muted-foreground hover:text-primary underline">Clear</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total !== null ? <>{txs.length} of {total} transaction{total === 1 ? "" : "s"}</> : "Loading…"}
        </p>
      </div>

      {loading && txs.length === 0 && (
        <div className="rounded-xl border bg-background divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))}
        </div>
      )}
      {!loading && txs.length === 0 && (
        <div className="rounded-xl border bg-background p-10 text-center">
          <p className="text-sm text-muted-foreground">No transactions match your filters.</p>
          {filtersActive && (
            <button onClick={clearAll} className="text-xs text-primary hover:underline mt-2">Clear filters</button>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-background divide-y">
        {txs.map((tx) => {
          const Icon = TYPE_ICON[tx.type] ?? Wallet;
          const stuck = isStuck(tx);
          return (
            <div key={tx.id} className={`p-4 space-y-2 hover:bg-muted/30 transition-colors ${stuck ? "bg-amber-50/60" : ""}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    {tx.project_id ? (
                      <Link href={`/admin/projects/${tx.project_id}`} className="text-sm font-medium truncate hover:underline">
                        {titleFor(tx)}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium truncate">{titleFor(tx)}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.client_id ? (
                        <Link href={`/admin/payments?user=${tx.client_id}`} className="hover:underline">
                          Client: {tx.client_name || "Unknown"}
                        </Link>
                      ) : null}
                      {tx.professional_id ? (
                        <>
                          {tx.client_id && " · "}
                          <Link href={`/admin/payments?user=${tx.professional_id}`} className="hover:underline">
                            Pro: {tx.professional_name || "Unknown"}
                          </Link>
                        </>
                      ) : null}
                      {!tx.client_id && !tx.professional_id && "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {stuck && (
                    <Badge className="text-xs rounded-full bg-amber-100 text-amber-800">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Stuck
                    </Badge>
                  )}
                  <Badge className={`text-xs rounded-full ${TYPE_COLORS[tx.type]}`}>{tx.type}</Badge>
                  <Badge className={`text-xs rounded-full ${STATUS_COLORS[tx.status]}`}>{tx.status}</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2 pl-[42px]">
                <span>
                  {fmtNaira(tx.amount)}
                  {tx.platform_fee > 0 && <> · fee {fmtNaira(tx.platform_fee)}</>}
                  {tx.monnify_reference && <> · ref {tx.monnify_reference}</>}
                </span>
                <div className="flex items-center gap-3">
                  <span>{new Date(tx.created_at).toLocaleString()}</span>
                  {tx.status === "successful" && (
                    <button
                      className="text-primary hover:underline"
                      onClick={() => api.downloadReceipt(tx.id).catch(() => toast.error("Could not download receipt"))}
                    >
                      Receipt
                    </button>
                  )}
                </div>
              </div>
              {tx.note && <p className="text-xs text-muted-foreground pl-[42px]">{tx.note}</p>}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => load(filters, true)} disabled={loading}>
            {loading ? "Loading..." : `Load more (${(total ?? 0) - txs.length} remaining)`}
          </Button>
        </div>
      )}
    </div>
  );
}
