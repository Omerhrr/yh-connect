/**
 * Shared status -> badge color token maps, used across client, talent, and
 * admin surfaces so the same status always renders with the same color
 * regardless of which page/component is showing it.
 */

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  open: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

export const BID_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  shortlisted: "bg-blue-100 text-blue-700",
  offered: "bg-purple-100 text-purple-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  withdrawn: "bg-gray-100 text-gray-600",
};

export const MILESTONE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-amber-100 text-amber-700",
  funded: "bg-purple-100 text-purple-700",
  approved: "bg-emerald-100 text-emerald-700",
  paid: "bg-green-100 text-green-700",
  refunded: "bg-orange-100 text-orange-700",
  rejected: "bg-red-100 text-red-600",
};

export const DISPUTE_STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  under_review: "bg-blue-100 text-blue-700",
  escalated: "bg-red-100 text-red-600",
  resolved: "bg-green-100 text-green-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

export const WALLET_TX_TYPE_COLORS: Record<string, string> = {
  topup: "bg-purple-100 text-purple-700",
  funding: "bg-blue-100 text-blue-700",
  release: "bg-green-100 text-green-700",
  refund: "bg-amber-100 text-amber-700",
  withdrawal: "bg-slate-200 text-slate-700",
  adjustment: "bg-slate-800 text-white",
};

export const WALLET_TX_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  successful: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
};
