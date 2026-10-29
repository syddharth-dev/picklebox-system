import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import picklebotIcon from "@/assets/picklebot-avatar.jpg";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm **PickleBot** 🎾 — ask me anything about **The Pickle Box**: booking courts, GCash payments, pricing, or your account.",
};

export function FAQChatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!user) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Please sign in to chat with PickleBot." },
      ]);
      return;
    }
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("faq-chat", {
        body: { messages: next.filter((m) => m !== GREETING) },
      });
      if (error) throw error;
      const reply = (data as any)?.reply ?? (data as any)?.error ?? "Sorry, something went wrong.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "⚠️ I couldn't reach the server. Please try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        className={cn(
          "fixed bottom-5 right-5 z-[60] h-14 w-14 rounded-full shadow-lg",
          "bg-primary text-primary-foreground flex items-center justify-center",
          "hover:scale-105 transition-transform"
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <img
            src={picklebotIcon}
            alt="PickleBot"
            className="h-11 w-11 object-contain rounded-full"
          />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden",
            "bottom-24 right-5 w-[calc(100vw-2.5rem)] max-w-[380px] h-[70vh] max-h-[560px]",
            "rounded-2xl border border-border bg-card shadow-2xl animate-fade-in"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary text-primary-foreground">
            <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
              <img
                src={picklebotIcon}
                alt="PickleBot"
                className="h-9 w-9 object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">PickleBot</div>
              <div className="text-xs opacity-80">FAQ Assistant · The Pickle Box</div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-strong:text-current">
                    <ReactMarkdown allowedElements={["p", "em", "strong", "ul", "ol", "li", "br", "code"]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border p-3 bg-card"
          >
            <input
              ref={inputRef}
              aria-label="Ask PickleBot"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about bookings, payments…"
              className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              maxLength={500}
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full h-9 w-9 shrink-0"
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
