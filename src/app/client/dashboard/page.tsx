"use client";

import { useState } from "react";
import { ClientOverview, PostProjectDialog } from "@/components/site/pages/DashboardPages";

export default function Page() {
  const [postOpen, setPostOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <ClientOverview key={refreshKey} onPostProject={() => setPostOpen(true)} />
      <PostProjectDialog
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
