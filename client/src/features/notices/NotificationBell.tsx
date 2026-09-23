import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../services/api";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await api.get("/notifications");
    setItems(data.items);
    setUnread(data.unread);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await api.patch("/notifications/read-all");
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-text-secondary hover:bg-surface dark:hover:bg-surface-dark"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto card shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-border-dark">
            <span className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary font-medium">Mark all read</button>
            )}
          </div>
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-secondary">No notifications yet.</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.isRead && markRead(n.id)}
              className={`w-full text-left px-4 py-3 border-b border-border dark:border-border-dark last:border-0 ${
                n.isRead ? "" : "bg-primary-light dark:bg-primary/10"
              }`}
            >
              <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">{n.title}</p>
              <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.message}</p>
              <p className="text-xs text-text-secondary mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
