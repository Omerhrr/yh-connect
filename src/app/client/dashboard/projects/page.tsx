"use client";

import { useState } from "react";
import { ClientProjects, PostProjectDialog } from "@/components/site/pages/DashboardPages";

export default function Page() {
  const [postOpen, setPostOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <ClientProjects onPostProject={() => setPostOpen(true)} refreshKey={refreshKey} />
      <PostProjectDialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
