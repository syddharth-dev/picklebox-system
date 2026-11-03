import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import picklebotIcon from "@/assets/picklebot-avatar-256.jpg";
import { Link, useLocation } from "react-router-dom";

type Msg = { role: "user" | "assistant"; content: string };
type ChatUser = ReturnType<typeof useAuth>["user"];

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm **PickleBot**. I can help with court bookings, Open Play, GCash payments, and check-in passes.",
};

export function FAQChatbot() {
  const { user } = useAuth();
  return <FAQChatbotSession key={user?.id ?? "anonymous"} user={user} />;
}

function FAQChatbotSession({ user }: { user: ChatUser }) {
  const { pathname } = useLocation();
  const aboveCheckout = pathname === "/courts" || pathname === "/checkout";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const requestVersion = useRef({ version: 0 });

  const closeChat = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    const requests = requestVersion.current;
    return () => { requests.version++; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => (user ? inputRef.current : closeButtonRef.current)?.focus(), 50);
    return () => clearTimeout(timeout);
  }, [open, loading, user]);

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
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-controls="picklebot-panel"
          className={cn(
            "fixed right-4 z-[45] flex h-14 items-center gap-2 rounded-full border border-white/20 bg-brand-ink p-1.5 pr-1.5 text-white shadow-lg transition-colors hover:bg-brand-ink/95 focus-visible:outline-brand-lime sm:right-6 md:pr-5",
            aboveCheckout ? "bottom-28" : "bottom-5"
          )}
        >
          <img
            src={picklebotIcon}
            alt="PickleBot"
            width={44}
            height={44}
            className="h-11 w-11 rounded-full bg-white object-contain"
          />
          <span className="hidden text-sm font-semibold md:inline">Ask PickleBot</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          id="picklebot-panel"
          role="dialog"
          aria-modal="false"
          aria-label="PickleBot assistant"
          onKeyDown={(event) => { if (event.key === "Escape") closeChat(); }}
          className={cn(
            "fixed z-[45] flex flex-col overflow-hidden",
            "bottom-3 right-3 h-[min(520px,calc(100dvh-1.5rem))] w-[calc(100vw-1.5rem)] max-w-[380px] sm:bottom-6 sm:right-6 sm:h-[min(560px,calc(100dvh-3rem))]",
            "overscroll-contain rounded-xl border border-border bg-card shadow-2xl animate-fade-in",
            aboveCheckout && "sm:bottom-28"
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-brand-ink px-4 py-4 text-white">
            <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
              <img
                src={picklebotIcon}
                alt="PickleBot"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">PickleBot</div>
              <div className="mt-1 text-xs text-white/65">A little help before you play</div>
            </div>
            <button ref={closeButtonRef} type="button" onClick={closeChat} aria-label="Close chat"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-brand-lime">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
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
              name="picklebot-question"
              autoComplete="off"
              spellCheck={false}
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
