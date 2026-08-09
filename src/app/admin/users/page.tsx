"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, type AdminUserOut, type UserRole } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .adminUsers({ q: q || undefined, role: role || undefined })
      .then(setUsers)
      .catch(() => toast.error("Could not load users"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleActive = async (user: AdminUserOut) => {
    setBusyId(user.id);
    try {
      await api.updateAdminUser(user.id, { is_active: !user.is_active });
      toast.success(user.is_active ? "User suspended" : "User reactivated");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update user");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Users</h1>

      <div className="flex gap-3">
        <Input placeholder="Search name or email..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="max-w-xs" />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole | "")}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          <option value="client">Client</option>
          <option value="professional">Professional</option>
          <option value="admin">Admin</option>
        </select>
        <Button onClick={load}>Search</Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="rounded-xl border bg-background divide-y">
        {!loading && users.length === 0 && <p className="p-5 text-sm text-muted-foreground">No users found.</p>}
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 p-4">
            <Link href={`/admin/users/${u.id}`} className="min-w-0 hover:underline">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{u.first_name} {u.last_name}</p>
                <Badge variant="outline" className="text-xs rounded-full capitalize">{u.role}</Badge>
                {!u.is_active && <Badge className="text-xs rounded-full bg-red-100 text-red-600">Suspended</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{u.email}{u.company_name ? ` · ${u.company_name}` : ""}</p>
            </Link>
            <Button
              size="sm"
              variant={u.is_active ? "outline" : "default"}
              disabled={busyId === u.id}
              onClick={() => toggleActive(u)}
            >
              {u.is_active ? "Suspend" : "Reactivate"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
