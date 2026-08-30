"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";import { api,
  ApiError,
  type BlogPostOut,
  type CategoryOut,
  type ContentPageOut,
  type FaqItemOut,
  type HighlightOut,
} from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import {
  SITE_CONTENT_DEFAULTS,
  invalidateSiteContentCache,
  type SiteContentKey,
  type NavLink,
  type FooterLinkColumn,
  type StepItem,
  type WhyChooseItem,
} from "@/lib/siteContent";

type Tab = "pages" | "blog" | "highlights" | "faq" | "categories" | "site-content";

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active ? "bg-slate-800 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {children}
    </button>
  );
}

const KNOWN_PAGE_SLUGS = ["privacy", "terms", "how-it-works", "client-project-terms"] as const;

function PagesTab() {
  const [pages, setPages] = useState<ContentPageOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, { title: string; body: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const availableSlugs = KNOWN_PAGE_SLUGS.filter((s) => !pages.some((p) => p.slug === s));

  const load = () => {
    setLoading(true);
    api.adminContentPages().then((data) => {
      setPages(data);
      setEditing(Object.fromEntries(data.map((p) => [p.id, { title: p.title, body: p.body }])));
    }).catch(() => toast.error("Could not load pages")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async (page: ContentPageOut) => {
    const draft = editing[page.id];
    if (!draft) return;
    setSaving(page.id);
    try {
      await api.patchContentPage(page.id, draft);
      toast.success("Page saved");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save page");
    } finally {
      setSaving(null);
    }
  };

  const createPage = async () => {
    if (!newSlug.trim()) return toast.error("Select a page first");
    const label = newSlug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    try {
      await api.upsertContentPage({ slug: newSlug.trim(), title: label, body: "" });
      setNewSlug("");
      toast.success("Page created");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create page");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      {availableSlugs.length > 0 && (
        <div className="flex gap-2 max-w-md">
          <select
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a page to create…</option>
            {availableSlugs.map((s) => (
              <option key={s} value={s}>/{s}</option>
            ))}
          </select>
          <Button onClick={createPage} disabled={!newSlug}><Plus className="h-3.5 w-3.5 mr-1" /> Create</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Only these slugs are wired into the live site (Privacy, Terms, How It Works). Editing them here replaces the default copy shown on those public pages.
      </p>
      {pages.length === 0 && <p className="text-sm text-muted-foreground">No content pages yet, select one above to override its default copy.</p>}
      {pages.map((page) => (
        <div key={page.id} className="rounded-xl border bg-background p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs rounded-full">/{page.slug}</Badge>
              {page.slug !== "client-project-terms" && (
                <Link href={`/${page.slug}`} target="_blank" className="text-xs text-primary hover:underline">View live page</Link>
              )}
            </div>
            <span className="text-xs text-muted-foreground">Updated {new Date(page.updated_at).toLocaleDateString()}</span>
          </div>
          <Input
            value={editing[page.id]?.title ?? ""}
            onChange={(e) => setEditing((prev) => ({ ...prev, [page.id]: { ...prev[page.id], title: e.target.value } }))}
            placeholder="Page title"
          />
          <textarea
            rows={6}
            value={editing[page.id]?.body ?? ""}
            onChange={(e) => setEditing((prev) => ({ ...prev, [page.id]: { ...prev[page.id], body: e.target.value } }))}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y font-mono"
            placeholder="Markdown or plain text body..."
          />
          <Button size="sm" disabled={saving === page.id} onClick={() => save(page)}>
            {saving === page.id ? "Saving..." : "Save"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function BlogTab() {
  const [posts, setPosts] = useState<BlogPostOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { slug: string; title: string; excerpt: string; body: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.adminBlogPosts().then(setPosts).catch(() => toast.error("Could not load posts")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!slug.trim() || !title.trim()) return toast.error("Slug and title are required");
    setSubmitting(true);
    try {
      await api.createBlogPost({ slug: slug.trim(), title: title.trim(), excerpt, body, published: false });
      toast.success("Draft created");
      setSlug(""); setTitle(""); setExcerpt(""); setBody(""); setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create post");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (post: BlogPostOut) => {
    setEditing((prev) => ({
      ...prev,
      [post.id]: { slug: post.slug, title: post.title, excerpt: post.excerpt || "", body: post.body },
    }));
    setEditingId(post.id);
  };

  const saveEdit = async (post: BlogPostOut) => {
    const draft = editing[post.id];
    if (!draft) return;
    if (!draft.slug.trim() || !draft.title.trim()) return toast.error("Slug and title are required");
    setSavingId(post.id);
    try {
      await api.patchBlogPost(post.id, {
        slug: draft.slug.trim(),
        title: draft.title.trim(),
        excerpt: draft.excerpt.trim() || undefined,
        body: draft.body,
      });
      toast.success("Post saved");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save post");
    } finally {
      setSavingId(null);
    }
  };

  const togglePublish = async (post: BlogPostOut) => {
    try {
      await api.patchBlogPost(post.id, { published: !post.published });
      toast.success(post.published ? "Unpublished" : "Published");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update post");
    }
  };

  const remove = async (post: BlogPostOut) => {
    if (!confirm(`Delete "${post.title}"?`)) return;
    try {
      await api.deleteBlogPost(post.id);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete post");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      {!open ? (
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> New Post</Button>
      ) : (
        <div className="rounded-xl border bg-background p-5 space-y-2">
          <Input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          <textarea rows={5} placeholder="Body" value={body} onChange={(e) => setBody(e.target.value)} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={submitting} onClick={create}>{submitting ? "Creating..." : "Create Draft"}</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-background divide-y">
        {posts.length === 0 && <p className="p-5 text-sm text-muted-foreground">No blog posts yet.</p>}
        {posts.map((post) => (
          <div key={post.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{post.title}</p>
                  <Badge className={`text-xs rounded-full ${post.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {post.published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">/{post.slug}
                  {post.published_at && <> · Published {new Date(post.published_at).toLocaleDateString()}</>}
                  {!post.published_at && <> · Created {new Date(post.created_at).toLocaleDateString()}</>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Link href={`/blog/${post.slug}`} target="_blank" className="text-xs text-muted-foreground hover:text-primary">View</Link>
                <Button size="sm" variant="outline" onClick={() => (editingId === post.id ? setEditingId(null) : startEdit(post))}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => togglePublish(post)}>
                  {post.published ? "Unpublish" : "Publish"}
                </Button>
                <button onClick={() => remove(post)} className="text-muted-foreground hover:text-red-600 p-1.5">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {editingId === post.id && (
              <div className="space-y-2 border-t pt-3">
                <Input
                  placeholder="Slug"
                  value={editing[post.id]?.slug ?? ""}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [post.id]: { ...prev[post.id], slug: e.target.value } }))}
                />
                <Input
                  placeholder="Title"
                  value={editing[post.id]?.title ?? ""}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [post.id]: { ...prev[post.id], title: e.target.value } }))}
                />
                <Input
                  placeholder="Excerpt"
                  value={editing[post.id]?.excerpt ?? ""}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [post.id]: { ...prev[post.id], excerpt: e.target.value } }))}
                />
                <textarea
                  rows={5}
                  placeholder="Body"
                  value={editing[post.id]?.body ?? ""}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [post.id]: { ...prev[post.id], body: e.target.value } }))}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button size="sm" disabled={savingId === post.id} onClick={() => saveEdit(post)}>
                    {savingId === post.id ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightsTab() {
  const [highlights, setHighlights] = useState<HighlightOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"testimonial" | "stat" | "banner">("stat");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ type: HighlightOut["type"]; title: string; body: string }>({ type: "stat", title: "", body: "" });
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.adminHighlights().then(setHighlights).catch(() => toast.error("Could not load highlights")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setSubmitting(true);
    try {
      await api.createHighlight({ type, title: title.trim(), body: body.trim() || undefined, sort_order: highlights.length });
      setTitle(""); setBody("");
      toast.success("Highlight added");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add highlight");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (h: HighlightOut) => {
    try {
      await api.patchHighlight(h.id, { active: !h.active });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update highlight");
    }
  };

  const startEdit = (h: HighlightOut) => {
    setEditDraft({ type: h.type, title: h.title, body: h.body || "" });
    setEditingId(h.id);
  };

  const saveEdit = async (h: HighlightOut) => {
    if (!editDraft.title.trim()) return toast.error("Title is required");
    setSavingId(h.id);
    try {
      await api.patchHighlight(h.id, {
        type: editDraft.type,
        title: editDraft.title.trim(),
        body: editDraft.body.trim() || undefined,
      });
      toast.success("Highlight saved");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save highlight");
    } finally {
      setSavingId(null);
    }
  };

  const move = async (h: HighlightOut, dir: -1 | 1) => {
    const sorted = [...highlights].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === h.id);
    const neighbor = sorted[idx + dir];
    if (!neighbor) return;
    try {
      await Promise.all([
        api.patchHighlight(h.id, { sort_order: neighbor.sort_order }),
        api.patchHighlight(neighbor.id, { sort_order: h.sort_order }),
      ]);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reorder");
    }
  };

  const remove = async (h: HighlightOut) => {
    if (!confirm(`Delete "${h.title}"?`)) return;
    try {
      await api.deleteHighlight(h.id);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete highlight");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const sorted = [...highlights].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background p-5 space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="stat">Stat</option>
              <option value="testimonial">Testimonial</option>
              <option value="banner">Banner</option>
            </select>
          </div>
          <Input placeholder="Title / text" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 min-w-[200px]" />
          <Button disabled={submitting} onClick={create}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
        </div>
        <Input placeholder="Body / supporting text (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <div className="rounded-xl border bg-background divide-y">
        {highlights.length === 0 && <p className="p-5 text-sm text-muted-foreground">No highlights yet.</p>}
        {sorted.map((h, i) => (
          <div key={h.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs rounded-full capitalize">{h.type}</Badge>
                  <p className="font-medium text-sm truncate">{h.title}</p>
                  {!h.active && <Badge className="text-[10px] rounded-full bg-gray-100 text-gray-500">Hidden</Badge>}
                </div>
                {h.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{h.body}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex flex-col">
                  <button disabled={i === 0} onClick={() => move(h, -1)} className="text-muted-foreground hover:text-primary disabled:opacity-30 p-0.5"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button disabled={i === sorted.length - 1} onClick={() => move(h, 1)} className="text-muted-foreground hover:text-primary disabled:opacity-30 p-0.5"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
                <Button size="sm" variant="outline" onClick={() => (editingId === h.id ? setEditingId(null) : startEdit(h))}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(h)}>{h.active ? "Deactivate" : "Activate"}</Button>
                <button onClick={() => remove(h)} className="text-muted-foreground hover:text-red-600 p-1.5">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {editingId === h.id && (
              <div className="space-y-2 border-t pt-3">
                <select
                  value={editDraft.type}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, type: e.target.value as HighlightOut["type"] }))}
                  className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="stat">Stat</option>
                  <option value="testimonial">Testimonial</option>
                  <option value="banner">Banner</option>
                </select>
                <Input placeholder="Title" value={editDraft.title} onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))} />
                <Input placeholder="Body (optional)" value={editDraft.body} onChange={(e) => setEditDraft((prev) => ({ ...prev, body: e.target.value }))} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button size="sm" disabled={savingId === h.id} onClick={() => saveEdit(h)}>
                    {savingId === h.id ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_FAQ_CATEGORIES = ["General", "For Clients", "For Professionals", "Payments & Escrow"];

function FaqTab() {
  const [items, setItems] = useState<FaqItemOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState(DEFAULT_FAQ_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ question: string; answer: string; category: string }>({ question: "", answer: "", category: "" });
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.adminFaq().then(setItems).catch(() => toast.error("Could not load FAQs")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const knownCategories = Array.from(new Set([...DEFAULT_FAQ_CATEGORIES, ...items.map((i) => i.category)]));

  const create = async () => {
    const finalCategory = category === "__custom" ? customCategory.trim() : category;
    if (!question.trim() || !answer.trim()) return toast.error("Question and answer are required");
    if (!finalCategory) return toast.error("Pick or enter a category");
    setSubmitting(true);
    try {
      const sameCategoryCount = items.filter((i) => i.category === finalCategory).length;
      await api.createFaqItem({ question: question.trim(), answer: answer.trim(), category: finalCategory, sort_order: sameCategoryCount });
      setQuestion(""); setAnswer(""); setCustomCategory("");
      toast.success("FAQ added");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add FAQ");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (item: FaqItemOut) => {
    try {
      await api.patchFaqItem(item.id, { active: !item.active });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update FAQ");
    }
  };

  const startEdit = (item: FaqItemOut) => {
    setEditDraft({ question: item.question, answer: item.answer, category: item.category });
    setEditingId(item.id);
  };

  const saveEdit = async (item: FaqItemOut) => {
    if (!editDraft.question.trim() || !editDraft.answer.trim()) return toast.error("Question and answer are required");
    setSavingId(item.id);
    try {
      await api.patchFaqItem(item.id, {
        question: editDraft.question.trim(),
        answer: editDraft.answer.trim(),
        category: editDraft.category.trim() || "General",
      });
      toast.success("FAQ saved");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save FAQ");
    } finally {
      setSavingId(null);
    }
  };

  const move = async (item: FaqItemOut, dir: -1 | 1) => {
    const sameCategory = items.filter((i) => i.category === item.category).sort((a, b) => a.sort_order - b.sort_order);
    const idx = sameCategory.findIndex((x) => x.id === item.id);
    const neighbor = sameCategory[idx + dir];
    if (!neighbor) return;
    try {
      await Promise.all([
        api.patchFaqItem(item.id, { sort_order: neighbor.sort_order }),
        api.patchFaqItem(neighbor.id, { sort_order: item.sort_order }),
      ]);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reorder");
    }
  };

  const remove = async (item: FaqItemOut) => {
    if (!confirm(`Delete "${item.question}"?`)) return;
    try {
      await api.deleteFaqItem(item.id);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete FAQ");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const grouped = knownCategories
    .map((cat) => ({ cat, entries: items.filter((i) => i.category === cat).sort((a, b) => a.sort_order - b.sort_order) }))
    .filter((g) => g.entries.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Shown on the public <Link href="/faq" target="_blank" className="text-primary hover:underline">/faq</Link> page, grouped by category. Inactive FAQs are hidden from visitors.
      </p>

      <div className="rounded-xl border bg-background p-5 space-y-3">
        <Input placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <textarea
          rows={3}
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
        />
        <div className="flex gap-2 items-end flex-wrap">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
              {knownCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__custom">+ New category…</option>
            </select>
          </div>
          {category === "__custom" && (
            <Input placeholder="New category name" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} className="max-w-[220px]" />
          )}
          <Button disabled={submitting} onClick={create}><Plus className="h-3.5 w-3.5 mr-1" /> Add FAQ</Button>
        </div>
      </div>

      {grouped.length === 0 && <p className="text-sm text-muted-foreground">No FAQs yet, add one above.</p>}

      {grouped.map(({ cat, entries }) => (
        <div key={cat} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h3>
          <div className="rounded-xl border bg-background divide-y">
            {entries.map((item, i) => (
              <div key={item.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{item.question}</p>
                      {!item.active && <Badge className="text-[10px] rounded-full bg-gray-100 text-gray-500">Hidden</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.answer}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex flex-col">
                      <button disabled={i === 0} onClick={() => move(item, -1)} className="text-muted-foreground hover:text-primary disabled:opacity-30 p-0.5"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button disabled={i === entries.length - 1} onClick={() => move(item, 1)} className="text-muted-foreground hover:text-primary disabled:opacity-30 p-0.5"><ChevronDown className="h-3.5 w-3.5" /></button>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => (editingId === item.id ? setEditingId(null) : startEdit(item))}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(item)}>{item.active ? "Hide" : "Show"}</Button>
                    <button onClick={() => remove(item)} className="text-muted-foreground hover:text-red-600 p-1.5">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {editingId === item.id && (
                  <div className="space-y-2 border-t pt-3">
                    <Input placeholder="Question" value={editDraft.question} onChange={(e) => setEditDraft((prev) => ({ ...prev, question: e.target.value }))} />
                    <textarea
                      rows={3}
                      placeholder="Answer"
                      value={editDraft.answer}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, answer: e.target.value }))}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                    />
                    <Input placeholder="Category" value={editDraft.category} onChange={(e) => setEditDraft((prev) => ({ ...prev, category: e.target.value }))} className="max-w-[220px]" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" disabled={savingId === item.id} onClick={() => saveEdit(item)}>
                        {savingId === item.id ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.categories().then(setCategories).catch(() => toast.error("Could not load categories")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!id.trim() || !label.trim()) return toast.error("Id and label are required");
    setSubmitting(true);
    try {
      await api.createCategory({ id: id.trim(), label: label.trim() });
      setId(""); setLabel("");
      toast.success("Category added");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add category");
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async (c: CategoryOut) => {
    if (!editLabel.trim()) return toast.error("Label is required");
    setSavingId(c.id);
    try {
      await api.patchCategory(c.id, { label: editLabel.trim() });
      toast.success("Category updated");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update category");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (c: CategoryOut) => {
    if (!confirm(`Delete "${c.label}"? This may fail if projects use it.`)) return;
    try {
      await api.deleteCategory(c.id);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete category");
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background p-5 flex gap-2 items-end flex-wrap">
        <Input placeholder="id (e.g. hvac-engineering)" value={id} onChange={(e) => setId(e.target.value)} className="max-w-[220px]" />
        <Input placeholder="Label (e.g. HVAC Engineering)" value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1 min-w-[200px]" />
        <Button disabled={submitting} onClick={create}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
      </div>
      <div className="rounded-xl border bg-background divide-y">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 p-4">
            {editingId === c.id ? (
              <div className="flex items-center gap-2 flex-1">
                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit(c)} className="max-w-xs" autoFocus />
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button size="sm" disabled={savingId === c.id} onClick={() => saveEdit(c)}>{savingId === c.id ? "Saving..." : "Save"}</Button>
              </div>
            ) : (
              <div>
                <p className="font-medium text-sm">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.id} · {c.professional_count} professional{c.professional_count === 1 ? "" : "s"}</p>
              </div>
            )}
            {editingId !== c.id && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => { setEditingId(c.id); setEditLabel(c.label); }} className="text-muted-foreground hover:text-primary p-1.5">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(c)} className="text-muted-foreground hover:text-red-600 p-1.5">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const SITE_CONTENT_SECTIONS: { key: SiteContentKey; label: string }[] = [
  { key: "header", label: "Header" },
  { key: "footer", label: "Footer" },
  { key: "homepage.hero", label: "Homepage · Hero" },
  { key: "homepage.how_it_works", label: "Homepage · How It Works" },
  { key: "homepage.why_choose", label: "Homepage · Why Choose Us" },
  { key: "homepage.cta_banner", label: "Homepage · CTA Banner" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}

function NavLinksArrayEditor({ links, onChange }: { links: NavLink[]; onChange: (links: NavLink[]) => void }) {
  const update = (i: number, patch: Partial<NavLink>) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const add = () => onChange([...links, { label: "", href: "" }]);

  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input placeholder="Label" value={l.label} onChange={(e) => update(i, { label: e.target.value })} className="flex-1" />
          <Input placeholder="/href or https://..." value={l.href} onChange={(e) => update(i, { href: e.target.value })} className="flex-1" />
          <button onClick={() => remove(i)} className="text-muted-foreground hover:text-red-600 p-1.5 shrink-0">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" /> Add Link</Button>
    </div>
  );
}

function HeroImagesEditor({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => api.uploadFile(f)));
      onChange([...images, ...uploaded.map((u) => u.url)]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((src, i) => (
            <div key={src + i} className="relative rounded-lg border overflow-hidden group">
              {}
              <img src={src} alt="" className="h-20 w-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded bg-white/90 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="p-1 rounded bg-white/90 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => remove(i)} className="p-1 rounded bg-white/90 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => upload(e.target.files)}
        disabled={uploading}
        className="text-xs"
      />
      {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
    </div>
  );
}

function SiteContentTab() {
  const [selectedKey, setSelectedKey] = useState<SiteContentKey>("header");
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [customized, setCustomized] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = () => {
    setLoading(true);
    api.adminSiteContent()
      .then((blocks) => {
        const byKey: Record<string, unknown> = {};
        const seen = new Set<string>();
        for (const b of blocks) {
          byKey[b.key] = { ...SITE_CONTENT_DEFAULTS[b.key as SiteContentKey], ...b.data };
          seen.add(b.key);
        }
        setDrafts({ ...SITE_CONTENT_DEFAULTS, ...byKey });
        setCustomized(seen);
      })
      .catch(() => toast.error("Could not load site content"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const draft = (drafts[selectedKey] ?? SITE_CONTENT_DEFAULTS[selectedKey]) as Record<string, unknown>;
  const setField = (patch: Record<string, unknown>) =>
    setDrafts((prev) => ({ ...prev, [selectedKey]: { ...(prev[selectedKey] as object), ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSiteContentBlock(selectedKey, draft);
      invalidateSiteContentCache();
      toast.success("Saved. Refresh the live page to see it.");
      setCustomized((prev) => new Set(prev).add(selectedKey));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!confirm("Reset this section back to the default copy? Your customizations will be lost.")) return;
    setResetting(true);
    try {
      await api.resetSiteContentBlock(selectedKey);
      invalidateSiteContentCache();
      setDrafts((prev) => ({ ...prev, [selectedKey]: SITE_CONTENT_DEFAULTS[selectedKey] }));
      setCustomized((prev) => {
        const next = new Set(prev);
        next.delete(selectedKey);
        return next;
      });
      toast.success("Reset to default");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reset");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground max-w-2xl">
        Edit the header nav, footer, and homepage sections shown on the live site. Sections you
        haven&apos;t customized fall back to the default copy shown here.
      </p>

      <div className="flex gap-2 flex-wrap">
        {SITE_CONTENT_SECTIONS.map((s) => (
          <TabButton key={s.key} active={selectedKey === s.key} onClick={() => setSelectedKey(s.key)}>
            {s.label}
            {customized.has(s.key) && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
          </TabButton>
        ))}
      </div>

      <div className="rounded-xl border bg-background p-5 space-y-4 max-w-2xl">
        {selectedKey === "header" && (
          <div className="space-y-2">
            <FieldLabel>Nav Links</FieldLabel>
            <NavLinksArrayEditor
              links={(draft as { nav_links: NavLink[] }).nav_links}
              onChange={(nav_links) => setField({ nav_links })}
            />
          </div>
        )}

        {selectedKey === "footer" && (
          <FooterForm draft={draft as never} setField={setField} />
        )}

        {selectedKey === "homepage.hero" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <FieldLabel>Heading</FieldLabel>
              <Input value={(draft.heading as string) ?? ""} onChange={(e) => setField({ heading: e.target.value })} />
            </div>
            <div className="space-y-1">
              <FieldLabel>Subheading</FieldLabel>
              <textarea rows={3} value={(draft.subheading as string) ?? ""} onChange={(e) => setField({ subheading: e.target.value })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
            </div>
            <div className="space-y-1">
              <FieldLabel>Search placeholder</FieldLabel>
              <Input value={(draft.search_placeholder as string) ?? ""} onChange={(e) => setField({ search_placeholder: e.target.value })} />
            </div>
            <div className="space-y-1">
              <FieldLabel>Button label</FieldLabel>
              <Input value={(draft.cta_label as string) ?? ""} onChange={(e) => setField({ cta_label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <FieldLabel>Popular searches (comma separated)</FieldLabel>
              <Input
                value={((draft.popular_searches as string[]) ?? []).join(", ")}
                onChange={(e) => setField({ popular_searches: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Background photos (optional)</FieldLabel>
              <p className="text-xs text-muted-foreground -mt-0.5">
                Shown blurred behind the hero text. With none uploaded, the hero stays exactly as it is now. With 2+, they slowly cross-fade for a subtle animated effect.
              </p>
              <HeroImagesEditor
                images={(draft.background_images as string[]) ?? []}
                onChange={(background_images) => setField({ background_images })}
              />
            </div>
          </div>
        )}

        {selectedKey === "homepage.how_it_works" && (
          <StepsForm
            badge={(draft.badge as string) ?? ""}
            title={(draft.title as string) ?? ""}
            subtitle={(draft.subtitle as string) ?? ""}
            steps={(draft.steps as StepItem[]) ?? []}
            primaryLabel={(draft.primary_cta_label as string) ?? ""}
            secondaryLabel={(draft.secondary_cta_label as string) ?? ""}
            onChange={(patch) => setField(patch)}
          />
        )}

        {selectedKey === "homepage.why_choose" && (
          <WhyChooseForm
            badge={(draft.badge as string) ?? ""}
            title={(draft.title as string) ?? ""}
            subtitle={(draft.subtitle as string) ?? ""}
            items={(draft.items as WhyChooseItem[]) ?? []}
            onChange={(patch) => setField(patch)}
          />
        )}

        {selectedKey === "homepage.cta_banner" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <FieldLabel>Title</FieldLabel>
              <Input value={(draft.title as string) ?? ""} onChange={(e) => setField({ title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <FieldLabel>Subtitle</FieldLabel>
              <textarea rows={2} value={(draft.subtitle as string) ?? ""} onChange={(e) => setField({ subtitle: e.target.value })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
            </div>
            <div className="space-y-1">
              <FieldLabel>Primary button label</FieldLabel>
              <Input value={(draft.primary_label as string) ?? ""} onChange={(e) => setField({ primary_label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <FieldLabel>Secondary button label</FieldLabel>
              <Input value={(draft.secondary_label as string) ?? ""} onChange={(e) => setField({ secondary_label: e.target.value })} />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save"}</Button>
          {customized.has(selectedKey) && (
            <Button size="sm" variant="outline" disabled={resetting} onClick={resetToDefault}>
              {resetting ? "Resetting..." : "Reset to Default"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FooterForm({
  draft,
  setField,
}: {
  draft: { tagline: string; social: { twitter: string; linkedin: string; instagram: string; email: string }; columns: FooterLinkColumn[]; copyright: string };
  setField: (patch: Record<string, unknown>) => void;
}) {
  const updateColumn = (i: number, patch: Partial<FooterLinkColumn>) =>
    setField({ columns: draft.columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const removeColumn = (i: number) => setField({ columns: draft.columns.filter((_, idx) => idx !== i) });
  const addColumn = () => setField({ columns: [...draft.columns, { title: "New Column", links: [] }] });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <FieldLabel>Tagline</FieldLabel>
        <textarea rows={2} value={draft.tagline} onChange={(e) => setField({ tagline: e.target.value })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <FieldLabel>Twitter URL</FieldLabel>
          <Input value={draft.social.twitter} onChange={(e) => setField({ social: { ...draft.social, twitter: e.target.value } })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>LinkedIn URL</FieldLabel>
          <Input value={draft.social.linkedin} onChange={(e) => setField({ social: { ...draft.social, linkedin: e.target.value } })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Instagram URL</FieldLabel>
          <Input value={draft.social.instagram} onChange={(e) => setField({ social: { ...draft.social, instagram: e.target.value } })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Contact email (mailto:...)</FieldLabel>
          <Input value={draft.social.email} onChange={(e) => setField({ social: { ...draft.social, email: e.target.value } })} />
        </div>
      </div>

      <div className="space-y-3">
        <FieldLabel>Link Columns</FieldLabel>
        {draft.columns.map((col, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <Input placeholder="Column title" value={col.title} onChange={(e) => updateColumn(i, { title: e.target.value })} className="flex-1" />
              <button onClick={() => removeColumn(i)} className="text-muted-foreground hover:text-red-600 p-1.5 shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <NavLinksArrayEditor links={col.links} onChange={(links) => updateColumn(i, { links })} />
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addColumn}><Plus className="h-3.5 w-3.5 mr-1" /> Add Column</Button>
      </div>

      <div className="space-y-1">
        <FieldLabel>Copyright text (year is added automatically)</FieldLabel>
        <Input value={draft.copyright} onChange={(e) => setField({ copyright: e.target.value })} />
      </div>
    </div>
  );
}

function StepsForm({
  badge,
  title,
  subtitle,
  steps,
  primaryLabel,
  secondaryLabel,
  onChange,
}: {
  badge: string;
  title: string;
  subtitle: string;
  steps: StepItem[];
  primaryLabel: string;
  secondaryLabel: string;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const updateStep = (i: number, patch: Partial<StepItem>) =>
    onChange({ steps: steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <FieldLabel>Badge</FieldLabel>
        <Input value={badge} onChange={(e) => onChange({ badge: e.target.value })} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Title</FieldLabel>
        <Input value={title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Subtitle</FieldLabel>
        <Input value={subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </div>
      <FieldLabel>Steps (icons and order are fixed; edit copy only)</FieldLabel>
      {steps.map((s, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <Input placeholder="Step title" value={s.title} onChange={(e) => updateStep(i, { title: e.target.value })} />
          <textarea rows={2} placeholder="Step description" value={s.description} onChange={(e) => updateStep(i, { description: e.target.value })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <FieldLabel>Primary button label</FieldLabel>
          <Input value={primaryLabel} onChange={(e) => onChange({ primary_cta_label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <FieldLabel>Secondary button label</FieldLabel>
          <Input value={secondaryLabel} onChange={(e) => onChange({ secondary_cta_label: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function WhyChooseForm({
  badge,
  title,
  subtitle,
  items,
  onChange,
}: {
  badge: string;
  title: string;
  subtitle: string;
  items: WhyChooseItem[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const updateItem = (i: number, patch: Partial<WhyChooseItem>) =>
    onChange({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <FieldLabel>Badge</FieldLabel>
        <Input value={badge} onChange={(e) => onChange({ badge: e.target.value })} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Title</FieldLabel>
        <Input value={title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1">
        <FieldLabel>Subtitle</FieldLabel>
        <Input value={subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
      </div>
      <FieldLabel>Items (icons and order are fixed; edit copy only)</FieldLabel>
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <Input placeholder="Item title" value={it.title} onChange={(e) => updateItem(i, { title: e.target.value })} />
          <textarea rows={2} placeholder="Item description" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
        </div>
      ))}
    </div>
  );
}

export default function AdminContentPage() {
  const [tab, setTab] = useState<Tab>("pages");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Content (CMS)</h1>
      <div className="flex gap-2 flex-wrap">
        <TabButton active={tab === "pages"} onClick={() => setTab("pages")}>Site Pages</TabButton>
        <TabButton active={tab === "site-content"} onClick={() => setTab("site-content")}>Site Content</TabButton>
        <TabButton active={tab === "blog"} onClick={() => setTab("blog")}>Blog</TabButton>
        <TabButton active={tab === "highlights"} onClick={() => setTab("highlights")}>Highlights</TabButton>
        <TabButton active={tab === "faq"} onClick={() => setTab("faq")}>FAQ</TabButton>
        <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>Categories</TabButton>
      </div>

      {tab === "pages" && <PagesTab />}
      {tab === "site-content" && <SiteContentTab />}
      {tab === "blog" && <BlogTab />}
      {tab === "highlights" && <HighlightsTab />}
      {tab === "faq" && <FaqTab />}
      {tab === "categories" && <CategoriesTab />}
    </div>
  );
}
