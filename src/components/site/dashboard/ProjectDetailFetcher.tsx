"use client";

import { useEffect, useState } from "react";
import { ProjectWorkspace } from "@/components/site/pages/ProjectWorkspace";
import { api, ApiError, type ProjectOut } from "@/lib/api";

export function ProjectDetailFetcher({ projectId, backHref }: { projectId: string; backHref: string }) {
  const [project, setProject] = useState<ProjectOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .project(projectId)
      .then(setProject)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this project"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (error || !project) {
    return <p className="p-6 text-sm text-muted-foreground">{error || "Project not found."}</p>;
  }

  return <ProjectWorkspace project={project} backHref={backHref} />;
}
