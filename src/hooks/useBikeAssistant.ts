import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ASSISTANT_CONFIG_STORAGE_KEY,
  ASSISTANT_SKILLS,
  DEFAULT_ASSISTANT_CONFIG,
  type AssistantConfig,
  type AssistantSkillId,
} from "@/lib/ai/skills";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function loadConfig(): AssistantConfig {
  if (typeof window === "undefined") return DEFAULT_ASSISTANT_CONFIG;
  try {
    const raw = window.localStorage.getItem(ASSISTANT_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_ASSISTANT_CONFIG;
    return { ...DEFAULT_ASSISTANT_CONFIG, ...JSON.parse(raw) } as AssistantConfig;
  } catch {
    return DEFAULT_ASSISTANT_CONFIG;
  }
}

export function useBikeAssistant() {
  const [config, setConfig] = useState<AssistantConfig>(loadConfig);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "thinking" | "answering">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(ASSISTANT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch { /* ignore */ }
  }, [config]);

  const updateConfig = useCallback((patch: Partial<AssistantConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleSkill = useCallback((id: AssistantSkillId) => {
    setConfig((prev) => ({
      ...prev,
      enabledSkills: prev.enabledSkills.includes(id)
        ? prev.enabledSkills.filter((s) => s !== id)
        : [...prev.enabledSkills, id],
    }));
  }, []);

  const activeSkills = useMemo(
    () => ASSISTANT_SKILLS.filter((s) => config.enabledSkills.includes(s.id)),
    [config.enabledSkills],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setStatus("idle");
  }, []);

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || status !== "idle") return;
      setError(null);

      const userMessage: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
      };
      const history = [...messages, userMessage];
      setMessages(history);
      setStatus("thinking");

      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = window.setTimeout(
        () => controller.abort(),
        Math.max(5, config.maxResponseSeconds) * 1000,
      );

      try {
        if (config.thinkingMs > 0) {
          await new Promise((r) => setTimeout(r, config.thinkingMs));
        }
        setStatus("answering");

        const { data, error: fnError } = await supabase.functions.invoke("bike-assistant", {
          body: {
            messages: history.map(({ role, content }) => ({ role, content })),
            skills: config.enabledSkills,
            assistantName: config.name,
            tone: config.tone,
          },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data?.content ?? "" },
        ]);
      } catch (e: any) {
        const message =
          e?.name === "AbortError"
            ? `No answer within ${config.maxResponseSeconds}s. Try again.`
            : e?.message === "rate_limited"
              ? "Too many requests — please wait a moment."
              : e?.message === "credits_exhausted"
                ? "AI credits exhausted. Add credits to continue."
                : "The assistant is unavailable right now.";
        setError(message);
      } finally {
        window.clearTimeout(timeout);
        abortRef.current = null;
        setStatus("idle");
      }
    },
    [config, messages, status],
  );

  return { config, updateConfig, toggleSkill, activeSkills, messages, status, error, send, reset };
}