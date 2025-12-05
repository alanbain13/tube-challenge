import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, 
  Activity, 
  Award, 
  Clock, 
  Settings, 
  Calendar,
  Target,
  MapPinCheck,
  Camera,
  Globe,
  Trophy,
  Route
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface UserStats {
  totalStationsVisited: number;
  totalActivities: number;
  totalChallengesCompleted: number;
  totalBadges: number;
  totalRoutes: number;
}

interface VerificationStats {
  locationVerified: number;
  photoVerified: number;
  remoteVerified: number;
}

interface RecentStation {
  station_tfl_id: string;
  station_name: string;
  visited_at: string;
  verification_status: string | null;
}

interface RecentActivity {
  id: string;
  title: string | null;
  started_at: string;
  status: string | null;
  station_count: number;
}

interface RecentChallenge {
  id: string;
  challenge_name: string;
  completed_at: string;
  duration_minutes: number;
}

interface EarnedBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  badge: {
    name: string;
    image_url: string;
    description: string | null;
  };
}

interface RecentRoute {
  id: string;
  name: string;
  created_at: string;
  is_public: boolean;
}

export default function Profile() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [verificationStats, setVerificationStats] = useState<VerificationStats | null>(null);
  const [recentStations, setRecentStations] = useState<RecentStation[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [recentChallenges, setRecentChallenges] = useState<RecentChallenge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchUserData();
    }
  }, [user, authLoading, navigate]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      // Fetch stats in parallel
      const [
        stationsResult,
        activitiesResult,
        challengesCompletedResult,
        badgesResult,
        routesResult,
        recentStationsResult,
        recentActivitiesResult,
        recentChallengesResult,
        earnedBadgesResult,
        recentRoutesResult,
        verificationResult
      ] = await Promise.all([
        // Unique stations visited
        supabase
          .from('station_visits')
          .select('station_tfl_id')
          .eq('user_id', user.id)
          .eq('status', 'verified'),
        // Total activities
        supabase
          .from('activities')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        // Total challenges completed
        supabase
          .from('challenge_attempts')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('status', 'completed'),
        // Total badges
        supabase
          .from('user_badges')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        // Total routes
        supabase
          .from('routes')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
        // Recent stations visited (last 5 unique)
        supabase
          .from('station_visits')
          .select('station_tfl_id, visited_at, verification_status')
          .eq('user_id', user.id)
          .eq('status', 'verified')
          .order('visited_at', { ascending: false })
          .limit(20), // Fetch more to get unique ones
        // Recent activities
        supabase
          .from('activities')
          .select('id, title, started_at, status, station_tfl_ids')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(5),
        // Recent challenges completed
        supabase
          .from('challenge_attempts')
          .select(`
            id,
            completed_at,
            duration_minutes,
            challenge:challenges(name)
          `)
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(5),
        // Earned badges
        supabase
          .from('user_badges')
          .select(`
            id,
            badge_id,
            earned_at,
            badge:badges(name, image_url, description)
          `)
          .eq('user_id', user.id)
          .order('earned_at', { ascending: false })
          .limit(5),
        // Recent routes
        supabase
          .from('routes')
          .select('id, name, created_at, is_public')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        // Verification stats - all verified visits
        supabase
          .from('station_visits')
          .select('verification_status')
          .eq('user_id', user.id)
          .eq('status', 'verified')
      ]);

      // Calculate unique stations
      const uniqueStations = new Set(
        stationsResult.data?.map(v => v.station_tfl_id) || []
      );

      setStats({
        totalStationsVisited: uniqueStations.size,
        totalActivities: activitiesResult.count || 0,
        totalChallengesCompleted: challengesCompletedResult.count || 0,
        totalBadges: badgesResult.count || 0,
        totalRoutes: routesResult.count || 0
      });

      // Calculate verification breakdown
      const verificationCounts = (verificationResult.data || []).reduce(
        (acc, visit) => {
          if (visit.verification_status === 'location_verified') acc.locationVerified++;
          else if (visit.verification_status === 'photo_verified') acc.photoVerified++;
          else acc.remoteVerified++; // Default to remote for null/other
          return acc;
        },
        { locationVerified: 0, photoVerified: 0, remoteVerified: 0 }
      );
      setVerificationStats(verificationCounts);

      // Process recent stations - get unique ones with station names
      const stationIds = [...new Set(recentStationsResult.data?.map(s => s.station_tfl_id) || [])].slice(0, 5);
      const stationsData = await supabase
        .from('stations')
        .select('tfl_id, name')
        .in('tfl_id', stationIds);
      
      const stationNameMap = new Map(stationsData.data?.map(s => [s.tfl_id, s.name]) || []);
      const seenStations = new Set<string>();
      const uniqueRecentStations: RecentStation[] = [];
      
      for (const visit of recentStationsResult.data || []) {
        if (!seenStations.has(visit.station_tfl_id) && uniqueRecentStations.length < 5) {
          seenStations.add(visit.station_tfl_id);
          uniqueRecentStations.push({
            station_tfl_id: visit.station_tfl_id,
            station_name: stationNameMap.get(visit.station_tfl_id) || visit.station_tfl_id,
            visited_at: visit.visited_at,
            verification_status: visit.verification_status
          });
        }
      }
      setRecentStations(uniqueRecentStations);

      setRecentActivities(
        recentActivitiesResult.data?.map(a => ({
          ...a,
          station_count: a.station_tfl_ids?.length || 0
        })) || []
      );

      setRecentChallenges(
        recentChallengesResult.data?.map(c => ({
          id: c.id,
          challenge_name: (c.challenge as any)?.name || 'Unknown Challenge',
          completed_at: c.completed_at,
          duration_minutes: c.duration_minutes
        })) || []
      );

      setEarnedBadges(earnedBadgesResult.data as EarnedBadge[] || []);
      
      setRecentRoutes(recentRoutesResult.data || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase();
    }
    if (profile?.username) {
      return profile.username.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'TC';
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'active':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'abandoned':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getVerificationIcon = (status: string | null) => {
    switch (status) {
      case 'location_verified':
        return <MapPinCheck className="h-3 w-3 text-green-600" />;
      case 'photo_verified':
        return <Camera className="h-3 w-3 text-amber-600" />;
      default:
        return <Globe className="h-3 w-3 text-blue-600" />;
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header */}
        <Card className="mb-6 overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/20" />
          <CardContent className="relative pt-0 pb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-12">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left sm:pb-1">
                <h1 className="text-2xl font-bold text-foreground">
                  {profile?.username || profile?.display_name || 'Tube Challenger'}
                </h1>
                {profile?.display_name && profile?.username && (
                  <p className="text-muted-foreground">@{profile.display_name}</p>
                )}
                {profile?.home_station && (
                  <div className="flex items-center justify-center sm:justify-start gap-1 mt-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{profile.home_station}</span>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid - 5 columns */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card className="text-center p-3">
            <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 rounded-full bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold">{stats?.totalStationsVisited || 0}</p>
            <p className="text-[10px] text-muted-foreground">Stations</p>
          </Card>
          <Card className="text-center p-3">
            <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 rounded-full bg-blue-500/10">
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold">{stats?.totalActivities || 0}</p>
            <p className="text-[10px] text-muted-foreground">Activities</p>
          </Card>
          <Card className="text-center p-3">
            <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 rounded-full bg-purple-500/10">
              <Trophy className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-xl font-bold">{stats?.totalChallengesCompleted || 0}</p>
            <p className="text-[10px] text-muted-foreground">Challenges</p>
          </Card>
          <Card className="text-center p-3">
            <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 rounded-full bg-amber-500/10">
              <Award className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold">{stats?.totalBadges || 0}</p>
            <p className="text-[10px] text-muted-foreground">Badges</p>
          </Card>
          <Card className="text-center p-3">
            <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 rounded-full bg-green-500/10">
              <Route className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold">{stats?.totalRoutes || 0}</p>
            <p className="text-[10px] text-muted-foreground">Routes</p>
          </Card>
        </div>

        {/* Verification Stats */}
        {verificationStats && (verificationStats.locationVerified > 0 || verificationStats.photoVerified > 0 || verificationStats.remoteVerified > 0) && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Station Visit Verification Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center text-center p-3 rounded-lg bg-green-500/10">
                  <MapPinCheck className="h-6 w-6 text-green-600 mb-2" />
                  <p className="text-2xl font-bold text-green-600">{verificationStats.locationVerified}</p>
                  <p className="text-xs text-muted-foreground">Location Verified</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-lg bg-amber-500/10">
                  <Camera className="h-6 w-6 text-amber-600 mb-2" />
                  <p className="text-2xl font-bold text-amber-600">{verificationStats.photoVerified}</p>
                  <p className="text-xs text-muted-foreground">Photo Verified</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-lg bg-blue-500/10">
                  <Globe className="h-6 w-6 text-blue-600 mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{verificationStats.remoteVerified}</p>
                  <p className="text-xs text-muted-foreground">Remote Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Lists - same order as stats */}
        <div className="space-y-6">
          {/* Recent Stations Visited */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Recent Stations Visited
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {recentStations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No stations visited yet</p>
              ) : (
                <div className="space-y-2">
                  {recentStations.map((station) => (
                    <div
                      key={station.station_tfl_id + station.visited_at}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {getVerificationIcon(station.verification_status)}
                        <span className="text-sm font-medium">{station.station_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(station.visited_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activities */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  Recent Activities
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/activities">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No activities yet</p>
                  <Button variant="link" size="sm" asChild className="mt-1">
                    <Link to="/activities/new">Start your first activity</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivities.map((activity) => (
                    <Link
                      key={activity.id}
                      to={`/activities/${activity.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {activity.title || 'Untitled Activity'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(activity.started_at), { addSuffix: true })}</span>
                          <span>•</span>
                          <span>{activity.station_count} stations</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${getStatusColor(activity.status)}`}>
                        {activity.status || 'draft'}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Challenges Completed */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-purple-500" />
                  Recent Challenges Completed
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/challenges">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentChallenges.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No challenges completed yet</p>
                  <Button variant="link" size="sm" asChild className="mt-1">
                    <Link to="/challenges">Browse challenges</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentChallenges.map((challenge) => (
                    <div
                      key={challenge.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{challenge.challenge_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(challenge.completed_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600">
                        {challenge.duration_minutes} min
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Badges Earned */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  Badges Earned
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/badges">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {earnedBadges.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No badges earned yet</p>
                  <Button variant="link" size="sm" asChild className="mt-1">
                    <Link to="/challenges">Complete challenges to earn badges</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {earnedBadges.map((earned) => (
                    <div
                      key={earned.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <img
                        src={earned.badge?.image_url}
                        alt={earned.badge?.name}
                        className="w-8 h-8 object-contain"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{earned.badge?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(earned.earned_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Routes Created */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Route className="h-4 w-4 text-green-500" />
                  Routes Created
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/routes">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentRoutes.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No routes created yet</p>
                  <Button variant="link" size="sm" asChild className="mt-1">
                    <Link to="/routes/create">Create your first route</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentRoutes.map((route) => (
                    <Link
                      key={route.id}
                      to={`/routes/${route.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{route.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(route.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${route.is_public ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                        {route.is_public ? 'Public' : 'Private'}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Member Since */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Clock className="h-4 w-4 inline-block mr-1" />
          Member since {profile?.created_at ? format(new Date(profile.created_at), 'MMMM yyyy') : 'recently'}
        </div>
      </div>
    </AppLayout>
  );
}
