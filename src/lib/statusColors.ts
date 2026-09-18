

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  open: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  review: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300",
};

export const BID_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  shortlisted: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  offered: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  rejected: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300",
  withdrawn: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300",
};

export const MILESTONE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  funded: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  refunded: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  rejected: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300",
};

export const DISPUTE_STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  under_review: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  escalated: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  withdrawn: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300",
};

export const WALLET_TX_TYPE_COLORS: Record<string, string> = {
  topup: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  funding: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  release: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  refund: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  withdrawal: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  adjustment: "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900",
};

export const WALLET_TX_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  successful: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  failed: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300",
};
