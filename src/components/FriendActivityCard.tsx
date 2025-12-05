import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Calendar } from "lucide-react";
import { ActivityLikeButton } from "./ActivityLikeButton";
import { Button } from "./ui/button";
import { MessageCircle } from "lucide-react";
import { useStations } from "@/hooks/useStations";
import { MiniMapSnapshot } from "./MiniMapSnapshot";
import { RoundelGallery } from "./RoundelGallery";
import { ActivityExtraPhotos } from "./ActivityExtraPhotos";
import { formatDistanceToNow } from "date-fns";

interface FriendActivityCardProps {
  activity: {
    id: string;
    title: string | null;
    status: string;
    start_station_tfl_id: string | null;
    end_station_tfl_id: string | null;
    ended_at: string | null;
    user_id: string;
    station_tfl_ids: string[];
  };
  profile: {
    display_name: string | null;
    avatar_url: string | null;
    username: string | null;
  } | null;
  likesCount: number;
  commentsCount: number;
}

export const FriendActivityCard = ({ 
  activity, 
  profile,
  likesCount,
  commentsCount 
}: FriendActivityCardProps) => {
  const navigate = useNavigate();
  const { stations } = useStations();

  const getStationName = (tflId: string) => {
    const station = stations.find(s => s.id === tflId);
    return station ? station.displayName : tflId;
  };

  const displayName = profile?.display_name || profile?.username || "Anonymous";
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="w-10 h-10">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              completed an activity
            </p>
          </div>
          {activity.ended_at && (
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(activity.ended_at), { addSuffix: true })}
            </p>
          )}
        </div>
        <CardTitle className="flex items-center justify-between">
          <span>{activity.title || "Untitled Activity"}</span>
          <Badge>Completed</Badge>
        </CardTitle>
        <CardDescription>
          {activity.start_station_tfl_id && activity.end_station_tfl_id && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4" />
              <span>
                {getStationName(activity.start_station_tfl_id)} → {getStationName(activity.end_station_tfl_id)}
              </span>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini Map */}
        <MiniMapSnapshot
          type="activity"
          id={activity.id}
          stationSequence={activity.station_tfl_ids || []}
          updatedAt={activity.ended_at || new Date().toISOString()}
        />
        
        {/* Photo Thumbnails */}
        <RoundelGallery type="activity" id={activity.id} />
        <ActivityExtraPhotos activityId={activity.id} />

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{activity.station_tfl_ids?.length || 0} stations</span>
          </div>
          {activity.ended_at && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{new Date(activity.ended_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <ActivityLikeButton activityId={activity.id} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/activities/${activity.id}`)}
            className="flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{commentsCount}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
