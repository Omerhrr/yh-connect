
"use client";

import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Calculator,
  ClipboardList,
  Construction,
  Database,
  Eye,
  FileText,
  Gavel,
  Hammer,
  HardHat,
  HeadphonesIcon,
  Lock,
  Mail,
  MapPin,
  MapPinned,
  Plug,
  Scale,
  Search,
  Share2,
  ShieldCheck,
  Sofa,
  Star,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useNav } from "@/store/nav";
import { CmsPage } from "@/components/site/CmsPage";
import { api, type BlogPostOut, type CategoryOut, type HighlightOut, type ProfessionalOut, type ProjectOut } from "@/lib/api";
import {
  CATEGORIES,
  HOW_IT_WORKS_STEPS,
  WHY_CHOOSE,
  CLIENT_BENEFITS,
  TALENT_BENEFITS,
} from "@/data/content";

const ICON_MAP: Record<string, React.ElementType> = {
  Building2,
  HardHat,
  Construction,
  Zap,
  Plug,
  Wrench,
  Calculator,
  ClipboardList,
  Sofa,
  MapPinned,
  Hammer,
  Briefcase,
  FileText,
  Users,
  ShieldCheck,
  BadgeCheck,
  Lock,
  MapPin,
  HeadphonesIcon,
};

function formatNaira(amount: number) {
  return "₦" + amount.toLocaleString("en-NG");
}

