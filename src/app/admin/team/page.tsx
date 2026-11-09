"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, ApiError, type StaffMember, type StaffRole } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { canAccess } from "@/lib/adminAccess";

type Area = { key: string; label: string; description: string };
type Level = "none" | "view" | "manage";

function levelOf(perms: string[], area: string): Level {
  if (perms.includes(`${area}:manage`)) return "manage";
  if (perms.includes(`${area}:view`)) return "view";
  return "none";
}

function toPerms(levels: Record<string, Level>): string[] {
  const out: string[] = [];
  for (const [area, lvl] of Object.entries(levels)) {
    if (lvl === "view") out.push(`${area}:view`);
    if (lvl === "manage") out.push(`${area}:manage`, `${area}:view`);
  }
  return out;
}

function RoleEditor({
  areas, role, onSaved, onCancel,
}: { areas: Area[]; role: StaffRole | null; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [levels, setLevels] = useState<Record<string, Level>>(
    () => Object.fromEntries(areas.map((a) => [a.key, levelOf(role?.permissions ?? [], a.key)]))
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const permissions = toPerms(levels);
    if (!name.trim()) return toast.error("Give the role a name");
    if (permissions.length === 0) return toast.error("Pick at least one permission");
    setBusy(true);
    try {
      if (role) await api.staffUpdateRole(role.id, { name, description, permissions });
      else await api.staffCreateRole({ name, description, permissions });
      toast.success("Role saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save role");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background p-5 space-y-4">
      <h3 className="font-semibold">{role ? `Edit role: ${role.name}` : "New role"}</h3>
      <div className="grid sm:grid-cols-2 gap-2">
        <Input placeholder="Role name, e.g. Support" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="rounded-lg border divide-y">
        <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Section</span>
          <span className="grid grid-cols-3 gap-2 w-60 text-center"><span>No access</span><span>View only</span><span>View &amp; edit</span></span>
        </div>
        {areas.map((a) => (
          <div key={a.key} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground">{a.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 w-60 justify-items-center">
              {(["none", "view", "manage"] as const).map((l) => (
                <input
                  key={l}
                  type="radio"
                  name={`perm-${a.key}`}
                  aria-label={`${a.label}: ${l}`}
                  checked={levels[a.key] === l}
                  onChange={() => setLevels((prev) => ({ ...prev, [a.key]: l }))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button disabled={busy} onClick={save}>Save role</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function AdminTeamPage() {
  const me = useAuth((s) => s.user);
  const [tab, setTab] = useState<"members" | "roles">("members");
  const [areas, setAreas] = useState<Area[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [editing, setEditing] = useState<StaffRole | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", role_id: "" });

  const load = () => {
    api.staffCatalog().then((c) => setAreas(c.areas)).catch(() => {});
    api.staffRoles().then(setRoles).catch(() => toast.error("Could not load roles"));
    api.staffMembers().then(setMembers).catch(() => toast.error("Could not load team"));
  };
  useEffect(load, []);

  const roleName = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r.name])), [roles]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); load(); } catch (err) { toast.error(err instanceof ApiError ? err.message : "Something went wrong"); } finally { setBusy(false); }
  };

  if (!canAccess(me, "staff")) {
    return <p className="text-sm text-muted-foreground">Only full administrators can manage the team.</p>;
  }

  return (
    <div className="space-y-5 max-w-3xl pb-16">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserCog className="h-6 w-6" /> Team &amp; Access</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create staff logins and decide exactly which sections each person can see and change. People only see the parts of the admin they&apos;ve been given.
        </p>
      </div>

      <div className="flex gap-2">
        {(["members", "roles"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-3 py-1 text-sm ${tab === t ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>
            {t === "members" ? "People" : "Roles"}
          </button>
        ))}
      </div>

      {secret && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-1">
          <p className="text-sm font-semibold">Temporary password for {secret.email}</p>
          <p className="font-mono text-sm">{secret.password}</p>
          <p className="text-xs text-muted-foreground">Shown once. Send it to them securely; they sign in at /admin/login and should change it in Settings.</p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(secret.password); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>Done</Button>
          </div>
        </div>
      )}

      {tab === "members" && (
        <>
          <section className="rounded-xl border bg-background p-5 space-y-3">
            <h2 className="font-semibold">People with admin access</h2>
            {members.map((m) => {
              const self = m.id === me?.id;
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 flex-wrap rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {m.first_name} {m.last_name} {self && <span className="text-xs text-muted-foreground">(you)</span>}
                      {!m.is_active && <Badge className="ml-2 text-xs rounded-full bg-red-100 text-red-600">Deactivated</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
                      value={m.is_full_admin ? "" : (m.role_id ?? "")}
                      disabled={busy || self}
                      onChange={(e) => run(async () => {
                        await api.staffUpdateMember(m.id, e.target.value ? { role_id: e.target.value } : { set_full_admin: true });
                        toast.success("Access updated");
                      })}
                    >
                      <option value="">Full admin (everything)</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    {!self && (
                      <>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => {
                          const r = await api.staffUpdateMember(m.id, { reset_password: true });
                          if (r.temporary_password) setSecret({ email: m.email, password: r.temporary_password });
                        })}>Reset password</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => {
                          await api.staffUpdateMember(m.id, { is_active: !m.is_active });
                        })}>{m.is_active ? "Deactivate" : "Activate"}</Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-xl border bg-background p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Add a team member</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              <Input placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              <Input type="email" placeholder="Email (their login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                <option value="">Full admin (everything)</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {!form.role_id && <p className="text-xs text-amber-600">Full admins can see and change everything, including this page. Create a role below to limit access.</p>}
            <Button
              disabled={busy || !form.email.trim() || !form.first_name.trim() || !form.last_name.trim()}
              onClick={() => run(async () => {
                const r = await api.staffCreateMember({ ...form, role_id: form.role_id || null });
                setSecret({ email: r.email, password: r.temporary_password });
                setForm({ email: "", first_name: "", last_name: "", role_id: form.role_id });
                toast.success(`Account created${r.role_name ? ` as ${r.role_name}` : ""}`);
              })}
            >
              Create login
            </Button>
          </section>
        </>
      )}

      {tab === "roles" && (
        <>
          {editing ? (
            <RoleEditor
              areas={areas}
              role={editing === "new" ? null : editing}
              onCancel={() => setEditing(null)}
              onSaved={() => { setEditing(null); load(); }}
            />
          ) : (
            <section className="rounded-xl border bg-background p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Roles</h2>
                <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4 mr-1" /> New role</Button>
              </div>
              {roles.length === 0 && <p className="text-sm text-muted-foreground">No roles yet. Create one, for example &quot;Support&quot; with view &amp; edit on Disputes and Users.</p>}
              {roles.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{r.name} <span className="text-xs text-muted-foreground">· {r.member_count} {r.member_count === 1 ? "person" : "people"}</span></p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => {
                        if (!confirm(`Delete the role "${r.name}"?`)) return;
                        run(async () => { await api.staffDeleteRole(r.id); toast.success("Role deleted"); });
                      }}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </div>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {areas.filter((a) => levelOf(r.permissions, a.key) !== "none").map((a) => (
                      <Badge key={a.key} variant="outline" className="text-xs rounded-full">
                        {a.label} · {levelOf(r.permissions, a.key) === "manage" ? "view & edit" : "view"}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Team members: {members.length} ({members.filter((m) => !roleName[m.role_id ?? ""] && m.is_full_admin).length} full admin)</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
