import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  GitMerge,
  FileText,
  ClipboardCheck,
  Mail,
  MessageSquareQuote,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

interface Notification {
  id: number;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  unread: boolean;
  icon: LucideIcon;
}

const initialNotifications: Notification[] = [
  { id: 1, user: "AEGIS Scanner", action: "completed scan for", target: "vpn.pnb.co.in", timestamp: "10 minutes ago", unread: true, icon: GitMerge },
  { id: 2, user: "System", action: "generated", target: "CBOM Report v2.1", timestamp: "30 minutes ago", unread: true, icon: FileText },
  { id: 3, user: "PQC Engine", action: "flagged vulnerability in", target: "TLS 1.2 RSA-2048", timestamp: "2 hours ago", unread: false, icon: ClipboardCheck },
  { id: 4, user: "AEGIS Scanner", action: "queued scan for", target: "netbanking.pnb.co.in", timestamp: "5 hours ago", unread: false, icon: Mail },
  { id: 5, user: "System", action: "updated", target: "NIST compliance matrix", timestamp: "1 day ago", unread: false, icon: MessageSquareQuote },
  { id: 6, user: "System", action: "alert:", target: "Certificate expiry in 30 days", timestamp: "3 days ago", unread: false, icon: AlertCircle },
];

function NotificationInboxPopover() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((n) => n.unread).length;
  const [tab, setTab] = useState("all");

  const filtered = tab === "unread" ? notifications.filter((n) => n.unread) : notifications;

  const markAsRead = (id: number) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, unread: false })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-sunken transition-colors">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-status-critical text-white border-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end" sideOffset={8}>
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-2.5 py-1">All</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs px-2.5 py-1">
                  Unread {unreadCount > 0 && <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{unreadCount}</Badge>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              filtered.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left hover:bg-sunken transition-colors"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body text-foreground">
                        <span className="font-medium">{n.user}</span> {n.action}{" "}
                        <span className="font-medium">{n.target}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.timestamp}</p>
                    </div>
                    {n.unread && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-accent" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-border p-2">
          <Button variant="ghost" className="w-full text-xs text-muted-foreground h-8" onClick={() => navigate('/dashboard/history')}>
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { NotificationInboxPopover };
