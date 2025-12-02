import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Award, Clock, MapPin, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface LeaderboardEntry {
  id: string;
  user_id: string;
  duration_seconds: number | null;
  duration_minutes: number;
  stations_visited: number | null;
  completed_at: string;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  rank: number;
}

interface ChallengeLeaderboardProps {
  challengeId: string;
  challengeType: string;
  rankingMetric?: string | null;
}

export function ChallengeLeaderboard({ challengeId, challengeType, rankingMetric }: ChallengeLeaderboardProps) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine if ranking is by time (lower is better) or stations (higher is better)
  const isTimeRanked = rankingMetric === 'time' || 
    ['sequenced_route', 'unsequenced_route', 'point_to_point', 'station_count'].includes(challengeType);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      
      // Fetch personal best attempts for this challenge
      let query = supabase
        .from('challenge_attempts')
        .select('id, user_id, duration_seconds, duration_minutes, stations_visited, completed_at')
        .eq('challenge_id', challengeId)
        .eq('is_personal_best', true)
        .eq('status', 'completed');

      // Order by appropriate metric
      if (isTimeRanked) {
        query = query.order('duration_seconds', { ascending: true, nullsFirst: false });
      } else {
        // Timed challenges rank by stations visited (highest wins)
        query = query.order('stations_visited', { ascending: false, nullsFirst: false });
      }

      const { data: attempts, error } = await query.limit(50);

      if (error) {
        console.error('Error fetching leaderboard:', error);
        setLoading(false);
        return;
      }

      if (!attempts || attempts.length === 0) {
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for all users
      const userIds = [...new Set(attempts.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Add ranks and profiles
      const rankedEntries: LeaderboardEntry[] = attempts.map((attempt, index) => ({
        ...attempt,
        rank: index + 1,
        profile: profileMap.get(attempt.user_id),
      }));

      // Get top 10 for display
      const top10 = rankedEntries.slice(0, 10);
      setLeaderboard(top10);

      // Find current user's entry if not in top 10
      if (user) {
        const userRankedEntry = rankedEntries.find(e => e.user_id === user.id);
        if (userRankedEntry && userRankedEntry.rank > 10) {
          setUserEntry(userRankedEntry);
        } else {
          setUserEntry(null);
        }
      }

      setLoading(false);
    }

    fetchLeaderboard();
  }, [challengeId, challengeType, rankingMetric, isTimeRanked, user]);

  const formatDuration = (seconds: number | null, minutes: number) => {
    const totalSeconds = seconds ?? minutes * 60;
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center font-medium text-muted-foreground">{rank}</span>;
    }
  };

  const getDisplayName = (entry: LeaderboardEntry) => {
    return entry.profile?.display_name || entry.profile?.username || 'Anonymous';
  };

  const getInitials = (entry: LeaderboardEntry) => {
    const name = getDisplayName(entry);
    return name.slice(0, 2).toUpperCase();
  };

  const renderEntry = (entry: LeaderboardEntry, isCurrentUser: boolean) => (
    <div
      key={entry.id}
      className={`flex items-center gap-3 p-3 rounded-lg ${
        isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center justify-center w-8">
        {getRankIcon(entry.rank)}
      </div>
      
      <Avatar className="h-8 w-8">
        <AvatarImage src={entry.profile?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{getInitials(entry)}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isCurrentUser ? 'text-primary' : ''}`}>
          {getDisplayName(entry)}
          {isCurrentUser && <span className="text-xs ml-1 text-muted-foreground">(You)</span>}
        </p>
      </div>
      
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        {isTimeRanked ? (
          <>
            <Clock className="h-4 w-4" />
            <span>{formatDuration(entry.duration_seconds, entry.duration_minutes)}</span>
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4" />
            <span>{entry.stations_visited || 0} stations</span>
          </>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-muted/50 animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No completions yet</p>
            <p className="text-sm">Be the first to complete this challenge!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {leaderboard.map(entry => 
              renderEntry(entry, user?.id === entry.user_id)
            )}
            
            {userEntry && (
              <>
                <div className="flex items-center gap-2 py-2 text-muted-foreground">
                  <div className="flex-1 border-t border-dashed" />
                  <span className="text-xs">Your Position</span>
                  <div className="flex-1 border-t border-dashed" />
                </div>
                {renderEntry(userEntry, true)}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
