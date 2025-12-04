import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, Clock, MapPin, User, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { VERIFICATION_LEVEL_CONFIG, RequiredVerification } from '@/lib/challengeVerification';

interface LeaderboardEntry {
  id: string;
  user_id: string;
  duration_seconds: number | null;
  duration_minutes: number;
  stations_visited: number | null;
  completed_at: string;
  activity_id: string;
  verification_level?: RequiredVerification | null;
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
  requiredVerification?: string | null;
}

type FilterOption = 'all' | RequiredVerification;

export function ChallengeLeaderboard({ 
  challengeId, 
  challengeType, 
  rankingMetric,
  requiredVerification = 'remote_verified'
}: ChallengeLeaderboardProps) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [filteredLeaderboard, setFilteredLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationFilter, setVerificationFilter] = useState<FilterOption>('all');

  // Determine if ranking is by time (lower is better) or stations (higher is better)
  const isTimeRanked = rankingMetric === 'time' || 
    ['sequenced_route', 'unsequenced_route', 'point_to_point', 'station_count'].includes(challengeType);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      
      // Fetch personal best attempts for this challenge
      let query = supabase
        .from('challenge_attempts')
        .select('id, user_id, duration_seconds, duration_minutes, stations_visited, completed_at, activity_id')
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

      const { data: attempts, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching leaderboard:', error);
        setLoading(false);
        return;
      }

      if (!attempts || attempts.length === 0) {
        setLeaderboard([]);
        setFilteredLeaderboard([]);
        setLoading(false);
        return;
      }

      // Fetch activity verification levels
      const activityIds = [...new Set(attempts.map(a => a.activity_id))];
      const { data: activities } = await supabase
        .from('activities')
        .select('id, verification_level')
        .in('id', activityIds);

      const activityVerificationMap = new Map(activities?.map(a => [a.id, a.verification_level]) || []);

      // Fetch profiles for all users
      const userIds = [...new Set(attempts.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Add ranks, profiles, and verification levels
      const rankedEntries: LeaderboardEntry[] = attempts.map((attempt, index) => ({
        ...attempt,
        rank: index + 1,
        profile: profileMap.get(attempt.user_id),
        verification_level: activityVerificationMap.get(attempt.activity_id) as RequiredVerification | null,
      }));

      setLeaderboard(rankedEntries);
      setLoading(false);
    }

    fetchLeaderboard();
  }, [challengeId, challengeType, rankingMetric, isTimeRanked]);

  // Apply verification filter
  useEffect(() => {
    if (verificationFilter === 'all') {
      const top10 = leaderboard.slice(0, 10);
      setFilteredLeaderboard(top10);
      
      if (user) {
        const userRankedEntry = leaderboard.find(e => e.user_id === user.id);
        if (userRankedEntry && userRankedEntry.rank > 10) {
          setUserEntry(userRankedEntry);
        } else {
          setUserEntry(null);
        }
      }
    } else {
      // Filter by verification level (only show entries that meet or exceed the filter level)
      const acceptableLevels: RequiredVerification[] = verificationFilter === 'location_verified' 
        ? ['location_verified']
        : verificationFilter === 'photo_verified'
        ? ['location_verified', 'photo_verified']
        : ['location_verified', 'photo_verified', 'remote_verified'];

      const filtered = leaderboard
        .filter(entry => entry.verification_level && acceptableLevels.includes(entry.verification_level))
        .map((entry, index) => ({ ...entry, rank: index + 1 })); // Re-rank after filtering

      const top10 = filtered.slice(0, 10);
      setFilteredLeaderboard(top10);

      if (user) {
        const userRankedEntry = filtered.find(e => e.user_id === user.id);
        if (userRankedEntry && userRankedEntry.rank > 10) {
          setUserEntry(userRankedEntry);
        } else {
          setUserEntry(null);
        }
      }
    }
  }, [leaderboard, verificationFilter, user]);

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

  const getVerificationBadge = (level: RequiredVerification | null | undefined) => {
    if (!level) return null;
    const config = VERIFICATION_LEVEL_CONFIG[level];
    if (!config) return null;
    
    return (
      <Badge variant="outline" className={`text-xs ${config.bgColor} ${config.color} border`}>
        <Shield className="h-3 w-3 mr-1" />
        {config.shortLabel}
      </Badge>
    );
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
        <div className="flex items-center gap-2">
          <p className={`font-medium truncate ${isCurrentUser ? 'text-primary' : ''}`}>
            {getDisplayName(entry)}
            {isCurrentUser && <span className="text-xs ml-1 text-muted-foreground">(You)</span>}
          </p>
          {getVerificationBadge(entry.verification_level)}
        </div>
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Leaderboard
          </CardTitle>
          <Select value={verificationFilter} onValueChange={(v) => setVerificationFilter(v as FilterOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="location_verified">GPS Only</SelectItem>
              <SelectItem value="photo_verified">Photo+</SelectItem>
              <SelectItem value="remote_verified">Remote+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredLeaderboard.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No completions yet</p>
            <p className="text-sm">Be the first to complete this challenge!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLeaderboard.map(entry => 
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
