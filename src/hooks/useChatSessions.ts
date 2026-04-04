"use client";

import { createBrowserSupabase } from "@/src/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface UseChatSessionsReturn {
  sessions: ChatSession[];
  loading: boolean;
  createSession: (title?: string) => Promise<ChatSession | null>;
  deleteSession: (id: string) => Promise<void>;
  refetch: () => void;
}

export function useChatSessions(
  userId: string | undefined,
): UseChatSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const fetchSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setSessions(data as ChatSession[]);
    }

    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(
    async (title?: string): Promise<ChatSession | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ user_id: userId, title: title ?? "New Chat" })
        .select()
        .single();

      if (error || !data) return null;

      const session = data as ChatSession;
      setSessions((prev) => [session, ...prev]);
      return session;
    },
    [supabase, userId],
  );

  const deleteSession = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", id);

      if (!error) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    },
    [supabase],
  );

  return { sessions, loading, createSession, deleteSession, refetch: fetchSessions };
}
