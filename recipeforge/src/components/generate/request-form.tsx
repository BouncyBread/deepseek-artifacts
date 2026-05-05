"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Clock, CheckCircle2 } from "lucide-react";

interface RequestItem {
  id: string;
  prompt: string;
  status: "pending" | "completed";
  recipe_id?: string;
  created_at: string;
}

export function RequestForm() {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState<RequestItem[]>([]);

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/requests");
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch {}
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  const submit = async () => {
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to submit");
      }

      setPrompt("");
      setSubmitted(true);
      fetchRequests();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="paper rounded-xl p-5 space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Request a Recipe
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Claude Opus will research and hand-craft your recipe with beautiful
            typography, illustrations, and in-depth technique guidance.
          </p>
        </div>

        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="What dish would you like?"
          disabled={submitting}
          className="text-base h-12 border-2"
        />

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          onClick={submit}
          disabled={submitting || !prompt.trim()}
          size="lg"
          className="w-full text-base font-semibold"
        >
          {submitting ? (
            "Submitting..."
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Send Request
            </>
          )}
        </Button>

        {submitted && (
          <p className="text-sm text-center text-muted-foreground animate-slide-up-in">
            Request sent. Check back soon for your hand-crafted recipe.
          </p>
        )}
      </div>

      {requests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
            Your Requests
          </h3>
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface text-sm"
                >
                  {req.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-warmth shrink-0" />
                  )}
                  <span className="flex-1 truncate">{req.prompt}</span>
                  <Badge
                    variant="secondary"
                    className={`text-xs shrink-0 ${
                      req.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : ""
                    }`}
                  >
                    {req.status === "completed" ? "Ready" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
