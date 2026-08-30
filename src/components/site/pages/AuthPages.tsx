
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
import { inferCategoryId } from "@/lib/categoryInference";
import { toast } from "sonner";

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

function ChatBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Zap className="h-4 w-4" />
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed max-w-[85%]">
        {children}
      </div>
    </div>
  );
}

function ChatProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${i <= current ? "bg-primary" : "bg-muted"}`}
        />
      ))}
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

export function ClientLoginPage() {
  const { navigate, setClientAuth } = useNav();
  const { setSession } = useAuth();
  const router = useRouter();
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
        setSession(res.user, res.access_token);
        try {
          const switched = await api.switchRole("client");
          setSession(switched.user, switched.access_token);
          setClientAuth(true);
          toast.success("Switched to client mode", { description: "You are now logged in as a client." });
          router.push("/client/dashboard");
        } catch (switchErr) {
          toast.error(switchErr instanceof ApiError ? switchErr.message : "Could not switch this account to client mode.");
        }
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

const CLIENT_STEPS = ["What you need", "Project", "Budget", "Skills", "Name", "Email", "Password", "Terms"];

export function ClientRegisterPage() {
  const { navigate, setClientAuth } = useNav();
  const { setSession } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const [needText, setNeedText] = useState(searchParams.get("need") || "");
  const inferredCategoryId = inferCategoryId(needText);
  const inferredCategoryLabel = CATEGORIES.find((c) => c.id === inferredCategoryId)?.label ?? "General Contracting & Building";

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");

  const [budget, setBudget] = useState("");

  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [projectTerms, setProjectTerms] = useState<{ title: string; body: string } | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);

  useEffect(() => {
    api.contentPage("client-project-terms")
      .then((p) => setProjectTerms({ title: p.title, body: p.body }))
      .catch(() => setProjectTerms(null));
  }, []);

  const goNext = () => {
    if (step === 0 && !needText.trim()) return toast.error("Please tell us what you need help with");
    if (step === 1 && !title) return toast.error("Please enter a project title");
    if (step === 2 && (!budget || Number(budget) <= 0)) return toast.error("Please enter your estimated budget");
    if (step === 3 && skills.length === 0) return toast.error("Pick at least one skill from the suggestions or add your own");
    if (step === 4 && (!firstName || !lastName)) return toast.error("Please enter your first and last name");
    if (step === 5 && !email) return toast.error("Please enter your email address");
    if (step === 6) {
      if (!password || !confirmPassword) return toast.error("Please enter and confirm your password");
      if (password !== confirmPassword) return toast.error("Passwords do not match");
      if (password.length < 8) return toast.error("Password must be at least 8 characters");
      if (!agreed) return toast.error("Please accept the Terms of Service");
    }
    setDirection("forward");
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection("back");
    setStep((s) => s - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) return toast.error("Please enter and confirm your password");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (!agreed) return toast.error("Please accept the Terms of Service");
    if (!termsAgreed) return toast.error("Please accept the project posting terms to continue");

    setLoading(true);
    try {
      const budgetAmount = Number(budget);
      const categoryId = inferredCategoryId;
      const categoryLabel = inferredCategoryLabel;

      const res = await api.registerClient({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      });
      setSession(res.user, res.access_token);
      setClientAuth(true);

      let createdProjectId: string | null = null;
      try {
        const project = await api.createProject({
          title,
          description: needText.trim() || `${title}. Needs a ${categoryLabel} professional. Required skills: ${skills.join(", ")}.`,
          category_id: categoryId,
          location: location || undefined,
          budget_min: budgetAmount,
          budget_max: budgetAmount,
          budget_type: "fixed",
          skills,
        });
        createdProjectId = project.id;
        toast.success("Account created and project posted!", { description: "Your project is now live for professionals to bid on." });
      } catch {
        toast.success("Account created!", { description: "We couldn't auto-post your project, you can post it from your dashboard." });
      }

      if (next) {
        router.push(next);
      } else if (createdProjectId) {
        router.push(`/client/dashboard/projects/${createdProjectId}`);
      } else {
        navigate("client-dashboard");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addCustomSkill = () => {
    const s = customSkill.trim();
    if (!s) return;
    if (!skills.includes(s)) setSkills((prev) => [...prev, s]);
    setCustomSkill("");
  };

  const suggestedSkills = [...SKILLS].sort((a, b) => {
    const catWord = inferredCategoryId.split("-")[0];
    const relevance = (s: (typeof SKILLS)[number]) =>
      s.label.toLowerCase().includes(catWord) || s.category.toLowerCase().includes(catWord) ? 1 : 0;
    return relevance(b) - relevance(a);
  });

  const animationClass = direction === "forward" ? "animate-step-in" : "animate-step-in-back";

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-background rounded-2xl border shadow-lg p-8">
        <AuthLogo />
        <div className="flex items-center gap-2 mb-1">
          <Briefcase className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Get Started</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {next ? "Answer a few quick questions, we'll set up your account and post your project in one go." : "Just answer a few quick questions, no separate signup needed, we'll post your project as soon as we're done."}
        </p>

        <ChatProgress total={CLIENT_STEPS.length} current={step} />

        <form onSubmit={step === CLIENT_STEPS.length - 1 ? handleSubmit : (e) => e.preventDefault()}>
          <div key={step} className={animationClass}>

            {step === 0 && (
              <div>
                <ChatBubble>Hi there! Let's get your project posted. In your own words, what do you need help with?</ChatBubble>
                <div className="space-y-1.5">
                  <Label htmlFor="needText">Tell us about it *</Label>
                  <textarea
                    id="needText"
                    rows={4}
                    value={needText}
                    onChange={(e) => setNeedText(e.target.value)}
                    placeholder="e.g. I need someone to renovate my 3-bedroom house in Lekki, mostly tiling and painting"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                  {needText.trim() && (
                    <p className="text-xs text-muted-foreground">
                      Sounds like: <span className="font-medium text-foreground">{inferredCategoryLabel}</span>. You'll get to add specific skills next.
                    </p>
                  )}
                </div>
              </div>
            )}


            {step === 1 && (
              <div>
                <ChatBubble>Good choice. What should we call this project, and where's it based?</ChatBubble>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Project Title *</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 3-bedroom bungalow renovation" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lekki, Lagos" />
                  </div>
                </div>
              </div>
            )}

            {}
            {step === 2 && (
              <div>
                <ChatBubble>What's your estimated budget for this? A rough figure is fine, you can refine it later.</ChatBubble>
                <div className="space-y-1.5">
                  <Label htmlFor="budget">Estimated Budget (₦) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
                    <Input id="budget" type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="500000" className="pl-7" />
                  </div>
                </div>
              </div>
            )}


            {step === 3 && (
              <div>
                <ChatBubble>What skills should they bring to the table? Tap the ones you need, or add your own.</ChatBubble>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedSkills.map((s) => {
                      const selected = skills.includes(s.label);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSkills((prev) => (selected ? prev.filter((x) => x !== s.label) : [...prev, s.label]))}
                          className={`text-xs rounded-full border px-2.5 py-1.5 transition-colors ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={customSkill}
                      onChange={(e) => setCustomSkill(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSkill(); } }}
                      placeholder="Or type your own, e.g. POP ceiling installation"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={addCustomSkill} disabled={!customSkill.trim()}>
                      Add
                    </Button>
                  </div>
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((s) => (
                        <span key={s} className="text-xs rounded-full bg-primary/10 text-primary px-2.5 py-1 flex items-center gap-1">
                          {s}
                          <button type="button" onClick={() => setSkills((prev) => prev.filter((x) => x !== s))} className="hover:text-foreground" aria-label={`Remove ${s}`}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}


            {step === 4 && (
              <div>
                <ChatBubble>Almost there. Who am I speaking with?</ChatBubble>
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
              </div>
            )}


            {step === 5 && (
              <div>
                <ChatBubble>
                  {firstName ? `Nice to meet you, ${firstName}. What's your email address?` : "What's your email address?"}
                </ChatBubble>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" />
                  </div>
                </div>
              </div>
            )}


            {step === 6 && (
              <div>
                <ChatBubble>Last step, set a password to secure your account. We'll create it and post your project right after.</ChatBubble>
                <div className="space-y-4">
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
                </div>
              </div>
            )}


            {step === 7 && (
              <div>
                <ChatBubble>One last thing, please review and accept our project posting terms.</ChatBubble>
                <div className="space-y-3">
                  <div className="max-h-56 overflow-y-auto rounded-md border border-input bg-muted/30 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {projectTerms?.body?.trim() ||
                      "By posting a project, you confirm the details you've provided are accurate, you intend to genuinely hire for this work, and you agree to fund and pay professionals through YH Connect's escrow system for any work you approve."}
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox checked={termsAgreed} onCheckedChange={(v) => setTermsAgreed(!!v)} className="mt-0.5" />
                    <span className="text-sm text-muted-foreground">
                      I have read and accept the {projectTerms?.title?.trim() || "project posting terms"}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>


          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step < CLIENT_STEPS.length - 1 ? (
              <Button type="button" className="flex-1" onClick={goNext}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="submit" className="flex-1" disabled={loading || !termsAgreed}>
                {loading ? "Creating account..." : "Create Account & Post Project"}
                {!loading && <BadgeCheck className="h-4 w-4 ml-1" />}
              </Button>
            )}
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button onClick={() => navigate("client-login")} className="text-primary hover:underline font-medium">Sign In</button>
        </p>
      </div>
    </div>
  );
}

