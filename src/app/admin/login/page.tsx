"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck, FileClock, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/store/auth";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

const SECURITY_POINTS = [
  { icon: ShieldCheck, text: "Restricted to authorized administrator accounts only" },
  { icon: FileClock, text: "Every sign-in and admin action is logged for audit" },
  { icon: UserCog, text: "Full platform oversight: users, payments, disputes, content" },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address";
    if (!password) errors.password = "Password is required";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.user.role !== "admin") {
        toast.error("This account isn't an admin account.", {
          description: "Sign in with an account that has administrator access.",
        });
        return;
      }
      setSession(res.user, res.access_token);
      toast.success(`Welcome back, ${res.user.first_name}.`);
      router.push("/admin");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not sign in. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left: brand / security panel, hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(16,185,129,0.2), transparent 45%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 backdrop-blur">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl">
              YH Connect <span className="text-slate-400 font-normal">Admin</span>
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-8 max-w-md">
          <div>
            <h1 className="text-3xl font-bold leading-tight">
              Platform control center
            </h1>
            <p className="mt-3 text-slate-400 text-sm leading-relaxed">
              Manage users, verifications, projects, payments, disputes, and site content from one
              secure dashboard.
            </p>
          </div>
          <div className="space-y-4">
            {SECURITY_POINTS.map((p) => (
              <div key={p.text} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 border border-white/10">
                  <p.icon className="h-4 w-4 text-slate-300" />
                </div>
                <p className="text-sm text-slate-300 pt-1.5">{p.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} YH Connect · A product of Yahya Hub, Abuja, Nigeria.
          </p>
        </div>
      </div>

      {/* Right: sign-in form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-slate-950 lg:bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl text-white lg:text-foreground">
              YH Connect <span className="text-slate-400 font-normal">Admin</span>
            </span>
          </div>

          <div className="bg-white rounded-2xl border shadow-xl p-8">
            <div className="mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <KeyRound className="h-4.5 w-4.5 text-slate-500" /> Administrator sign in
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Enter your credentials to access the dashboard.</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); }}
                    placeholder="admin@yhconnect.ng"
                    className={`pl-9 ${fieldErrors.email ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                    disabled={loading}
                  />
                </div>
                {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); }}
                    placeholder="Enter password"
                    className={`pl-9 pr-9 ${fieldErrors.password ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
              </div>

              <Button type="submit" className="w-full bg-slate-800 hover:bg-slate-900" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-6 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> This is a restricted area. Access attempts are logged.
            </p>
          </div>

          <p className="text-center text-xs text-slate-500 lg:text-muted-foreground mt-6">
            Not an admin? <Link href="/" className="underline hover:text-primary">Return to the main site</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
