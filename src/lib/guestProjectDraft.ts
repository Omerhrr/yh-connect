import { api, ApiError } from "@/lib/api";

/**
 * Guest project draft persistence.
 *
 * The pre-registration "Get Started" wizard collects a full project (title,
 * location, budget, skills, etc.) before the user has an account. Once they
 * register we immediately try to post it, but brand-new accounts are
 * unverified, and project creation is gated behind email verification. That
 * combination used to silently lose all the wizard data: the project create
 * call would 403, the wizard swallowed the failure, and the draft only ever
 * lived in React state which unmounted on redirect.
 *
 * Fix: persist the draft to localStorage as the user fills the wizard (not
 * just at submit time), and separately attempt to create the project from
 * that draft the moment we detect the user is verified — most reliably done
 * on the verify-email success screen, since verification very often happens
 * in a different browser tab/session than the one that filled the wizard.
 */
export const GUEST_DRAFT_KEY = "yh-connect.guest-project.draft";

export interface GuestProjectDraft {
  needText: string;
  title: string;
  state: string;
  lga: string;
  address: string;
  categoryId: string;
  categoryTouched: boolean;
  budgetUnknown: boolean;
  budget: string;
  timeline: string;
  hiringDeadline: string;
  skills: string[];
}

export function saveGuestProjectDraft(draft: GuestProjectDraft) {
  try {
    localStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage unavailable (private browsing, etc.) — draft simply
    // won't survive a tab switch, but the in-page wizard still works.
  }
}

export function loadGuestProjectDraft(): GuestProjectDraft | null {
  try {
    const raw = localStorage.getItem(GUEST_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return null;
    return d as GuestProjectDraft;
  } catch {
    return null;
  }
}

export function clearGuestProjectDraft() {
  try {
    localStorage.removeItem(GUEST_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Whether a draft has enough filled in to be worth posting. */
export function isDraftPostable(d: GuestProjectDraft | null): d is GuestProjectDraft {
  return !!d && !!d.title.trim();
}

/**
 * Attempt to create the project from a saved guest draft (called once the
 * user is confirmed verified). Clears the draft on success. Returns the
 * created project id, or null if there was nothing to post or the attempt
 * failed (draft is left in place so a later retry — e.g. next page load —
 * can pick it back up).
 */
export async function tryCreateProjectFromGuestDraft(): Promise<string | null> {
  const draft = loadGuestProjectDraft();
  if (!isDraftPostable(draft)) return null;

  const budgetAmount = draft.budgetUnknown ? 0 : Number(draft.budget) || 0;
  try {
    const project = await api.createProject({
      title: draft.title,
      description:
        draft.needText.trim() ||
        `${draft.title}. Required skills: ${draft.skills.join(", ")}.`,
      category_id: draft.categoryId,
      location: [draft.lga, draft.state].filter(Boolean).join(", ") || undefined,
      state: draft.state || undefined,
      lga: draft.lga || undefined,
      address: draft.address || undefined,
      budget_min: budgetAmount,
      budget_max: budgetAmount,
      budget_type: "fixed",
      skills: draft.skills,
      timeline: draft.timeline || undefined,
      hiring_deadline: draft.hiringDeadline ? new Date(draft.hiringDeadline).toISOString() : undefined,
    });
    clearGuestProjectDraft();
    return project.id;
  } catch (err) {
    // Still unverified, category got deactivated, etc — leave the draft for
    // the next attempt rather than losing it.
    if (err instanceof ApiError) return null;
    return null;
  }
}
