import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Notification } from "@/hooks/useNotifications";

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

export const NotificationItem = ({ notification, onClick }: NotificationItemProps) => {
  const getNotificationMessage = () => {
    const actorName = notification.actor?.display_name || 'Someone';
    
    if (notification.type === 'like') {
      return `${actorName} liked your activity`;
    } else if (notification.type === 'comment') {
      return `${actorName} commented on your activity`;
    }
    return 'New notification';
  };

  const getNotificationIcon = () => {
    if (notification.type === 'like') {
      return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
    } else if (notification.type === 'comment') {
      return <MessageCircle className="w-4 h-4 text-blue-500" />;
    }
    return null;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/50 last:border-0",
        !notification.read && "bg-accent/10"
      )}
    >
      <Avatar className="w-10 h-10">
        <AvatarImage src={notification.actor?.avatar_url || undefined} />
        <AvatarFallback>
          {notification.actor?.display_name?.charAt(0).toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {getNotificationIcon()}
          <p className={cn(
            "text-sm",
            !notification.read && "font-semibold"
          )}>
            {getNotificationMessage()}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1" />
      )}
    </div>
  );
};
