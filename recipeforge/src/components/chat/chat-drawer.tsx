"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle } from "lucide-react";
import type { ChatMessage, Recipe } from "@/types/recipe";

interface ChatDrawerProps {
  recipeId: string;
  onRecipeUpdate: (recipe: Recipe) => void;
}

export function ChatDrawer({ recipeId, onRecipeUpdate }: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      fetch(`/api/recipes/${recipeId}/chat`)
        .then((r) => r.json())
        .then((data) => setMessages(data.messages ?? []))
        .catch(() => {});
    }
  }, [open, recipeId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");
    setLoading(true);

    const tempMsg: ChatMessage = {
      id: Date.now().toString(),
      recipeId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch(`/api/recipes/${recipeId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        recipeId,
        role: "assistant",
        content: `Updated "${data.recipe.title}" based on your request.`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      onRecipeUpdate(data.recipe);
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        recipeId,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="fixed bottom-6 right-24 z-40 rounded-full shadow-lg h-12 w-12 p-0 bg-background border-2 border-border flex items-center justify-center hover:bg-accent transition-all active:scale-95">
        <MessageCircle className="h-5 w-5 text-primary" />
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[65vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle
            className="text-lg"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Recipe Chat
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full pt-3">
          <ScrollArea className="flex-1 pb-4">
            <div className="space-y-3 pr-4">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ask follow-up questions to refine this recipe.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 opacity-70">
                    Try "make it gluten-free" or "swap chicken for tofu."
                  </p>
                </div>
              )}

              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"} animate-slide-up-in`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "paper rounded-bl-md"
                      }`}
                      style={isUser ? {} : { transform: `rotate(${(i % 3) - 1} * 0.3deg)` }}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start animate-slide-up-in">
                  <div className="paper rounded-2xl rounded-bl-md px-4 py-3 text-sm">
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-3 border-t border-border">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about this recipe..."
              disabled={loading}
              className="text-base h-11"
            />
            <Button
              onClick={send}
              disabled={loading || !input.trim()}
              size="sm"
              className="font-semibold shrink-0"
            >
              Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
