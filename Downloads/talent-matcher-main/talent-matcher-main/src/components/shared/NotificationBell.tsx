import { Bell, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { fmtDate } from "@/lib/utils-format";

const TYPE_ICON: Record<string, string> = {
  new_opportunity: "💼",
  status_update:   "📋",
  recommendation:  "⭐",
  new_application: "📝",
};

export function NotificationBell({ userId }: { userId?: string }) {
  const { notifications, unread, markRead, markAllRead } = useRealtimeNotifications(userId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs">
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`p-3 border-b last:border-0 cursor-pointer hover:bg-secondary/40 transition-colors ${!n.is_read ? "bg-accent/5" : ""}`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Unread dot */}
                  <span className={`mt-1.5 shrink-0 ${!n.is_read ? "h-2 w-2 rounded-full bg-accent" : "h-2 w-2"}`} />

                  <div className="flex-1 min-w-0">
                    {/* Type icon + title */}
                    <div className="flex items-start gap-1.5">
                      <span className="text-base leading-none mt-0.5">{TYPE_ICON[n.type] || "🔔"}</span>
                      <div className="font-medium text-sm leading-snug">{n.title}</div>
                    </div>

                    {/* Body */}
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.body}</div>

                    {/* Apply Now button if opportunity is linked */}
                    {n.opportunity_id && (
                      <a
                        href={`/student/browse?highlight=${n.opportunity_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View & Apply
                      </a>
                    )}

                    {/* Timestamp */}
                    <div className="text-[10px] text-muted-foreground mt-1.5">{fmtDate(n.created_at)}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
