import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import picklebotIcon from "@/assets/picklebot-avatar.jpg";
import { Link, useLocation } from "react-router-dom";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm **PickleBot** 🎾 — ask me anything about **The Pickle Box**: booking courts, GCash payments, pricing, or your account.",
};

export function FAQChatbot() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const aboveCheckout = pathname === "/courts" || pathname === "/checkout";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestVersion = useRef({ version: 0 });

  useEffect(() => {
    const requests = requestVersion.current;
    requests.version++;
    setMessages([GREETING]);
    setInput("");
    setLoading(false);
    return () => { requests.version++; };
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timeout);
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
    const version = requestVersion.current.version;
    try {
      const { data, error } = await supabase.functions.invoke("faq-chat", {
        body: { messages: next.filter((m) => m !== GREETING).slice(-20).map((message) => ({ ...message, content: message.content.slice(0, 2000) })) },
      });
      if (version !== requestVersion.current.version) return;
      if (error) throw error;
      const payload = data as { reply?: unknown; error?: unknown } | null;
      const reply = typeof payload?.reply === "string" ? payload.reply : typeof payload?.error === "string" ? payload.error : "I couldn't load a reply. Please try again.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      if (version !== requestVersion.current.version) return;
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "⚠️ I couldn't reach the server. Please try again in a moment." },
      ]);
    } finally {
      if (version === requestVersion.current.version) setLoading(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        aria-controls="picklebot-panel"
        className={cn(
          "fixed right-4 z-[45] flex h-14 items-center gap-2 rounded-full border border-white/20 bg-brand-ink p-1.5 text-white shadow-lg transition-colors hover:bg-brand-ink/95 focus-visible:outline-brand-lime sm:right-6",
          aboveCheckout ? "bottom-28" : "bottom-5",
          open ? "w-14 justify-center" : "pr-1.5 md:pr-5"
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <img
            src={picklebotIcon}
            alt="PickleBot"
            className="h-11 w-11 rounded-full bg-white object-contain"
          />
        )}
        {!open && <span className="hidden text-sm font-semibold md:inline">Ask PickleBot</span>}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          id="picklebot-panel"
          role="region"
          aria-label="PickleBot assistant"
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          className={cn(
            "fixed z-[45] flex flex-col overflow-hidden",
            "right-4 h-[min(560px,calc(100dvh-12rem))] w-[calc(100vw-2rem)] max-w-[380px] sm:right-6",
            "rounded-xl border border-border bg-card shadow-2xl animate-fade-in",
            aboveCheckout ? "bottom-44" : "bottom-24"
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-brand-ink px-4 py-4 text-white">
            <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
              <img
                src={picklebotIcon}
                alt="PickleBot"
                className="h-9 w-9 object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">PickleBot</div>
              <div className="mt-1 text-xs text-white/65">A little help before you play</div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background/50 p-4" aria-live="polite" aria-relevant="additions">
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

          {!user && <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground"><Link to="/auth" className="font-semibold text-primary underline underline-offset-4">Sign in</Link> to chat, or <Link to="/help" className="font-semibold text-primary underline underline-offset-4">browse common questions</Link>.</p>}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex shrink-0 items-center gap-2 border-t border-border bg-card p-3"
          >
            <input
              ref={inputRef}
              aria-label="Ask PickleBot"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about bookings, payments…"
              className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring md:text-sm"
              maxLength={500}
              disabled={loading || !user}
            />
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-lg"
              disabled={loading || !user || !input.trim()}
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
