"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  api,
  ApiError,
  type BlogPostOut,
  type CategoryOut,
  type ContentPageOut,
  type HighlightOut,
} from "@/lib/api";
import { toast } from "sonner";

type Tab = "pages" | "blog" | "highlights" | "categories";

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

// Slugs the public site actually renders via <CmsPage slug="..."> (see
// src/components/site/pages/HomePage.tsx). Keep this list in sync with that
// wiring: creating a page with any other slug here would be dead content
// with no route to show it.
const KNOWN_PAGE_SLUGS = ["privacy", "terms", "how-it-works"] as const;

// ─── Pages tab ────────────────────────────────────────────────────────────
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
            <Badge variant="outline" className="text-xs rounded-full">/{page.slug}</Badge>
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

// ─── Blog tab ─────────────────────────────────────────────────────────────
function BlogTab() {
  const [posts, setPosts] = useState<BlogPostOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          <div key={post.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{post.title}</p>
                <Badge className={`text-xs rounded-full ${post.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {post.published ? "Published" : "Draft"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">/{post.slug}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => togglePublish(post)}>
                {post.published ? "Unpublish" : "Publish"}
              </Button>
              <button onClick={() => remove(post)} className="text-muted-foreground hover:text-red-600 p-1.5">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Highlights tab ───────────────────────────────────────────────────────
function HighlightsTab() {
  const [highlights, setHighlights] = useState<HighlightOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"testimonial" | "stat" | "banner">("stat");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.adminHighlights().then(setHighlights).catch(() => toast.error("Could not load highlights")).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setSubmitting(true);
    try {
      await api.createHighlight({ type, title: title.trim(), sort_order: highlights.length });
      setTitle("");
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background p-5 flex gap-2 items-end flex-wrap">
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

      <div className="rounded-xl border bg-background divide-y">
        {highlights.length === 0 && <p className="p-5 text-sm text-muted-foreground">No highlights yet.</p>}
        {highlights.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs rounded-full capitalize">{h.type}</Badge>
                <p className="font-medium text-sm truncate">{h.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => toggleActive(h)}>{h.active ? "Deactivate" : "Activate"}</Button>
              <button onClick={() => remove(h)} className="text-muted-foreground hover:text-red-600 p-1.5">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Categories tab ───────────────────────────────────────────────────────
function CategoriesTab() {
  const [categories, setCategories] = useState<CategoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
            <div>
              <p className="font-medium text-sm">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.id}</p>
            </div>
            <button onClick={() => remove(c)} className="text-muted-foreground hover:text-red-600 p-1.5">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
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
        <TabButton active={tab === "blog"} onClick={() => setTab("blog")}>Blog</TabButton>
        <TabButton active={tab === "highlights"} onClick={() => setTab("highlights")}>Highlights</TabButton>
        <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>Categories</TabButton>
      </div>

      {tab === "pages" && <PagesTab />}
      {tab === "blog" && <BlogTab />}
      {tab === "highlights" && <HighlightsTab />}
      {tab === "categories" && <CategoriesTab />}
    </div>
  );
}
