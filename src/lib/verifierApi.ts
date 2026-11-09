// Client for the external verifier portal (ARCON, COREN, ...). It uses its own
// token, kept separate from regular user sessions so the two never mix.

import { ApiError } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api/v1";
const KEY = "yhc_verifier_token";

export const getVerifierToken = () =>
  typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
export const setVerifierToken = (t: string | null) => {
  if (typeof window === "undefined") return;
  if (t) window.localStorage.setItem(KEY, t);
  else window.localStorage.removeItem(KEY);
};

async function vreq<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getVerifierToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    let message = res.statusText;
    try { message = (await res.json()).detail || message; } catch { /* ignore */ }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export type VerifierCert = {
  id: string;
  name: string;
  issuing_body?: string | null;
  credential_url?: string | null;
  issued_date?: string | null;
  expiry_date?: string | null;
  submitted_at: string;
  status: "unverified" | "pending" | "verified" | "rejected";
  note?: string | null;
  verified_by_body?: string | null;
  verified_by_name?: string | null;
  holder_name?: string | null;
  holder_title?: string | null;
  holder_location?: string | null;
};

export const verifierApi = {
  login: (email: string, password: string) =>
    vreq<{ access_token: string; name: string; body_name: string }>("/verifier/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => vreq<{ id: string; name: string; email: string; body_name: string }>("/verifier/me"),
  certifications: (scope: "pending" | "reviewed") => vreq<VerifierCert[]>(`/verifier/certifications?scope=${scope}`),
  decide: (id: string, status: "verified" | "rejected", note?: string) =>
    vreq<{ status: string }>(`/verifier/certifications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),
};
