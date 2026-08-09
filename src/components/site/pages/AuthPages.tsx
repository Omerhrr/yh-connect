
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useNav } from "@/store/nav";
import { useAuth } from "@/store/auth";
import { api, ApiError } from "@/lib/api";
import { SKILLS, CATEGORIES } from "@/data/content";
import { toast } from "sonner";

// ─── Shared helpers ──────────────────────────────────────────────────────────
function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder = "Enter password",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                    ? "border-2 border-primary text-primary"
                    : "border-2 border-muted text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs mt-1 ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 ${done ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-background rounded-2xl border shadow-lg p-8">
        {children}
      </div>
    </div>
  );
}

function AuthLogo() {
  const { navigate } = useNav();
  return (
    <button onClick={() => navigate("home")} className="flex items-center gap-2 font-bold text-xl mb-6">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Zap className="h-4 w-4" />
      </div>
      <span>YH <span className="text-primary">Connect</span></span>
    </button>
  );
}

// ─── Client Login ────────────────────────────────────────────────────────────
export function ClientLoginPage() {
  const { navigate, setClientAuth } = useNav();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.user.role !== "client") {
        toast.error("This account isn't registered as a client. Try Professional Login.");
        return;
      }
      setSession(res.user, res.access_token);
      setClientAuth(true);
      toast.success("Welcome back!", { description: "You are now logged in as a client." });
      navigate("client-dashboard");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthLogo />
      <div className="flex items-center gap-2 mb-1">
        <Briefcase className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Client Login</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Sign in to manage your projects and talent.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="pl-9"
            />
          </div>
        </div>

        <PasswordInput id="password" label="Password" value={password} onChange={setPassword} />

        <div className="flex items-center justify-end text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">Don\'t have an account? </span>
        <button onClick={() => navigate("client-register")} className="text-primary hover:underline font-medium">
          Sign Up Free
        </button>
      </div>
      <div className="mt-2 text-center text-sm">
        <span className="text-muted-foreground">Are you a talent? </span>
        <button onClick={() => navigate("talent-login")} className="text-primary hover:underline font-medium">
          Talent Login
        </button>
      </div>
    </AuthCard>
  );
}

// ─── Client Register (3 steps) ───────────────────────────────────────────────
export function ClientRegisterPage() {
  const { navigate, setClientAuth } = useNav();
  const { setSession } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next");
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password || !phone) return toast.error("Please fill in all required fields");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (!agreed) return toast.error("Please accept the Terms of Service");
    setLoading(true);
    try {
      const res = await api.registerClient({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
      });
      setSession(res.user, res.access_token);
      setClientAuth(true);
      toast.success("Account created!", { description: "Welcome to YH Connect." });
      if (next) {
        router.push(next);
      } else {
        navigate("client-dashboard");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-background rounded-2xl border shadow-lg p-8">
        <AuthLogo />
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Create Client Account</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {next ? "Create your account to continue, you'll be taken right back to finish reaching out." : "Join YH Connect and start hiring top Nigerian talent."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone Number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 800 000 0000" className="pl-9" />
            </div>
          </div>
          <PasswordInput id="password" label="Password *" value={password} onChange={setPassword} />
          <PasswordInput id="confirmPassword" label="Confirm Password *" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat password" />

          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
            <span className="text-sm text-muted-foreground">
              I agree to the{" "}
              <button type="button" onClick={() => navigate("terms")} className="text-primary hover:underline">Terms of Service</button>
              {" "}and{" "}
              <button type="button" onClick={() => navigate("privacy")} className="text-primary hover:underline">Privacy Policy</button>
            </span>
          </label>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
            {!loading && <BadgeCheck className="h-4 w-4 ml-1" />}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button onClick={() => navigate("client-login")} className="text-primary hover:underline font-medium">Sign In</button>
        </p>
      </div>
    </div>
  );
}

// ─── Talent Login ────────────────────────────────────────────────────────────
export function TalentLoginPage() {
  const { navigate, setTalentAuth } = useNav();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Please fill in all fields");
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.user.role !== "professional") {
        toast.error("This account isn't registered as a professional. Try Client Login.");
        return;
      }
      setSession(res.user, res.access_token);
      setTalentAuth(true);
      toast.success("Welcome back!", { description: "You are now logged in." });
      navigate("talent-dashboard");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthLogo />
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-5 w-5 text-emerald-600" />
        <h1 className="text-2xl font-bold">Talent Login</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Sign in to browse projects and manage your profile.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" />
          </div>
        </div>
        <PasswordInput id="password" label="Password" value={password} onChange={setPassword} />
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox id="remember" />
            <span className="text-muted-foreground">Remember me</span>
          </label>
          <Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
          {loading ? "Signing in..." : "Sign In as Talent"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">No profile yet? </span>
        <button onClick={() => navigate("talent-register")} className="text-primary hover:underline font-medium">Create Free Profile</button>
      </div>
      <div className="mt-2 text-center text-sm">
        <span className="text-muted-foreground">Looking to hire? </span>
        <button onClick={() => navigate("client-login")} className="text-primary hover:underline font-medium">Client Login</button>
      </div>
    </AuthCard>
  );
}

