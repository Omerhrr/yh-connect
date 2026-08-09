"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError, type ReviewOut } from "@/lib/api";
import { toast } from "sonner";

export function ReviewCard({ review, canRespond, onResponded }: { review: ReviewOut; canRespond?: boolean; onResponded?: (updated: ReviewOut) => void }) {
  const [responding, setResponding] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitResponse = async () => {
    if (!responseText.trim()) return toast.error("Write a response first");
    setSubmitting(true);
    try {
      const updated = await api.respondToReview(review.id, responseText.trim());
      toast.success("Response posted");
      setResponding(false);
      onResponded?.(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not post response");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-b last:border-b-0 pb-3 last:pb-0 mb-3 last:mb-0">
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        ))}
        {review.reviewer_name && <span className="text-xs text-muted-foreground ml-1">by {review.reviewer_name}</span>}
      </div>
      {review.comment && <p className="text-sm mt-1">{review.comment}</p>}

      {review.response_body ? (
        <div className="mt-2 ml-3 pl-3 border-l-2 border-muted rounded-sm bg-muted/30 p-2">
          <p className="text-xs font-medium text-muted-foreground">Response</p>
          <p className="text-sm">{review.response_body}</p>
        </div>
      ) : canRespond ? (
        responding ? (
          <div className="mt-2 space-y-2">
            <textarea
              rows={2}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              placeholder="Write a public response to this review..."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={submitResponse} disabled={submitting}>{submitting ? "Posting..." : "Post Response"}</Button>
              <Button size="sm" variant="outline" onClick={() => setResponding(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setResponding(true)}>Respond</Button>
        )
      ) : null}
    </div>
  );
}