export function TalentLoginPage() {
  const { navigate, setTalentAuth } = useNav();
  const { setSession } = useAuth();
  const router = useRouter();
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

        setSession(res.user, res.access_token);
        try {
          const switched = await api.switchRole("professional");
          setSession(switched.user, switched.access_token);
          setTalentAuth(true);
          toast.success("Switched to talent mode", { description: "You are now logged in as a professional." });

          router.push("/talent/dashboard");
        } catch (switchErr) {
          toast.error(switchErr instanceof ApiError ? switchErr.message : "Could not switch this account to talent mode.");
        }
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

const TALENT_STEPS = ["Account", "Profile", "Skills & Rates", "Verification"];

export function TalentRegisterPage() {
  const { navigate, setTalentAuth } = useNav();
  const { setSession } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [title, setTitle] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");

  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [availability, setAvailability] = useState<"full-time" | "part-time" | "weekends">("full-time");
  const [experience, setExperience] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [nin, setNin] = useState("");
  const [dob, setDob] = useState("");
  const [idDocFile, setIdDocFile] = useState<File | null>(null);

  const EXPERIENCE_LEVELS = ["Less than 1 year", "1–2 years", "3–5 years", "5–10 years", "10+ years"];

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) => {
      if (prev.includes(skill)) return prev.filter((s) => s !== skill);
      if (prev.length >= 10) {
        toast.error("You can add up to 10 skills");
        return prev;
      }
      return [...prev, skill];
    });
  };

  const nextStep = () => {
    if (step === 0) {
      if (!firstName || !lastName || !email || !password) return toast.error("Please fill in all required fields");
      if (password !== confirmPassword) return toast.error("Passwords do not match");
      if (password.length < 8) return toast.error("Password must be at least 8 characters");
    }
    if (step === 1) {
      if (!title || !specialization) return toast.error("Please enter your title and specialization");
      if (!location.trim()) return toast.error("Please enter your location, clients search for local professionals");
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSkills.length === 0) return toast.error("Please select at least one skill");
    if (!agreed) return toast.error("Please accept the Terms of Service");
    if (nin.trim() && (nin.length !== 11 || !dob)) {
      return toast.error("To verify your identity, enter your full 11-digit NIN and date of birth");
    }
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

      let verifiedNow = false;
      if (nin.trim()) {
        try {
          const document_url = idDocFile ? (await api.uploadFile(idDocFile)).url : undefined;
          const kyc = await api.submitProfessionalKyc({ nin: nin.trim(), dob, document_url });
          verifiedNow = kyc.kyc_status === "verified";
        } catch {

        }
      }

      if (verifiedNow) {
        toast.success("Profile created!", { description: "Your identity was verified, you're now Tier 2 with higher bid limits." });
      } else if (nin.trim()) {
        toast.success("Profile created!", { description: "Your identity details were submitted. We'll notify you once your tier 2 upgrade is approved." });
      } else {
        toast.success("Profile created!", { description: "Verify your identity from Settings to unlock more bids." });
      }
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
                <Label htmlFor="hourlyRate">Daily Rate (₦)</Label>
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


          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 text-emerald-800 p-3 text-xs flex items-start gap-2">
                <BadgeCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Optional, but worth it: verified professionals can send up to 10 bids a day and take on more
                  active projects. Your NIN is checked instantly; if it can't be confirmed, your uploaded document goes
                  to our team for review.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="talent-nin">NIN <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="talent-nin"
                    value={nin}
                    onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="12345678901"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="talent-dob">Date of Birth</Label>
                  <Input id="talent-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>ID Document <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <p className="text-xs text-muted-foreground">NIN slip, national ID card, voters card, or passport.</p>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setIdDocFile(f || null);
                  }}
                  className="text-xs"
                />
                {idDocFile && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <BadgeCheck className="h-3 w-3" /> {idDocFile.name} attached
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                You can skip this and verify anytime later from Settings → Verification.
              </p>
            </div>
          )}

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
