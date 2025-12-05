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
  TrendingUp,
  Target,
  MapPinCheck,
  Camera,
  Globe
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { VerificationLevelBadge } from '@/components/VerificationLevelBadge';

interface UserStats {
  totalStationsVisited: number;
  totalActivities: number;
  totalBadges: number;
  totalRoutes: number;
}

interface VerificationStats {
  locationVerified: number;
  photoVerified: number;
  remoteVerified: number;
}

interface RecentActivity {
  id: string;
  title: string | null;
  started_at: string;
  status: string | null;
  station_count: number;
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

export default function Profile() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [verificationStats, setVerificationStats] = useState<VerificationStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
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
        badgesResult,
        routesResult,
        recentActivitiesResult,
        earnedBadgesResult,
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
        // Recent activities
        supabase
          .from('activities')
          .select('id, title, started_at, status, station_tfl_ids')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
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
          .limit(6),
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

      setRecentActivities(
        recentActivitiesResult.data?.map(a => ({
          ...a,
          station_count: a.station_tfl_ids?.length || 0
        })) || []
      );

      setEarnedBadges(earnedBadgesResult.data as EarnedBadge[] || []);
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

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="text-center p-4">
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats?.totalStationsVisited || 0}</p>
            <p className="text-xs text-muted-foreground">Stations Visited</p>
          </Card>
          <Card className="text-center p-4">
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-full bg-blue-500/10">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{stats?.totalActivities || 0}</p>
            <p className="text-xs text-muted-foreground">Activities</p>
          </Card>
          <Card className="text-center p-4">
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-full bg-amber-500/10">
              <Award className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold">{stats?.totalBadges || 0}</p>
            <p className="text-xs text-muted-foreground">Badges Earned</p>
          </Card>
          <Card className="text-center p-4">
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-full bg-green-500/10">
              <Target className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold">{stats?.totalRoutes || 0}</p>
            <p className="text-xs text-muted-foreground">Routes Created</p>
          </Card>
        </div>

        {/* Verification Stats */}
        {verificationStats && (verificationStats.locationVerified > 0 || verificationStats.photoVerified > 0 || verificationStats.remoteVerified > 0) && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Verification Breakdown</CardTitle>
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

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Recent Activities
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/activities">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No activities yet</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/activities/new">Start your first activity</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <Link
                      key={activity.id}
                      to={`/activities/${activity.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {activity.title || 'Untitled Activity'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(activity.started_at), { addSuffix: true })}</span>
                          <span>•</span>
                          <span>{activity.station_count} stations</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusColor(activity.status)}>
                        {activity.status || 'draft'}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  Badges Earned
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/badges">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {earnedBadges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No badges earned yet</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/challenges">Complete challenges to earn badges</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {earnedBadges.map((earned) => (
                    <div
                      key={earned.id}
                      className="flex flex-col items-center text-center p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      title={earned.badge?.description || earned.badge?.name}
                    >
                      <img
                        src={earned.badge?.image_url}
                        alt={earned.badge?.name}
                        className="w-12 h-12 object-contain mb-1"
                      />
                      <p className="text-xs font-medium truncate w-full">
                        {earned.badge?.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(earned.earned_at), 'MMM d')}
                      </p>
                    </div>
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