// ─── Hero ───────────────────────────────────────────────────────────────────
function Hero() {
  const { navigate } = useNav();
  const [search, setSearch] = useState("");

  const runSearch = () => {
    navigate("find-talent", undefined, search.trim() ? { q: search.trim() } : undefined);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-20 md:py-32">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl leading-tight">
            Hire{" "}
            <span className="text-primary">Verified Construction</span>{" "}
            Professionals. Build with Confidence.
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            YH Connect bridges ambitious clients with verified Nigerian architects,
            engineers, contractors and construction trades. Post projects, review
            proposals, track site progress, and pay securely via escrow, all in one place.
          </p>

          {/* Search bar */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="What do you need built or designed?"
                className="pl-9 h-12 rounded-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
            <Button
              size="lg"
              className="rounded-full px-6 h-12"
              onClick={runSearch}
            >
              Find Professionals <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Popular:{" "}
            {["Structural Engineer", "Architect", "General Contractor", "Quantity Surveyor"].map((t) => (
              <button
                key={t}
                className="underline underline-offset-2 hover:text-foreground mx-1 transition-colors"
                onClick={() => navigate("find-talent", undefined, { q: t })}
              >
                {t}
              </button>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Highlights (admin CMS-managed stats/testimonials/banners) ──────────────
function Highlights() {
  const [highlights, setHighlights] = useState<HighlightOut[] | null>(null);

  useEffect(() => {
    api.activeHighlights().then(setHighlights).catch(() => setHighlights([]));
  }, []);

  if (!highlights || highlights.length === 0) return null;

  const stats = highlights.filter((h) => h.type === "stat").sort((a, b) => a.sort_order - b.sort_order);
  const testimonials = highlights.filter((h) => h.type === "testimonial").sort((a, b) => a.sort_order - b.sort_order);
  const banners = highlights.filter((h) => h.type === "banner").sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      {banners.length > 0 && (
        <div className="bg-primary text-primary-foreground">
          {banners.map((b) => (
            <div key={b.id} className="container mx-auto px-4 py-2.5 text-center text-sm font-medium">
              {b.title}
              {b.body && <span className="opacity-90"> {b.body}</span>}
            </div>
          ))}
        </div>
      )}

      {stats.length > 0 && (
        <section className="py-10 border-y bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="grid gap-6 text-center grid-cols-2 md:grid-cols-4">
              {stats.map((s) => (
                <div key={s.id}>
                  <p className="text-2xl md:text-3xl font-extrabold text-primary">{s.title}</p>
                  {s.body && <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-8">What People Are Saying</h2>
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map((t) => (
                <div key={t.id} className="rounded-xl border bg-background p-5">
                  {t.body && <p className="text-sm text-muted-foreground leading-relaxed">&ldquo;{t.body}&rdquo;</p>}
                  <p className="mt-3 text-sm font-semibold">{t.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

// ─── Categories ─────────────────────────────────────────────────────────────
function Categories() {
  const { navigate } = useNav();
  const [categories, setCategories] = useState<CategoryOut[] | null>(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <section className="py-16 bg-muted/20">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold text-center mb-8">Browse by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(categories ?? CATEGORIES).map((cat) => {
            const Icon = ICON_MAP[cat.icon] ?? Briefcase;
            const count = categories ? (cat as CategoryOut).professional_count : null;
            return (
              <button
                key={cat.id}
                onClick={() => navigate("find-talent", undefined, { category_id: cat.id })}
                className={`relative flex flex-col items-center gap-2 rounded-xl border bg-background p-5 hover:border-primary hover:shadow-sm transition-all group ${(cat as CategoryOut).featured ? "border-primary/40" : ""}`}
              >
                {(cat as CategoryOut).featured && (
                  <span className="absolute top-2 right-2 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5">Featured</span>
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium text-sm">{cat.label}</span>
                {count !== null && (
                  <span className="text-xs text-muted-foreground">
                    {count} pro{count === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ───────────────────────────────────────────────────────────
function HowItWorks() {
  const { navigate } = useNav();
  return (
    <section className="py-20" id="how-it-works">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="rounded-full mb-3">Simple Process</Badge>
          <h2 className="text-3xl font-bold">How YH Connect Works</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Get your project done in three simple steps: post, review, and pay.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* connecting line on desktop */}
          <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px bg-border" />

          {HOW_IT_WORKS_STEPS.map((step) => {
            const Icon = ICON_MAP[step.icon] ?? FileText;
            return (
              <div key={step.step} className="relative text-center flex flex-col items-center gap-4">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold shadow-lg">
                  <Icon className="h-8 w-8" />
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-primary text-primary text-xs font-bold">
                    {step.step}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={() => navigate("client-register")}>
            Post a Project Free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("talent-register")}>
            Become a Talent
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Featured Talent ────────────────────────────────────────────────────────
function FeaturedTalent() {
  const { navigate } = useNav();
  const [pros, setPros] = useState<ProfessionalOut[] | null>(null);

  useEffect(() => {
    api.professionals().then(setPros).catch(() => setPros([]));
  }, []);

  const featured = (pros ?? []).slice(0, 4);

  return (
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Badge variant="secondary" className="rounded-full mb-2">Professionals</Badge>
            <h2 className="text-3xl font-bold">Construction Professionals on YH Connect</h2>
          </div>
          <Button variant="outline" onClick={() => navigate("find-talent")}>
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {pros !== null && featured.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No professionals have joined yet. Be the first to create a profile.
          </p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featured.map((talent) => (
            <Link
              key={talent.id}
              href={`/find-talent/${talent.id}`}
              className="block rounded-xl border bg-background p-5 hover:shadow-md transition-shadow"
            >
              <div className="relative mx-auto mb-4 h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                {talent.first_name.charAt(0)}
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">{talent.first_name} {talent.last_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{talent.title}</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-medium">{talent.rating || "New"}</span>
                  <span className="text-xs text-muted-foreground">({talent.review_count})</span>
                </div>
                {talent.location && <p className="text-xs text-muted-foreground mt-1">{talent.location}</p>}
                {talent.hourly_rate && (
                  <p className="text-sm font-semibold text-primary mt-2">₦{talent.hourly_rate}/hr</p>
                )}
                {talent.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1 justify-center">
                    {talent.skills.slice(0, 2).map((sk) => (
                      <Badge key={sk} variant="secondary" className="text-xs rounded-full">
                        {sk}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Recent Projects ────────────────────────────────────────────────────────
function RecentProjects() {
  const { navigate } = useNav();
  const [projects, setProjects] = useState<ProjectOut[] | null>(null);

  useEffect(() => {
    api.projects().then(setProjects).catch(() => setProjects([]));
  }, []);

  const recent = (projects ?? []).slice(0, 3);

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Badge variant="secondary" className="rounded-full mb-2">Projects</Badge>
            <h2 className="text-3xl font-bold">Latest Project Listings</h2>
          </div>
          <Button variant="outline" onClick={() => navigate("find-work")}>
            Browse All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {projects !== null && recent.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No projects have been posted yet. Be the first to post one.
          </p>
        )}

        <div className="grid md:grid-cols-3 gap-5">
          {recent.map((proj) => (
            <div
              key={proj.id}
              className="rounded-xl border bg-background p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate("find-work")}
            >
              <div className="flex items-start justify-between mb-3">
                <Badge variant="outline" className="text-xs rounded-full">{proj.category.label}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(proj.created_at).toLocaleDateString()}</span>
              </div>
              <h3 className="font-semibold text-sm leading-snug">{proj.title}</h3>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {proj.description}
              </p>
              {proj.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {proj.skills.slice(0, 3).map((sk) => (
                    <Badge key={sk} variant="secondary" className="text-xs rounded-full">
                      {sk}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="text-sm font-semibold text-primary">
                    {formatNaira(proj.budget_min)} to {formatNaira(proj.budget_max)}
                    {proj.budget_type === "hourly" ? "/hr" : ""}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{proj.bid_count} proposal{proj.bid_count === 1 ? "" : "s"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why Choose ─────────────────────────────────────────────────────────────
function WhyChoose() {
  return (
    <section className="py-20 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="rounded-full mb-3">Why YH Connect</Badge>
          <h2 className="text-3xl font-bold">Built for the Construction Industry</h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            We understand the unique needs of Nigerian architects, engineers, contractors and clients.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHY_CHOOSE.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? BadgeCheck;
            return (
              <div key={item.title} className="rounded-xl border bg-background p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── For Clients / For Talents split ────────────────────────────────────────
function ForWho() {
  const { navigate } = useNav();
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8">
          {/* For Clients */}
          <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-5">
              <Briefcase className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold mb-2">For Clients</h2>
            <p className="text-muted-foreground mb-6">
              Find the right architect, engineer, or contractor for any build, big or small.
              Pay only when you're 100% satisfied.
            </p>
            <ul className="space-y-3 mb-8">
              {CLIENT_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <BadgeCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Button onClick={() => navigate("client-register")}>
                Post a Project <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate("find-talent")}>
                Browse Talent
              </Button>
            </div>
          </div>

          {/* For Talents */}
          <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white mb-5">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold mb-2">For Professionals</h2>
            <p className="text-muted-foreground mb-6">
              Showcase your portfolio of completed builds, win projects you're suited for,
              and get paid on time, every time.
            </p>
            <ul className="space-y-3 mb-8">
              {TALENT_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => navigate("talent-register")}
              >
                Create Free Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate("find-work")}>
                Browse Projects
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ─────────────────────────────────────────────────────────────
function CTABanner() {
  const { navigate } = useNav();
  return (
    <section className="py-20 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to Get Started?
        </h2>
        <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
          Join thousands of clients and professionals already using YH Connect to
          collaborate and grow.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full px-8"
            onClick={() => navigate("client-register")}
          >
            Hire a Professional
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full px-8 border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => navigate("talent-register")}
          >
            Offer Your Services
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Find Talent page ────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

export function FindTalentPage() {
  const searchParams = useSearchParams();
  const [pros, setPros] = useState<ProfessionalOut[] | null>(null);
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [search, setSearch] = useState(searchParams?.get("q") || "");
  const [categoryId, setCategoryId] = useState(searchParams?.get("category_id") || "");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const load = () => {
    setPros(null);
    api
      .professionals({ q: search || undefined, category_id: categoryId || undefined, limit: PAGE_SIZE, offset: 0 })
      .then((r) => {
        setPros(r);
        setHasMore(r.length === PAGE_SIZE);
      })
      .catch(() => setPros(null));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    if (!pros) return;
    setLoadingMore(true);
    api
      .professionals({ q: search || undefined, category_id: categoryId || undefined, limit: PAGE_SIZE, offset: pros.length })
      .then((r) => {
        setPros((prev) => [...(prev ?? []), ...r]);
        setHasMore(r.length === PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };


  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Find Professionals</h1>
        <p className="text-muted-foreground">Browse verified Nigerian architects, engineers, contractors and trades.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Search by skill or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="flex h-10 w-full sm:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Button onClick={load}>Search</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {(pros ?? []).map((talent) => (
          <Link
            key={talent.id}
            href={`/find-talent/${talent.id}`}
            className="block rounded-xl border bg-background p-5 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="relative mx-auto mb-4 h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
              {talent.first_name.charAt(0)}
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">{talent.first_name} {talent.last_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{talent.title}</p>
              <p className="text-xs text-muted-foreground">{talent.location}</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium">{talent.rating || "New"}</span>
                <span className="text-xs text-muted-foreground">({talent.review_count})</span>
              </div>
              {talent.hourly_rate && <p className="text-sm font-semibold text-primary mt-2">₦{talent.hourly_rate}/hr</p>}
              <Button size="sm" className="mt-3 w-full rounded-full pointer-events-none">
                View Profile
              </Button>
            </div>
          </Link>
        ))}
      </div>
      {pros === null && <p className="text-sm text-muted-foreground">Loading professionals...</p>}
      {pros !== null && pros.length === 0 && (
        <p className="text-sm text-muted-foreground">No professionals have joined yet. Check back soon.</p>
      )}
      {pros !== null && pros.length > 0 && hasMore && (
        <div className="flex justify-center mt-8">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Find Work page ──────────────────────────────────────────────────────────
export function FindWorkPage() {
  const [projects, setProjects] = useState<ProjectOut[] | null>(null);
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = () => {
    setProjects(null);
    api
      .projects({ q: search || undefined, limit: PAGE_SIZE, offset: 0 })
      .then((r) => {
        setProjects(r);
        setHasMore(r.length === PAGE_SIZE);
      })
      .catch(() => setProjects(null));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    if (!projects) return;
    setLoadingMore(true);
    api
      .projects({ q: search || undefined, limit: PAGE_SIZE, offset: projects.length })
      .then((r) => {
        setProjects((prev) => [...(prev ?? []), ...r]);
        setHasMore(r.length === PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Find Projects</h1>
        <p className="text-muted-foreground">Browse open construction projects and submit your proposal.</p>
      </div>
      <div className="flex gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Button onClick={load}>Search</Button>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {(projects ?? []).map((proj) => (
          <Link
            key={proj.id}
            href={`/find-work/${proj.id}`}
            className="block rounded-xl border bg-background p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <Badge variant="outline" className="text-xs rounded-full">{proj.category.label}</Badge>
            </div>
            <h3 className="font-semibold text-sm leading-snug">{proj.title}</h3>
            <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{proj.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {proj.skills.slice(0, 3).map((sk) => (
                <Badge key={sk} variant="secondary" className="text-xs rounded-full">{sk}</Badge>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">
                {formatNaira(proj.budget_min)} to {formatNaira(proj.budget_max)}{proj.budget_type === "hourly" ? "/hr" : ""}
              </p>
              <Button size="sm" className="rounded-full pointer-events-none">
                View & Apply
              </Button>
            </div>
          </Link>
        ))}
      </div>
      {projects === null && <p className="text-sm text-muted-foreground">Loading projects...</p>}
      {projects !== null && projects.length === 0 && (
        <p className="text-sm text-muted-foreground">No open projects right now. Check back soon.</p>
      )}
      {projects !== null && projects.length > 0 && hasMore && (
        <div className="flex justify-center mt-8">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── How It Works page ───────────────────────────────────────────────────────
export function HowItWorksPage() {
  return (
    <CmsPage slug="how-it-works">
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-4xl font-bold mb-4">How YH Connect Works</h1>
        <p className="text-lg text-muted-foreground mb-12">
          From posting your first project to paying your talent, here is everything you need to know.
        </p>
        <HowItWorks />
        <WhyChoose />
      </div>
    </CmsPage>
  );
}

// --- Blog / Privacy / Terms - CMS-backed with hardcoded fallback ---
export function BlogPage() {
  const [posts, setPosts] = useState<BlogPostOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.publishedBlogPosts().then(setPosts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold mb-4">Blog</h1>
      {loading && <p className="text-muted-foreground">Loading…</p>}
      {!loading && posts.length === 0 && (
        <p className="text-muted-foreground">Articles and resources for construction professionals and clients. Coming soon.</p>
      )}
      <div className="space-y-8 mt-6">
        {posts.map((post) => (
          <article key={post.id} className="border-b pb-8 last:border-0">
            <h2 className="text-xl font-semibold">
              <Link href={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
                {post.title}
              </Link>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {post.author_name ? `${post.author_name} · ` : ""}
              {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}
            </p>
            {post.excerpt && <p className="text-muted-foreground mt-3">{post.excerpt}</p>}
            <Link href={`/blog/${post.slug}`} className="inline-block mt-3 text-sm font-medium text-primary hover:underline">
              Read more →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export function BlogPostPage({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPostOut | null | undefined>(undefined);

  useEffect(() => {
    setPost(undefined);
    api
      .blogPost(slug)
      .then(setPost)
      .catch(() => setPost(null));
  }, [slug]);

  if (post === undefined) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (post === null) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
        <h1 className="text-2xl font-bold">Post not found</h1>
        <p className="text-muted-foreground mt-2">This article may have been removed or unpublished.</p>
        <Link href="/blog" className="inline-block mt-4 text-primary font-medium hover:underline">
          ← Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <Link href="/blog" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to Blog
      </Link>
      <h1 className="text-3xl font-bold mt-4">{post.title}</h1>
      <p className="text-xs text-muted-foreground mt-2">
        {post.author_name ? `${post.author_name} · ` : ""}
        {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}
      </p>
      {post.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.cover_image_url} alt={post.title} className="w-full rounded-xl mt-6 object-cover max-h-96" />
      )}
      <div className="prose prose-sm max-w-none mt-6 whitespace-pre-wrap">{post.body}</div>
    </div>
  );
}

// ─── Shared legal page layout (Privacy / Terms) ─────────────────────────────
interface LegalSection {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

function LegalLayout({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
  contactEmail,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
  contactEmail: string;
}) {
  return (
    <div>
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 py-14 max-w-5xl">
          <Badge variant="secondary" className="rounded-full text-xs mb-3 bg-white/15 text-primary-foreground border-0 hover:bg-white/15">
            {eyebrow}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>
          <p className="mt-3 text-sm md:text-base text-primary-foreground/85 max-w-2xl">{intro}</p>
          <p className="mt-4 text-xs text-primary-foreground/70">Last updated {lastUpdated}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-5xl grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Section nav */}
        <nav className="lg:sticky lg:top-20 order-2 lg:order-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 hidden lg:block">On this page</p>
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2 shrink-0 lg:shrink rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap lg:whitespace-normal"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {s.title}
                </a>
              );
            })}
          </div>
        </nav>

        {/* Sections */}
        <div className="lg:col-span-3 order-1 lg:order-2 space-y-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <section key={s.id} id={s.id} className="scroll-mt-24 rounded-xl border bg-background p-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-semibold">{s.title}</h2>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{s.content}</div>
              </section>
            );
          })}

          {/* Contact card */}
          <section className="rounded-xl border bg-muted/30 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Questions about this policy?</p>
                <p className="text-xs text-muted-foreground">We're happy to walk you through it.</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <CmsPage slug="privacy">
      <LegalLayout
        eyebrow="Privacy"
        title="Privacy Policy"
        intro="YH Connect respects your privacy. Here's a plain-language explanation of what we collect, how we use it, and how we keep it safe."
        lastUpdated="June 2025"
        contactEmail="privacy@yhconnect.ng"
        sections={[
          {
            id: "information-we-collect",
            title: "Information We Collect",
            icon: Database,
            content: (
              <>
                <p>We collect information you provide directly when you create an account, build a profile, or post a project, including your name, email, phone number, location, and portfolio details.</p>
                <p>We also collect usage data automatically, such as pages visited and actions taken on the platform, through cookies and analytics tools, to help us understand how YH Connect is used.</p>
              </>
            ),
          },
          {
            id: "how-we-use-it",
            title: "How We Use Your Information",
            icon: Eye,
            content: (
              <p>We use your information to operate the platform, match clients with professionals, facilitate transactions and escrow payments, send important notifications, verify identity for trust and safety, and improve our services over time.</p>
            ),
          },
          {
            id: "data-sharing",
            title: "Data Sharing",
            icon: Share2,
            content: (
              <p>We do not sell your data. We may share limited information with payment processors (Monnify), identity verification providers, and other service providers who help us operate the platform, always under strict confidentiality obligations.</p>
            ),
          },
          {
            id: "data-security",
            title: "Data Security",
            icon: Lock,
            content: (
              <p>We use industry-standard safeguards, including encrypted connections and access controls, to protect your data from unauthorized access, loss, or misuse. No system is perfectly secure, so we continuously review our practices.</p>
            ),
          },
          {
            id: "your-rights",
            title: "Your Rights",
            icon: UserCheck,
            content: (
              <p>You can access, update, or request deletion of your personal information at any time from your account settings, or by contacting us directly. You may also opt out of non-essential communications.</p>
            ),
          },
        ]}
      />
    </CmsPage>
  );
}

export function TermsPage() {
  return (
    <CmsPage slug="terms">
      <LegalLayout
        eyebrow="Legal"
        title="Terms of Service"
        intro="By using YH Connect, you agree to these terms. We've tried to keep them clear and to the point."
        lastUpdated="June 2025"
        contactEmail="legal@yhconnect.ng"
        sections={[
          {
            id: "accounts",
            title: "Accounts",
            icon: Users,
            content: (
              <p>You must be 18 or older to create an account on YH Connect. You are responsible for keeping your login credentials secure and for all activity that happens under your account.</p>
            ),
          },
          {
            id: "payments-escrow",
            title: "Payments & Escrow",
            icon: Wallet,
            content: (
              <p>All payments on YH Connect are processed through Monnify. When a client funds a project, money is held securely in escrow and only released to the professional once a milestone is approved, protecting both sides of the transaction.</p>
            ),
          },
          {
            id: "professional-conduct",
            title: "Professional Conduct",
            icon: HardHat,
            content: (
              <p>Clients and professionals are expected to communicate honestly, deliver work as agreed, and treat each other with respect. Misrepresenting qualifications, fraud, or abusive behavior may result in account suspension.</p>
            ),
          },
          {
            id: "dispute-resolution",
            title: "Dispute Resolution",
            icon: Scale,
            content: (
              <p>If a disagreement arises over a project, either party can open a dispute from the project workspace. Our support team reviews the evidence from both sides and makes a final decision on how escrowed funds are handled.</p>
            ),
          },
          {
            id: "termination",
            title: "Termination",
            icon: AlertTriangle,
            content: (
              <p>We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or put other users at risk. You may close your account at any time from your settings.</p>
            ),
          },
          {
            id: "governing-law",
            title: "Governing Law",
            icon: Gavel,
            content: (
              <p>These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes not resolved through our support team will be subject to the jurisdiction of Nigerian courts.</p>
            ),
          },
        ]}
      />
    </CmsPage>
  );
}

// ─── Default export: full home page ─────────────────────────────────────────
export function HomePage() {
  return (
    <>
      <Hero />
      <Highlights />
      <Categories />
      <HowItWorks />
      <FeaturedTalent />
      <RecentProjects />
      <WhyChoose />
      <ForWho />
      <CTABanner />
    </>
  );
}
