
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api/v1";

function backendOrigin(): string {
  return API_BASE.replace(/\/api\/v1\/?$/, "");
}

export function resolveAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/uploads/")) return url;
    const origin = new URL(backendOrigin());
    return `${origin.protocol}//${origin.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

const TOKEN_KEY = "yhc_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const inFlightGets = new Map<string, Promise<unknown>>();

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const token = getToken();
  const dedupeKey = method === "GET" ? `${token || ""}:${path}` : null;

  if (dedupeKey && inFlightGets.has(dedupeKey)) {
    return inFlightGets.get(dedupeKey) as Promise<T>;
  }

  const run = async (): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });

    if (!res.ok) {
      let message = res.statusText;
      try {
        const data = await res.json();
        message = data.detail || message;
      } catch {
      }
      throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  };

  if (!dedupeKey) return run();

  const promise = run().finally(() => inFlightGets.delete(dedupeKey));
  inFlightGets.set(dedupeKey, promise);
  return promise;
}

export type UserRole = "client" | "professional" | "admin";

export type UserOut = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  company_name?: string | null;
  industry?: string | null;
  company_logo_url?: string | null;
  company_description?: string | null;
  company_website?: string | null;
  is_verified_business: boolean;
  business_verification_status?: "unverified" | "pending" | "verified" | "rejected";
  preferred_categories?: string[] | null;
  is_verified: boolean;
  email_verified: boolean;
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  email_notifications_enabled: boolean;
  created_at: string;
  has_professional_profile: boolean;
  wallet_balance: number;
  name_changed_at?: string | null;
  username?: string | null;
};

export type UsernameAvailabilityOut = { username: string; available: boolean; reason?: string | null };
export type UserSearchResult = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar_url?: string | null;
  professional_profile_id?: string | null;
};

export type PayoutAccountOut = {
  id: string;
  bank_code: string;
  bank_name?: string | null;
  account_number: string;
  account_name: string;
  name_match: boolean;
  is_default: boolean;
  created_at: string;
};

export type KycOut = {
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  kyc_note?: string | null;
  kyc_verified_at?: string | null;
};

export type ClientPublicOut = {
  id: string;
  first_name: string;
  last_name: string;
  company_name?: string | null;
  company_logo_url?: string | null;
  company_description?: string | null;
  company_website?: string | null;
  industry?: string | null;
  is_verified_business: boolean;
  kyc_verified: boolean;
  payment_verified: boolean;
  completed_project_count: number;
  open_project_count: number;
  hire_rate?: number | null;
  member_since: string;
  preferred_categories?: string[] | null;
};

export type NotificationOut = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read_at?: string | null;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: UserOut;
};

export type CategoryOut = {
  id: string;
  label: string;
  icon: string;
  description?: string | null;
  professional_count: number;
  featured?: boolean;
};

export type PortfolioItemOut = {
  id: string;
  profile_id: string;
  title: string;
  description?: string | null;
  image_urls: string[];
  completed_date?: string | null;
  created_at: string;
};

export type EmploymentHistoryOut = {
  id: string;
  profile_id: string;
  title: string;
  employer: string;
  start_date: string;
  end_date?: string | null;
  description?: string | null;
};

export type EducationOut = {
  id: string;
  profile_id: string;
  school: string;
  degree?: string | null;
  field_of_study?: string | null;
  start_year?: number | null;
  end_year?: number | null;
};

export type BadgeVerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type CertificationOut = {
  id: string;
  profile_id: string;
  name: string;
  issuing_body?: string | null;
  issued_date?: string | null;
  expiry_date?: string | null;
  credential_url?: string | null;
  verification_status: BadgeVerificationStatus;
  verification_note?: string | null;
  badge_name?: string | null;
};

export type LanguageEntry = { name: string; level: string };

export type ProfessionalStats = {
  total_projects: number;
  completed_projects: number;
  job_success_rate?: number | null;
  member_since: string;
  response_time_label: string;
};

export type WorkHistoryItem = {
  project_id: string;
  project_title: string;
  client_name: string;
  client_company?: string | null;
  status: "open" | "in_progress" | "review" | "completed" | "cancelled";
  created_at: string;
  completed_at?: string | null;
  amount_range_label: string;
  review_rating?: number | null;
  review_comment?: string | null;
};

export type ProfessionalOut = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  title: string;
  category: CategoryOut;
  bio?: string | null;
  location?: string | null;
  hourly_rate?: number | null;
  years_experience?: string | null;
  availability: string;
  skills: string[];
  service_locations: string[];
  license_number?: string | null;
  is_verified: boolean;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  verification_note?: string | null;
  tier: 1 | 2 | 3;
  address_verification_status: BadgeVerificationStatus;
  address_verification_note?: string | null;
  bank_code?: string | null;
  rating: number;
  review_count: number;
  portfolio_items: PortfolioItemOut[];
  has_payout_details: boolean;
  employment_history: EmploymentHistoryOut[];
  education: EducationOut[];
  certifications: CertificationOut[];
  languages: LanguageEntry[];
  stats?: ProfessionalStats | null;
};

export type ProjectOut = {
  id: string;
  client_id: string;
  title: string;
  description: string;
  category: CategoryOut;
  location?: string | null;
  budget_min: number;
  budget_max: number;
  budget_type: "fixed" | "hourly";
  skills: string[];
  timeline?: string | null;
  image_urls: string[];
  video_url?: string | null;
  status: "open" | "in_progress" | "review" | "completed" | "cancelled";
  progress: number;
  assigned_professional_id?: string | null;
  closing_note?: string | null;
  created_at: string;
  bid_count: number;
  contract_amount?: number | null;
  milestones_total?: number;
  remaining_unallocated?: number | null;
  client_company_name?: string | null;
  client_is_verified_business: boolean;
  client_completed_project_count: number;
  client_kyc_verified: boolean;
  client_payment_verified: boolean;
  client_email_verified: boolean;
  client_member_since?: string | null;
  client_open_project_count: number;
  client_hire_rate?: number | null;
};

export type BidStatus = "pending" | "shortlisted" | "offered" | "accepted" | "rejected" | "withdrawn";

export type BidOut = {
  id: string;
  project_id: string;
  professional_id: string;
  amount: number;
  cover_letter?: string | null;
  estimated_days?: number | null;
  status: BidStatus;
  offered_amount?: number | null;
  offer_note?: string | null;
  created_at: string;
  project_title?: string | null;
  professional_name?: string | null;
  professional_profile_id?: string | null;
  professional_verification_status?: string | null;
  professional_tier?: 1 | 2 | 3 | null;
  professional_rating?: number | null;
  professional_review_count?: number | null;
  professional_portfolio_count?: number | null;
  professional_hourly_rate?: number | null;
};

export type InviteStatus = "pending" | "accepted" | "declined";

export type InviteOut = {
  id: string;
  project_id: string;
  professional_id: string;
  client_id: string;
  proposed_amount?: number | null;
  message?: string | null;
  status: InviteStatus;
  created_at: string;
  project_title?: string | null;
  professional_name?: string | null;
  client_name?: string | null;
};

export type AccessRequestType = "inspection" | "chat";
export type AccessRequestStatus = "pending" | "approved" | "rejected";

export type AccessRequestOut = {
  id: string;
  project_id: string;
  professional_id: string;
  client_id: string;
  request_type: AccessRequestType;
  status: AccessRequestStatus;
  note?: string | null;
  address?: string | null;
  phone?: string | null;
  details?: string | null;
  created_at: string;
  responded_at?: string | null;
  proposed_datetime?: string | null;
  proposed_by?: "client" | "professional" | null;
  schedule_status?: "awaiting_talent" | "awaiting_client" | "agreed" | null;
  scheduled_datetime?: string | null;
  project_title?: string | null;
  professional_name?: string | null;
  client_name?: string | null;
};

export type ContractStatus = "draft" | "sent_to_client" | "sent_to_professional" | "approved";

export type ContractOut = {
  id: string;
  project_id: string;
  bid_id?: string | null;
  client_id: string;
  professional_id: string;
  content: string;
  status: ContractStatus;
  client_approved: boolean;
  professional_approved: boolean;
  last_edited_by?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  project_title?: string | null;
};

export type ContractHistoryEntry = {
  version: number;
  content: string;
  edited_by?: string | null;
  edited_at?: string | null;
};

export type AdminContractRow = {
  id: string;
  project_id: string;
  project_title?: string | null;
  client_id: string;
  client_name?: string | null;
  professional_id: string;
  professional_name?: string | null;
  status: ContractStatus;
  client_approved: boolean;
  professional_approved: boolean;
  version: number;
  updated_at: string;
  approved_at?: string | null;
  acceptance_fee_paid: boolean;
  stalled: boolean;
  escalated: boolean;
};

export type AcceptanceFeeRule = {
  skill_level?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  amount: number;
};

export type AcceptanceFeeSettings = {
  mode: "general" | "rule_based";
  general_amount: number;
  rules: AcceptanceFeeRule[];
};

export type AcceptanceFeeQuote = {
  amount: number;
  paid: boolean;
  wallet_balance: number;
};

export type MilestoneStatus = "pending" | "in_progress" | "submitted" | "approved" | "funded" | "paid" | "refunded" | "rejected";

export type MilestoneUpdateOut = {
  id: string;
  milestone_id: string;
  created_by: string;
  author_name?: string | null;
  note?: string | null;
  photo_urls: string[];
  created_at: string;
};

export type MilestoneOut = {
  id: string;
  project_id: string;
  created_by?: string | null;
  created_by_name?: string | null;
  title: string;
  description?: string | null;
  amount: number;
  due_date?: string | null;
  status: MilestoneStatus;
  sort_order: number;
  created_at: string;
  submitted_at?: string | null;
  platform_fee_percent: number;
  net_to_professional: number;
  rejection_note?: string | null;
  rejected_at?: string | null;
  withholding_percent: number;
  withholding_release_days: number;
  withheld_amount?: number | null;
  withheld_release_at?: string | null;
  withheld_released_at?: string | null;
  updates: MilestoneUpdateOut[];
};

export type PaymentPolicyOut = {
  withholding_percent: number;
  withholding_release_days: number;
};

export type PendingHoldbackOut = {
  total_pending: number;
  count: number;
  next_release_at?: string | null;
};

export type ChangeOrderOut = {
  id: string;
  project_id: string;
  proposed_by: string;
  description: string;
  amount_delta: number;
  status: "proposed" | "approved" | "rejected";
  resulting_milestone_id?: string | null;
  created_at: string;
};

export type WalletTransactionOut = {
  id: string;
  project_id?: string | null;
  milestone_id?: string | null;
  client_id?: string | null;
  professional_id?: string | null;
  type: "topup" | "funding" | "release" | "refund" | "withdrawal";
  status: "pending" | "successful" | "failed";
  amount: number;
  platform_fee: number;
  monnify_reference?: string | null;
  note?: string | null;
  created_at: string;
  project_title?: string | null;
};

export type MessageType = "text" | "image" | "voice" | "file" | "update" | "system";

export type ReplyPreview = {
  id: string;
  sender_id: string;
  sender_name?: string | null;
  body: string;
  message_type: MessageType;
  attachment_url?: string | null;
  is_deleted: boolean;
};

export type ReactionSummary = {
  emoji: string;
  count: number;
  mine: boolean;
  user_names: string[];
};

export type MessageOut = {
  id: string;
  project_id?: string | null;
  sender_id: string;
  recipient_id: string;
  body: string;
  attachment_url?: string | null;
  message_type: MessageType;
  duration_seconds?: number | null;
  is_read: boolean;
  is_deleted: boolean;
  edited_at?: string | null;
  created_at: string;
  sender_name?: string | null;
  reply_to?: ReplyPreview | null;
  reactions: ReactionSummary[];
};

export type ThreadOut = {
  project_id: string;
  project_title: string;
  other_user_id: string;
  other_user_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
};

export type ReviewOut = {
  id: string;
  project_id: string;
  reviewer_id: string;
  reviewer_name?: string | null;
  reviewee_id: string;
  rating: number;
  comment?: string | null;
  response_body?: string | null;
  responded_at?: string | null;
  created_at: string;
};

export type FavoriteTargetType = "professional" | "project";

export type FavoriteOut = {
  id: string;
  target_type: FavoriteTargetType;
  target_id: string;
  created_at: string;
};

export type DisputeCategory = "payment" | "quality" | "non_delivery" | "scope_disagreement" | "unresponsive" | "other";
export type DisputeStatus = "open" | "under_review" | "escalated" | "resolved" | "withdrawn";
export type DisputeOutcome = "refund_client" | "release_professional" | "partial_split" | "no_action";
export type ProposalStatus = "none" | "pending" | "accepted" | "declined" | "expired";

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  payment: "Payment issue",
  quality: "Quality of work",
  non_delivery: "Work not delivered",
  scope_disagreement: "Scope disagreement",
  unresponsive: "Unresponsive party",
  other: "Other",
};

export const DISPUTE_OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  refund_client: "Refund the client",
  release_professional: "Release funds to professional",
  partial_split: "Partial split",
  no_action: "No fund action needed",
};

export type DisputeOut = {
  id: string;
  project_id: string;
  project_title?: string | null;
  milestone_id?: string | null;
  milestone_title?: string | null;
  milestone_amount?: number | null;
  milestone_status?: string | null;
  category: DisputeCategory;
  raised_by: string;
  raised_by_name?: string | null;
  other_party_id?: string | null;
  other_party_name?: string | null;
  reason: string;
  evidence_urls: string[];
  status: DisputeStatus;
  outcome?: DisputeOutcome | null;
  resolution_note?: string | null;
  resolved_by_name?: string | null;
  resolved_at?: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  proposal_status: ProposalStatus;
  proposed_outcome?: DisputeOutcome | null;
  proposed_split_amount?: number | null;
  proposed_by?: string | null;
  proposed_by_name?: string | null;
  proposal_note?: string | null;
  proposal_expires_at?: string | null;
};

export type DisputeMessageOut = {
  id: string;
  sender_id: string;
  sender_name?: string | null;
  is_admin: boolean;
  body: string;
  created_at: string;
};

export type DisputeEventOut = {
  id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  from_status?: string | null;
  to_status: string;
  note?: string | null;
  created_at: string;
};

export type DisputeDetailOut = DisputeOut & {
  messages: DisputeMessageOut[];
  events: DisputeEventOut[];
};

export type AdminUserOut = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  is_verified_business: boolean;
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  email_verified: boolean;
  wallet_balance: number;
  company_name?: string | null;
  professional_tier?: 1 | 2 | 3 | null;
  created_at: string;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  business_verification_status?: "unverified" | "pending" | "verified" | "rejected";
};

export type AdminProjectOut = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "review" | "completed" | "cancelled";
  client_id: string;
  client_name?: string | null;
  assigned_professional_id?: string | null;
  assigned_professional_name?: string | null;
  bid_count: number;
  progress: number;
  budget_min: number;
  budget_max: number;
  created_at: string;
  has_open_dispute: boolean;
};

export type AdminProjectParty = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
};

export type AdminProjectFinancials = {
  total_funded: number;
  total_released: number;
  total_refunded: number;
  in_escrow: number;
  platform_fees: number;
};

export type AdminWalletTransactionOut = {
  id: string;
  project_id?: string | null;
  project_title?: string | null;
  milestone_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  professional_id?: string | null;
  professional_name?: string | null;
  type: "topup" | "funding" | "release" | "refund" | "withdrawal" | "adjustment";
  status: "pending" | "successful" | "failed";
  amount: number;
  platform_fee: number;
  monnify_reference?: string | null;
  note?: string | null;
  created_at: string;
};

export type AdminWalletTxFilters = {
  type_filter?: string;
  status_filter?: string;
  project_id?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  q?: string;
};

export type AdminWalletSummary = {
  total_funded: number;
  total_released: number;
  total_refunded: number;
  total_in_escrow: number;
  total_platform_fees: number;
  total_topped_up: number;
  total_withdrawn: number;
  total_held_in_disputes: number;
  pending_transaction_count: number;
  failed_transaction_count: number;
  stuck_pending_count: number;
};

export type AdminUserDetailOut = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string | null;
  company_name?: string | null;
  industry?: string | null;
  company_logo_url?: string | null;
  company_description?: string | null;
  company_website?: string | null;
  is_verified_business: boolean;
  wallet_balance: number;
  created_at: string;
  professional_profile?: ProfessionalOut | null;
  bids: BidOut[];
  projects: ProjectOut[];
};

export type AdminProjectDetailOut = {
  project: ProjectOut;
  client?: AdminProjectParty | null;
  professional?: AdminProjectParty | null;
  bids: BidOut[];
  milestones: MilestoneOut[];
  disputes: DisputeOut[];
  financials: AdminProjectFinancials;
  wallet_transactions: AdminWalletTransactionOut[];
};

export type PlatformSettingOut = {
  key: string;
  value: string;
  value_type: string;
  updated_at: string;
};

export type ReceiptTemplate = "classic" | "modern" | "minimal";
export type ReceiptFont = "sans" | "serif" | "mono";
export type ReceiptSettingsOut = {
  template: ReceiptTemplate;
  primary_color: string;
  accent_color: string;
  font: ReceiptFont;
  company_name: string;
  tagline: string;
  logo_url?: string | null;
  footer_note: string;
};
export type ReceiptSettingsIn = Partial<ReceiptSettingsOut>;

export type ProjectMediaSettingsOut = {
  images_enabled: boolean;
  image_max_mb: number;
  video_enabled: boolean;
  video_max_mb: number;
};
export type ProjectMediaSettingsIn = Partial<ProjectMediaSettingsOut>;

export type AnalyticsOverview = {
  signups_this_week: number;
  signups_this_month: number;
  total_users: number;
  professional_count: number;
  client_count: number;
  active_projects: number;
  total_projects: number;
  completed_projects: number;
  open_disputes: number;
  pending_verifications: number;
  gmv: number;
  platform_revenue: number;
};

export type PendingVerification = {
  profile_id: string;
  user_id: string;
  name: string;
  title: string;
  email?: string | null;
  phone?: string | null;
  category?: string | null;
  location?: string | null;
  bio?: string | null;
  years_experience?: string | null;
  license_number?: string | null;
  skills?: string[];
  nin?: string | null;
  kyc_status?: string | null;
  id_document_url?: string | null;
  license_document_url?: string | null;
  insurance_document_url?: string | null;
};

export type PendingAddressVerification = {
  profile_id: string;
  user_id: string;
  name: string;
  title: string;
  email?: string | null;
  phone?: string | null;
  category?: string | null;
  location?: string | null;
  bio?: string | null;
  kyc_status?: string | null;
  address_document_url: string;
};

export type PendingCertification = {
  id: string;
  profile_id: string;
  user_id: string;
  name: string;
  issuing_body?: string | null;
  credential_url?: string | null;
  professional_name?: string | null;
  professional_title?: string | null;
  category?: string | null;
  email?: string | null;
  issued_date?: string | null;
  expiry_date?: string | null;
  submitted_at?: string | null;
  badge_name?: string | null;
};

export type PendingBusinessVerification = {
  user_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  company_website?: string | null;
  cac_number?: string | null;
  cac_document_url?: string | null;
};

export type ContentPageOut = {
  id: string;
  slug: string;
  title: string;
  body: string;
  updated_by?: string | null;
  updated_at: string;
};

export type BlogPostOut = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body: string;
  cover_image_url?: string | null;
  author_name?: string | null;
  published: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type HighlightOut = {
  id: string;
  type: "testimonial" | "stat" | "banner";
  title: string;
  body?: string | null;
  image_url?: string | null;
  sort_order: number;
  active: boolean;
};

export type FaqItemOut = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  active: boolean;
  updated_at: string;
};

export const api = {
  adminUsers: (params?: { role?: UserRole; q?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    return request<AdminUserOut[]>(`/admin/users${qs ? `?${qs}` : ""}`);
  },
  updateAdminUser: (id: string, payload: { is_active?: boolean; is_verified?: boolean; is_verified_business?: boolean }) =>
    request<AdminUserOut>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  suspendUser: (id: string, payload: { duration_days?: number; until_further_notice?: boolean; forever?: boolean; reason?: string }) =>
    request<AdminUserOut>(`/admin/users/${id}/suspend`, { method: "POST", body: JSON.stringify(payload) }),
  unsuspendUser: (id: string) => request<AdminUserOut>(`/admin/users/${id}/unsuspend`, { method: "POST" }),
  adminUserDetail: (id: string) => request<AdminUserDetailOut>(`/admin/users/${id}`),
  adjustWallet: (userId: string, payload: { amount: number; note?: string }) =>
    request<AdminWalletTransactionOut>(`/admin/users/${userId}/wallet`, { method: "POST", body: JSON.stringify(payload) }),
  sendAnnouncement: (payload: { title: string; body?: string; link?: string }) =>
    request<{ sent: number }>("/admin/announcements", { method: "POST", body: JSON.stringify(payload) }),
  adminProjects: (params?: { status_filter?: string; q?: string; has_dispute?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    return request<AdminProjectOut[]>(`/admin/projects${qs ? `?${qs}` : ""}`);
  },
  adminProjectsCount: (params?: { status_filter?: string; q?: string; has_dispute?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    return request<{ total: number }>(`/admin/projects/count${qs ? `?${qs}` : ""}`);
  },
  adminProjectDetail: (id: string) => request<AdminProjectDetailOut>(`/admin/projects/${id}`),
  cancelAdminProject: (id: string) =>
    request<AdminProjectOut>(`/admin/projects/${id}/cancel`, { method: "PATCH" }),
  adminWalletSummary: () => request<AdminWalletSummary>("/admin/wallet/summary"),
  adminWalletTransactions: (params?: AdminWalletTxFilters & { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    return request<AdminWalletTransactionOut[]>(`/admin/wallet/transactions${qs ? `?${qs}` : ""}`);
  },
  adminWalletTransactionsCount: (params?: AdminWalletTxFilters) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    return request<{ total: number }>(`/admin/wallet/transactions/count${qs ? `?${qs}` : ""}`);
  },
  exportWalletTransactions: async (params?: AdminWalletTxFilters): Promise<void> => {
    const token = getToken();
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string][]
    ).toString();
    const res = await fetch(`${API_BASE}/admin/wallet/transactions/export${qs ? `?${qs}` : ""}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, "Could not export transactions");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yh-connect-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  adminDisputes: (params?: { status_filter?: string; category_filter?: string; q?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => !!v) as [string, string][]
    ).toString();
    return request<DisputeOut[]>(`/admin/disputes${qs ? `?${qs}` : ""}`);
  },
  adminDisputeDetail: (id: string) => request<DisputeDetailOut>(`/admin/disputes/${id}`),
  resolveDispute: (
    id: string,
    payload: { status: DisputeStatus; outcome?: DisputeOutcome; resolution_note?: string; split_professional_amount?: number },
  ) => request<DisputeDetailOut>(`/disputes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminSettings: () => request<PlatformSettingOut[]>("/admin/settings"),
  updateAdminSettings: (settings: Record<string, string>) =>
    request<PlatformSettingOut[]>("/admin/settings", { method: "PATCH", body: JSON.stringify({ settings }) }),
  receiptSettings: () => request<ReceiptSettingsOut>("/admin/receipt-settings"),
  updateReceiptSettings: (payload: ReceiptSettingsIn) =>
    request<ReceiptSettingsOut>("/admin/receipt-settings", { method: "PUT", body: JSON.stringify(payload) }),
  adminProjectMediaSettings: () => request<ProjectMediaSettingsOut>("/admin/project-media-settings"),
  updateAdminProjectMediaSettings: (payload: ProjectMediaSettingsIn) =>
    request<ProjectMediaSettingsOut>("/admin/project-media-settings", { method: "PUT", body: JSON.stringify(payload) }),
  previewReceipt: async (): Promise<void> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/admin/receipt-settings/preview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, "Could not generate preview");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank");
  },
  adminAnalyticsOverview: () => request<AnalyticsOverview>("/admin/analytics/overview"),
  registerAdmin: (payload: { email: string; password: string; first_name: string; last_name: string }) =>
    request<{ access_token: string; user: UserOut }>("/admin/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  pendingVerifications: () => request<PendingVerification[]>("/admin/verifications"),
  reviewVerification: (profileId: string, payload: { status: "verified" | "rejected"; note?: string }) =>
    request<{ verification_status: string }>(`/admin/verifications/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  siteContent: () => request<Record<string, unknown>>("/site-content"),
  adminSiteContent: () => request<{ key: string; data: Record<string, unknown>; updated_at: string }[]>("/admin/site-content"),
  updateSiteContentBlock: (key: string, data: Record<string, unknown>) =>
    request<{ key: string; data: Record<string, unknown>; updated_at: string }>(`/admin/site-content/${key}`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    }),
  resetSiteContentBlock: (key: string) => request<void>(`/admin/site-content/${key}`, { method: "DELETE" }),

  contentPage: (slug: string) => request<ContentPageOut>(`/content/pages/${slug}`),
  publishedBlogPosts: () => request<BlogPostOut[]>("/content/blog"),
  blogPost: (slug: string) => request<BlogPostOut>(`/content/blog/${slug}`),
  activeHighlights: () => request<HighlightOut[]>("/content/highlights"),

  adminContentPages: () => request<ContentPageOut[]>("/admin/content/pages"),
  upsertContentPage: (payload: { slug: string; title: string; body: string }) =>
    request<ContentPageOut>("/admin/content/pages", { method: "POST", body: JSON.stringify(payload) }),
  patchContentPage: (id: string, payload: { title?: string; body?: string }) =>
    request<ContentPageOut>(`/admin/content/pages/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteContentPage: (id: string) => request<void>(`/admin/content/pages/${id}`, { method: "DELETE" }),

  adminBlogPosts: () => request<BlogPostOut[]>("/admin/content/blog"),
  createBlogPost: (payload: Partial<BlogPostOut> & { slug: string; title: string }) =>
    request<BlogPostOut>("/admin/content/blog", { method: "POST", body: JSON.stringify(payload) }),
  patchBlogPost: (id: string, payload: Partial<BlogPostOut>) =>
    request<BlogPostOut>(`/admin/content/blog/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteBlogPost: (id: string) => request<void>(`/admin/content/blog/${id}`, { method: "DELETE" }),

  adminHighlights: () => request<HighlightOut[]>("/admin/content/highlights"),
  createHighlight: (payload: { type: string; title: string; body?: string; image_url?: string; sort_order?: number; active?: boolean }) =>
    request<HighlightOut>("/admin/content/highlights", { method: "POST", body: JSON.stringify(payload) }),
  patchHighlight: (id: string, payload: Partial<HighlightOut>) =>
    request<HighlightOut>(`/admin/content/highlights/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteHighlight: (id: string) => request<void>(`/admin/content/highlights/${id}`, { method: "DELETE" }),
  activeFaq: () => request<FaqItemOut[]>("/content/faq"),
  adminFaq: () => request<FaqItemOut[]>("/admin/content/faq"),
  createFaqItem: (payload: { question: string; answer: string; category?: string; sort_order?: number; active?: boolean }) =>
    request<FaqItemOut>("/admin/content/faq", { method: "POST", body: JSON.stringify(payload) }),
  patchFaqItem: (id: string, payload: Partial<{ question: string; answer: string; category: string; sort_order: number; active: boolean }>) =>
    request<FaqItemOut>(`/admin/content/faq/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteFaqItem: (id: string) => request<void>(`/admin/content/faq/${id}`, { method: "DELETE" }),

  createCategory: (payload: { id: string; label: string; icon?: string; description?: string }) =>
    request<CategoryOut>("/admin/categories", { method: "POST", body: JSON.stringify(payload) }),
  patchCategory: (id: string, payload: { label?: string; icon?: string; description?: string }) =>
    request<CategoryOut>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCategory: (id: string) => request<void>(`/admin/categories/${id}`, { method: "DELETE" }),
  registerClient: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    company_name?: string;
    industry?: string;
  }) => request<AuthResponse>("/auth/register/client", { method: "POST", body: JSON.stringify(payload) }),

  registerProfessional: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    title: string;
    category_id: string;
    bio?: string;
    location?: string;
    hourly_rate?: number;
    years_experience?: string;
    skills: string[];
    license_number?: string;
  }) => request<AuthResponse>("/auth/register/professional", { method: "POST", body: JSON.stringify(payload) }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: () => request<UserOut>("/auth/me"),
  updateMe: (payload: { first_name?: string; last_name?: string; phone?: string; avatar_url?: string; email_notifications_enabled?: boolean; username?: string }) =>
    request<UserOut>("/auth/me", { method: "PATCH", body: JSON.stringify(payload) }),
  usernameSuggestions: () => request<{ suggestions: string[] }>("/auth/username/suggestions"),
  checkUsername: (username: string) =>
    request<UsernameAvailabilityOut>(`/auth/username/check?username=${encodeURIComponent(username)}`),
  searchUsers: (q: string) => request<UserSearchResult[]>(`/auth/users/search?q=${encodeURIComponent(q)}`),

  switchRole: (targetRole: "client" | "professional") =>
    request<AuthResponse>("/auth/switch-role", { method: "POST", body: JSON.stringify({ target_role: targetRole }) }),
  becomeTalent: (payload: {
    title: string;
    category_id: string;
    bio?: string;
    location?: string;
    hourly_rate?: number;
    years_experience?: string;
    skills: string[];
    license_number?: string;
  }) => request<AuthResponse>("/auth/become-talent", { method: "POST", body: JSON.stringify(payload) }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, new_password: string) =>
    request<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password }) }),
  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  resendVerification: () =>
    request<{ message: string }>("/auth/resend-verification", { method: "POST" }),
  changePassword: (current_password: string, new_password: string) =>
    request<AuthResponse>("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) }),
  logoutEverywhere: () =>
    request<AuthResponse>("/auth/logout-everywhere", { method: "POST" }),

  notifications: () => request<NotificationOut[]>("/notifications"),
  unreadNotificationCount: () => request<{ count: number }>("/notifications/unread-count"),
  markNotificationRead: (id: string) => request<NotificationOut>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<{ message: string }>("/notifications/read-all", { method: "POST" }),
  deleteNotification: (id: string) => request<{ message: string }>(`/notifications/${id}`, { method: "DELETE" }),
  clearNotifications: () => request<{ message: string }>("/notifications", { method: "DELETE" }),

  categories: () => request<CategoryOut[]>("/categories"),

  professionals: (params?: { category_id?: string; location?: string; q?: string; min_rating?: number; sort_by?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])
    ).toString();
    return request<ProfessionalOut[]>(`/professionals${qs ? `?${qs}` : ""}`);
  },
  myProfile: () => request<ProfessionalOut>("/professionals/me"),
  professional: (id: string) => request<ProfessionalOut>(`/professionals/${id}`),
  updateMyProfile: (payload: {
    title?: string;
    category_id?: string;
    bio?: string;
    location?: string;
    hourly_rate?: number;
    years_experience?: string;
    availability?: string;
    skills?: string[];
    license_number?: string;
    service_locations?: string[];
    languages?: LanguageEntry[];
  }) => request<ProfessionalOut>("/professionals/me", { method: "PATCH", body: JSON.stringify(payload) }),
  workHistory: (profileId: string) => request<WorkHistoryItem[]>(`/professionals/${profileId}/work-history`),

  addEmployment: (payload: { title: string; employer: string; start_date: string; end_date?: string; description?: string }) =>
    request<EmploymentHistoryOut>("/professionals/me/employment", { method: "POST", body: JSON.stringify(payload) }),
  deleteEmployment: (id: string) => request<void>(`/professionals/me/employment/${id}`, { method: "DELETE" }),

  addEducation: (payload: { school: string; degree?: string; field_of_study?: string; start_year?: number; end_year?: number }) =>
    request<EducationOut>("/professionals/me/education", { method: "POST", body: JSON.stringify(payload) }),
  deleteEducation: (id: string) => request<void>(`/professionals/me/education/${id}`, { method: "DELETE" }),

  addCertification: (payload: { name: string; issuing_body?: string; issued_date?: string; expiry_date?: string; credential_url?: string }) =>
    request<CertificationOut>("/professionals/me/certifications", { method: "POST", body: JSON.stringify(payload) }),
  deleteCertification: (id: string) => request<void>(`/professionals/me/certifications/${id}`, { method: "DELETE" }),

  projects: (params?: { category_id?: string; client_id?: string; status_filter?: string; q?: string; location?: string; budget_min?: number; budget_max?: number; sort_by?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {})
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return request<ProjectOut[]>(`/projects${qs ? `?${qs}` : ""}`);
  },
  myProjects: () => request<ProjectOut[]>("/projects/mine"),
  project: (id: string) => request<ProjectOut>(`/projects/${id}`),
  reportProject: (id: string, reason: string, details?: string) =>
    request<{ id: string; project_id: string; reporter_id: string; reason: string; details?: string | null; created_at: string }>(
      `/projects/${id}/report`,
      { method: "POST", body: JSON.stringify({ reason, details }) }
    ),
  createProject: (payload: {
    title: string;
    description: string;
    category_id: string;
    location?: string;
    budget_min: number;
    budget_max: number;
    budget_type: "fixed" | "hourly";
    skills: string[];
    timeline?: string;
    image_urls?: string[];
    video_url?: string | null;
  }) => request<ProjectOut>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  projectMediaSettings: () => request<ProjectMediaSettingsOut>("/projects/media-settings"),
  closeProject: (id: string) => request<ProjectOut>(`/projects/${id}/close`, { method: "POST" }),
  completeProject: (id: string) => request<ProjectOut>(`/projects/${id}/complete`, { method: "POST" }),
  confirmProject: (id: string) => request<ProjectOut>(`/projects/${id}/confirm`, { method: "POST" }),
  reopenProject: (id: string) => request<ProjectOut>(`/projects/${id}/reopen`, { method: "POST" }),
  closingNote: (id: string, note: string) =>
    request<ProjectOut>(`/projects/${id}/closing-note`, { method: "POST", body: JSON.stringify({ note }) }),
  updateProject: (id: string, payload: {
    title?: string;
    description?: string;
    location?: string;
    category_id?: string;
    budget_min?: number;
    budget_max?: number;
    budget_type?: "fixed" | "hourly";
    skills?: string[];
    timeline?: string;
    image_urls?: string[];
    video_url?: string | null;
  }) => request<ProjectOut>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  createBid: (projectId: string, payload: { amount: number; cover_letter?: string; estimated_days?: number }) =>
    request<BidOut>(`/projects/${projectId}/bids`, { method: "POST", body: JSON.stringify(payload) }),
  projectBids: (projectId: string) => request<BidOut[]>(`/projects/${projectId}/bids`),
  myBids: () => request<BidOut[]>("/bids/mine"),
  updateBid: (bidId: string, status: BidStatus, extra?: { offered_amount?: number; offer_note?: string }) =>
    request<BidOut>(`/bids/${bidId}`, { method: "PATCH", body: JSON.stringify({ status, ...extra }) }),
  withdrawBid: (bidId: string) => request<BidOut>(`/bids/${bidId}`, { method: "DELETE" }),
  confirmOffer: (bidId: string, note?: string) =>
    request<BidOut>(`/bids/${bidId}/confirm-offer`, { method: "POST", body: JSON.stringify({ note }) }),
  declineOffer: (bidId: string, note?: string) =>
    request<BidOut>(`/bids/${bidId}/decline-offer`, { method: "POST", body: JSON.stringify({ note }) }),

  createInvite: (projectId: string, payload: { professional_id: string; proposed_amount?: number; message?: string }) =>
    request<InviteOut>(`/projects/${projectId}/invite`, { method: "POST", body: JSON.stringify(payload) }),
  projectInvites: (projectId: string) => request<InviteOut[]>(`/projects/${projectId}/invites`),
  myInvites: () => request<InviteOut[]>("/invites/mine"),
  respondToInvite: (inviteId: string, status: "accepted" | "declined") =>
    request<InviteOut>(`/invites/${inviteId}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  createAccessRequest: (projectId: string, payload: { request_type: AccessRequestType; note?: string }) =>
    request<AccessRequestOut>(`/projects/${projectId}/access-requests`, { method: "POST", body: JSON.stringify(payload) }),
  projectAccessRequests: (projectId: string) => request<AccessRequestOut[]>(`/projects/${projectId}/access-requests`),
  myAccessRequests: () => request<AccessRequestOut[]>("/access-requests/mine"),
  respondToAccessRequest: (
    requestId: string,
    payload: { status: "approved" | "rejected"; address?: string; phone?: string; details?: string; proposed_datetime?: string }
  ) => request<AccessRequestOut>(`/access-requests/${requestId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  respondToSchedule: (requestId: string, payload: { action: "accept" | "counter"; datetime?: string }) =>
    request<AccessRequestOut>(`/access-requests/${requestId}/schedule`, { method: "POST", body: JSON.stringify(payload) }),

  getProjectContract: (projectId: string) => request<ContractOut>(`/projects/${projectId}/contract`),
  editContract: (contractId: string, content: string) =>
    request<ContractOut>(`/contracts/${contractId}`, { method: "PATCH", body: JSON.stringify({ content }) }),
  sendContract: (contractId: string) => request<ContractOut>(`/contracts/${contractId}/send`, { method: "POST" }),
  approveContract: (contractId: string) => request<ContractOut>(`/contracts/${contractId}/approve`, { method: "POST" }),
  contractHistory: (contractId: string) => request<ContractHistoryEntry[]>(`/contracts/${contractId}/history`),

  getAcceptanceFeeQuote: (projectId: string) => request<AcceptanceFeeQuote>(`/projects/${projectId}/acceptance-fee`),
  payAcceptanceFee: (projectId: string) =>
    request<{ transaction_id: string; amount: number; wallet_balance: number }>(`/projects/${projectId}/acceptance-fee/pay`, { method: "POST" }),
  adminGetAcceptanceFeeSettings: () => request<AcceptanceFeeSettings>("/admin/settings/acceptance-fee"),
  adminSaveAcceptanceFeeSettings: (payload: Partial<AcceptanceFeeSettings>) =>
    request<AcceptanceFeeSettings>("/admin/settings/acceptance-fee", { method: "PUT", body: JSON.stringify(payload) }),
  adminListContracts: () => request<AdminContractRow[]>("/admin/contracts"),
  adminNudgeContract: (contractId: string) =>
    request<{ notified: number }>(`/admin/contracts/${contractId}/nudge`, { method: "POST" }),

  milestones: (projectId: string) => request<MilestoneOut[]>(`/projects/${projectId}/milestones`),
  createMilestone: (projectId: string, payload: { title: string; description?: string; amount: number; due_date?: string }) =>
    request<MilestoneOut>(`/projects/${projectId}/milestones`, { method: "POST", body: JSON.stringify(payload) }),
  postMilestoneUpdate: (milestoneId: string, payload: { note?: string; photo_urls?: string[] }) =>
    request<MilestoneUpdateOut>(`/milestones/${milestoneId}/updates`, { method: "POST", body: JSON.stringify(payload) }),
  submitMilestone: (milestoneId: string) => request<MilestoneOut>(`/milestones/${milestoneId}/submit`, { method: "POST" }),
  approveMilestone: (milestoneId: string) => request<MilestoneOut>(`/milestones/${milestoneId}/approve`, { method: "POST" }),
  rejectMilestone: (milestoneId: string, note: string) =>
    request<MilestoneOut>(`/milestones/${milestoneId}/reject`, { method: "POST", body: JSON.stringify({ note }) }),

  changeOrders: (projectId: string) => request<ChangeOrderOut[]>(`/projects/${projectId}/change-orders`),
  createChangeOrder: (projectId: string, payload: { description: string; amount_delta: number }) =>
    request<ChangeOrderOut>(`/projects/${projectId}/change-orders`, { method: "POST", body: JSON.stringify(payload) }),
  updateChangeOrder: (changeOrderId: string, status: "approved" | "rejected") =>
    request<ChangeOrderOut>(`/change-orders/${changeOrderId}?status=${status}`, { method: "PATCH" }),

  topupWallet: (amount: number, redirectUrl?: string) =>
    request<{ transaction_id: string; monnify_reference: string; checkout_url?: string | null; reserved_account?: unknown; amount: number; wallet_balance: number }>(
      "/wallet/topup",
      { method: "POST", body: JSON.stringify({ amount, redirect_url: redirectUrl }) }
    ),
  fundMilestone: (milestoneId: string, redirectUrl?: string) =>
    request<{ transaction_id: string; monnify_reference: string; checkout_url?: string | null; reserved_account?: unknown; amount: number }>(
      `/milestones/${milestoneId}/fund`,
      { method: "POST", body: JSON.stringify({ redirect_url: redirectUrl }) }
    ),
  withdrawWallet: (amount: number) =>
    request<{ transaction_id: string; amount: number; wallet_balance: number; status: string }>(
      "/wallet/withdraw",
      { method: "POST", body: JSON.stringify({ amount }) }
    ),
  walletTransactions: () => request<WalletTransactionOut[]>("/wallet/transactions"),
  paymentPolicy: () => request<PaymentPolicyOut>("/wallet/payment-policy"),
  pendingHoldbacks: () => request<PendingHoldbackOut>("/wallet/pending-holdbacks"),
  payoutAccounts: () => request<PayoutAccountOut[]>("/professionals/me/payout-accounts"),
  addPayoutAccount: (payload: { bank_code: string; bank_name?: string; account_number: string }) =>
    request<PayoutAccountOut>("/professionals/me/payout-accounts", { method: "POST", body: JSON.stringify(payload) }),
  setDefaultPayoutAccount: (accountId: string) =>
    request<PayoutAccountOut>(`/professionals/me/payout-accounts/${accountId}/default`, { method: "PATCH" }),
  deletePayoutAccount: (accountId: string) =>
    request<void>(`/professionals/me/payout-accounts/${accountId}`, { method: "DELETE" }),

  submitVerification: (payload: { id_document_url?: string; license_document_url?: string; insurance_document_url?: string }) =>
    request<{ verification_status: string }>("/professionals/me/verification", { method: "POST", body: JSON.stringify(payload) }),

  myProfessionalKyc: () => request<KycOut>("/professionals/me/kyc"),
  submitProfessionalKyc: (payload: { nin: string; dob: string; document_url?: string }) =>
    request<KycOut>("/professionals/me/kyc", { method: "POST", body: JSON.stringify(payload) }),
  submitAddressVerification: (documentUrl: string) =>
    request<{ address_verification_status: BadgeVerificationStatus }>("/professionals/me/address-verification", {
      method: "POST",
      body: JSON.stringify({ document_url: documentUrl }),
    }),
  adminPendingAddressVerifications: () =>
    request<PendingAddressVerification[]>("/admin/address-verifications"),
  adminReviewAddressVerification: (profileId: string, status: "verified" | "rejected", note?: string) =>
    request<{ address_verification_status: string }>(`/admin/address-verifications/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),
  adminPendingCertifications: () => request<PendingCertification[]>("/admin/certifications"),
  adminReviewCertification: (certificationId: string, status: "verified" | "rejected", note?: string, badgeName?: string) =>
    request<{ verification_status: string }>(`/admin/certifications/${certificationId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note, badge_name: badgeName }),
    }),
  submitBusinessVerification: (cacNumber: string, cacDocumentUrl: string) =>
    request<{ business_verification_status: string }>("/clients/me/business-verification", {
      method: "POST",
      body: JSON.stringify({ cac_number: cacNumber, cac_document_url: cacDocumentUrl }),
    }),
  adminPendingBusinessVerifications: () => request<PendingBusinessVerification[]>("/admin/business-verifications"),
  adminReviewBusinessVerification: (userId: string, status: "verified" | "rejected", note?: string) =>
    request<{ business_verification_status: string }>(`/admin/business-verifications/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),

  addPortfolioItem: (payload: { title: string; description?: string; image_urls?: string[]; completed_date?: string }) =>
    request<PortfolioItemOut>("/professionals/me/portfolio", { method: "POST", body: JSON.stringify(payload) }),
  deletePortfolioItem: (itemId: string) => request<void>(`/professionals/me/portfolio/${itemId}`, { method: "DELETE" }),

  createDispute: (payload: { project_id: string; milestone_id?: string; category: DisputeCategory; reason: string; evidence_urls?: string[] }) =>
    request<DisputeOut>("/disputes", { method: "POST", body: JSON.stringify(payload) }),
  myDisputes: () => request<DisputeOut[]>("/disputes/mine"),
  disputeDetail: (id: string) => request<DisputeDetailOut>(`/disputes/${id}`),
  addDisputeMessage: (id: string, body: string) =>
    request<DisputeMessageOut>(`/disputes/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  withdrawDispute: (id: string) => request<DisputeOut>(`/disputes/${id}/withdraw`, { method: "POST" }),
  proposeResolution: (id: string, payload: { outcome: DisputeOutcome; split_professional_amount?: number; note?: string }) =>
    request<DisputeOut>(`/disputes/${id}/propose-resolution`, { method: "POST", body: JSON.stringify(payload) }),
  respondProposal: (id: string, accept: boolean, note?: string) =>
    request<DisputeDetailOut>(`/disputes/${id}/respond-proposal`, { method: "POST", body: JSON.stringify({ accept, note }) }),

  messageThreads: () => request<ThreadOut[]>("/messages/threads"),
  unreadMessageCount: () => request<{ count: number }>("/messages/unread-count"),
  projectMessages: (projectId: string, otherUserId?: string, after?: string) => {
    const qs = new URLSearchParams();
    if (otherUserId) qs.set("other_user_id", otherUserId);
    if (after) qs.set("after", after);
    const s = qs.toString();
    return request<MessageOut[]>(`/projects/${projectId}/messages${s ? `?${s}` : ""}`);
  },
  sendProjectMessage: (
    projectId: string,
    payload: {
      recipient_id: string;
      body: string;
      attachment_url?: string;
      message_type?: MessageType;
      duration_seconds?: number;
      reply_to_id?: string;
    }
  ) => request<MessageOut>(`/projects/${projectId}/messages`, { method: "POST", body: JSON.stringify(payload) }),
  markThreadRead: (projectId: string, otherUserId: string) =>
    request<{ status: string }>(`/projects/${projectId}/messages/read?other_user_id=${otherUserId}`, { method: "POST" }),
  reactToMessage: (messageId: string, emoji: string) =>
    request<MessageOut>(`/messages/${messageId}/react`, { method: "POST", body: JSON.stringify({ emoji }) }),
  editMessage: (messageId: string, body: string) =>
    request<MessageOut>(`/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ body }) }),
  deleteMessage: (messageId: string) =>
    request<MessageOut>(`/messages/${messageId}`, { method: "DELETE" }),
  postProjectUpdate: (projectId: string, note: string) =>
    request<MessageOut>(`/projects/${projectId}/updates`, { method: "POST", body: JSON.stringify({ note }) }),

  createReview: (payload: { project_id: string; reviewee_id: string; rating: number; comment?: string }) =>
    request<ReviewOut>("/reviews", { method: "POST", body: JSON.stringify(payload) }),
  reviewsForUser: (userId: string) => request<ReviewOut[]>(`/reviews/for/${userId}`),
  respondToReview: (reviewId: string, responseBody: string) =>
    request<ReviewOut>(`/reviews/${reviewId}/respond`, { method: "PATCH", body: JSON.stringify({ response_body: responseBody }) }),

  favorites: () => request<FavoriteOut[]>("/favorites"),
  addFavorite: (targetType: FavoriteTargetType, targetId: string) =>
    request<FavoriteOut>("/favorites", { method: "POST", body: JSON.stringify({ target_type: targetType, target_id: targetId }) }),
  removeFavorite: (targetType: FavoriteTargetType, targetId: string) =>
    request<void>(`/favorites/${targetType}/${targetId}`, { method: "DELETE" }),
  favoriteProfessionals: () => request<ProfessionalOut[]>("/favorites/professionals"),
  favoriteProjects: () => request<ProjectOut[]>("/favorites/projects"),

  updateClientProfile: (payload: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar_url?: string;
    company_name?: string;
    industry?: string;
    company_logo_url?: string;
    company_description?: string;
    company_website?: string;
    preferred_categories?: string[];
    username?: string;
  }) => request<UserOut>("/clients/me", { method: "PATCH", body: JSON.stringify(payload) }),
  getClientPublic: (clientId: string) => request<ClientPublicOut>(`/clients/${clientId}`),
  myKyc: () => request<KycOut>("/clients/me/kyc"),
  submitKyc: (payload: { nin: string; dob: string }) =>
    request<KycOut>("/clients/me/kyc", { method: "POST", body: JSON.stringify(payload) }),

  uploadFile: async (file: File, purpose?: "project_image" | "project_video"): Promise<{ url: string }> => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    const qs = purpose ? `?purpose=${purpose}` : "";
    const res = await fetch(`${API_BASE}/uploads${qs}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const data = await res.json();
        message = data.detail || message;
      } catch {
      }
      throw new ApiError(res.status, message);
    }
    return res.json();
  },

  downloadReceipt: async (transactionId: string): Promise<void> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/wallet/transactions/${transactionId}/receipt`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, "Could not download receipt");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yh-connect-receipt-${transactionId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const NIGERIAN_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "526", name: "Parallex Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "Suntrust Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
];