// ─── Talent Register (3 steps) ───────────────────────────────────────────────
const TALENT_STEPS = ["Account", "Profile", "Skills & Rates"];

export function TalentRegisterPage() {
  const { navigate, setTalentAuth } = useNav();
  const { setSession } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 1
  const [title, setTitle] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [availability, setAvailability] = useState<"full-time" | "part-time" | "weekends">("full-time");
  const [experience, setExperience] = useState("");
  const [agreed, setAgreed] = useState(false);

  const EXPERIENCE_LEVELS = ["Less than 1 year", "1–2 years", "3–5 years", "5–10 years", "10+ years"];

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill].slice(0, 10)
    );
  };

  const nextStep = () => {
    if (step === 0) {
      if (!firstName || !lastName || !email || !password) return toast.error("Please fill in all required fields");
      if (password !== confirmPassword) return toast.error("Passwords do not match");
      if (password.length < 8) return toast.error("Password must be at least 8 characters");
    }
    if (step === 1) {
      if (!title || !specialization) return toast.error("Please enter your title and specialization");
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSkills.length === 0) return toast.error("Please select at least one skill");
    if (!agreed) return toast.error("Please accept the Terms of Service");
    setLoading(true);
    try {
      const res = await api.registerProfessional({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone,
        title,
        category_id: specialization,
        bio: bio || undefined,
        location: location || undefined,
        hourly_rate: hourlyRate ? Number(hourlyRate) : undefined,
        years_experience: experience || undefined,
        skills: selectedSkills,
      });
      setSession(res.user, res.access_token);
      setTalentAuth(true);
      toast.success("Profile created!", { description: "Your professional profile is live on YH Connect." });
      navigate("talent-dashboard");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-background rounded-2xl border shadow-lg p-8">
        <AuthLogo />
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-5 w-5 text-emerald-600" />
          <h1 className="text-2xl font-bold">Create Talent Profile</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Showcase your skills and start winning projects.</p>

        <StepIndicator steps={TALENT_STEPS} current={step} />

        <form onSubmit={handleSubmit}>
          {/* Step 0: Account */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className="pl-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" />
                </div>
              </div>
              <PasswordInput id="password" label="Password *" value={password} onChange={setPassword} />
              <PasswordInput id="confirmPassword" label="Confirm Password *" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat password" />
            </div>
          )}

          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Professional Title *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Structural Engineer, Architect, Site Contractor" />
              </div>
              <div className="space-y-1.5">
                <Label>Specialization *</Label>
                <select
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select your main specialization…</option>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Professional Bio</Label>
                <textarea
                  id="bio"
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell clients about yourself, your experience, and what makes you unique..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location *</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lagos, Nigeria" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 800 000 0000" className="pl-9" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Skills & Rates */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Your Skills <span className="text-muted-foreground text-xs">(up to 10)</span></Label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                  {SKILLS.map((sk) => (
                    <button
                      type="button"
                      key={sk.id}
                      onClick={() => toggleSkill(sk.label)}
                      className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                        selectedSkills.includes(sk.label)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:border-primary"
                      }`}
                    >
                      {sk.label}
                    </button>
                  ))}
                </div>
                {selectedSkills.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedSkills.length} skill{selectedSkills.length > 1 ? "s" : ""} selected</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hourlyRate">Hourly Rate (₦)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
                  <Input id="hourlyRate" type="number" min="500" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="15000" className="pl-7" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Availability</Label>
                <div className="flex gap-2">
                  {(["full-time", "part-time", "weekends"] as const).map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => setAvailability(a)}
                      className={`flex-1 rounded-lg border py-2 text-xs capitalize transition-colors ${availability === a ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary"}`}
                    >
                      {a === "full-time" ? "Full Time" : a === "part-time" ? "Part Time" : "Weekends"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Years of Experience</Label>
                <select
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select…</option>
                  {EXPERIENCE_LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  I agree to the{" "}
                  <button type="button" onClick={() => navigate("terms")} className="text-primary hover:underline">Terms of Service</button>
                  {" "}and{" "}
                  <button type="button" onClick={() => navigate("privacy")} className="text-primary hover:underline">Privacy Policy</button>
                </span>
              </label>
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step < TALENT_STEPS.length - 1 ? (
              <Button type="button" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={nextStep}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? "Creating profile..." : "Create My Profile"}
                {!loading && <BadgeCheck className="h-4 w-4 ml-1" />}
              </Button>
            )}
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have a profile?{" "}
          <button onClick={() => navigate("talent-login")} className="text-primary hover:underline font-medium">Sign In</button>
        </p>
      </div>
    </div>
  );
}

// --- Forgot Password ---------------------------------------------------------
export function ForgotPasswordPage() {
  const { navigate } = useNav();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter your email address");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthLogo />
      <h1 className="text-2xl font-bold mb-1">Reset your password</h1>
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password. Check your inbox.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-6">Enter the email address on your account and we&apos;ll send you a reset link.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        </>
      )}
      <div className="mt-6 text-center text-sm">
        <button onClick={() => navigate("home")} className="text-primary hover:underline font-medium">Back to home</button>
      </div>
    </AuthCard>
  );
}

// --- Reset Password ------------------------------------------------------------
export function ResetPasswordPage() {
  const { navigate } = useNav();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast.error("This reset link is invalid. Please request a new one.");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      toast.success("Password reset. Please log in.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "This reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthLogo />
      <h1 className="text-2xl font-bold mb-1">Set a new password</h1>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Your password has been reset.</p>
          <Button className="w-full" onClick={() => navigate("client-login")}>Go to Login</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <PasswordInput id="password" label="New Password" value={password} onChange={setPassword} />
          <PasswordInput id="confirmPassword" label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat password" />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

// --- Verify Email ---------------------------------------------------------------
export function VerifyEmailPage() {
  const { navigate } = useNav();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    api
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <AuthCard>
      <AuthLogo />
      <h1 className="text-2xl font-bold mb-2">Email Verification</h1>
      {status === "pending" && <p className="text-sm text-muted-foreground">Verifying your email...</p>}
      {status === "success" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Your email has been verified.</p>
          <Button className="w-full" onClick={() => navigate("home")}>Continue</Button>
        </div>
      )}
      {status === "error" && (
        <p className="text-sm text-muted-foreground">This verification link is invalid or has expired. You can request a new one from your account settings.</p>
      )}
    </AuthCard>
  );
}
