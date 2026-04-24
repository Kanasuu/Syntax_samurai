import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Notification {
  id: string;
  user_id: string;
  type: "new_opportunity" | "status_update" | "recommendation" | "new_application";
  title: string;
  body: string;
  opportunity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useRealtimeNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchAll();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
          toast(n.title, { description: n.body });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchAll]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((p) => p.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };
  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  return { notifications, loading, unread, markRead, markAllRead, refresh: fetchAll };
}
