import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GeminiChatProps {
  className?: string;
  title?: string;
  greeting?: string;
}

export function GeminiChat({
  className,
  title = "WJ Assistant",
  greeting = "Hi! Ask me anything about your e-bike, services or plans.",
}: GeminiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-gemini", {
        body: { messages: next },
      });

      const reply = (data as { reply?: string; error?: string } | null)?.reply;
      if (error || !reply) {
        const detail = (data as { error?: string } | null)?.error;
        throw new Error(detail || error?.message || "No reply");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("chat-gemini error:", err);
      toast({
        title: "I couldn't answer right now",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I couldn't answer right now — please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/40">
        <Sparkles className="h-4 w-4 text-wj-green" />
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-[280px] max-h-[60vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">{greeting}</p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-wj-green/15 text-foreground border border-wj-green/30"
                    : "bg-muted/50 text-foreground border border-border/40",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              typing…
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-border/40 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Write your message…"
          rows={1}
          className="min-h-[44px] max-h-32 resize-none bg-muted/40 border-border/50 focus-visible:ring-wj-green/40"
        />
        <Button
          onClick={() => void send()}
          disabled={isLoading || !input.trim()}
          size="icon"
          className="h-11 w-11 shrink-0 gradient-wj text-primary-foreground"
          aria-label="Send message"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default GeminiChat;