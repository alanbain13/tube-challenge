import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useStations } from '@/hooks/useStations';
import { useActivityState } from '@/hooks/useActivityState';
import { supabase } from '@/integrations/supabase/client';
import UnifiedActivityMap from '@/components/UnifiedActivityMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ArrowLeft, Lock } from 'lucide-react';

const activitySchema = z.object({
  title: z.string().min(2, {
    message: "Activity title must be at least 2 characters.",
  }),
  notes: z.string().optional(),
});

interface Activity {
  id: string;
  title?: string;
  notes?: string;
  start_station_tfl_id?: string;
  end_station_tfl_id?: string;
  user_id: string;
  status: string;
  created_at: string;
}

const ActivityEdit = () => {
  const navigate = useNavigate();
  const { id: activityId } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { stations } = useStations();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Use unified activity state hook for display parity only
  const { data: activityState, isLoading: stateLoading } = useActivityState(activityId);

  const getStationName = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    return station ? station.name : stationId;
  };

  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (activityId) {
      loadActivityData(activityId);
    }
  }, [activityId]);

  const loadActivityData = async (activityId: string) => {
    console.log('📦 DATA: Loading activity edit data for ID:', activityId);
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching activity:', error);
        navigate('/activities');
        return;
      }

      const activityData = data as Activity;
      console.log('📦 DATA: Activity loaded:', { title: activityData.title });
      setActivity(activityData);
      
      // Set form values
      form.setValue('title', activityData.title || '');
      form.setValue('notes', activityData.notes || '');
      
    } catch (error) {
      console.error('Error loading activity data:', error);
      navigate('/activities');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof activitySchema>) => {
    setIsSubmitting(true);
    try {
      if (!user || !activity) {
        toast({
          title: 'Error',
          description: 'Invalid session or activity data.',
          variant: 'destructive',
        });
        return;
      }

      // Update only metadata fields
      const activityData = {
        title: values.title,
        notes: values.notes,
      };

      const { error: activityError } = await supabase
        .from('activities')
        .update(activityData)
        .eq('id', activity.id);

      if (activityError) {
        console.error('Error updating activity:', activityError);
        toast({
          title: 'Error',
          description: 'Failed to save activity.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Activity updated successfully!',
      });
      
      navigate(`/activities/${activity.id}`);
      
    } catch (error) {
      console.error('Error saving activity:', error);
      toast({
        title: 'Error',
        description: 'Failed to save activity.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };



  // SEO
  useEffect(() => {
    document.title = `Edit ${activity?.title || 'Activity'} | Tube Challenge`;
  }, [activity]);

  if (loading || stateLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading activity...</p>
      </div>
    );
  }

  if (!activity || !activityState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Activity not found</h2>
          <Button onClick={() => navigate('/activities')}>
            Back to Activities
          </Button>
        </div>
      </div>
    );
  }

  const { visited, remaining, visitedCount, totalPlannedCount } = activityState;
  const hasVisited = visited.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate(`/activities/${activityId}`)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Edit Activity</h1>
                <p className="text-muted-foreground">
                  Visited: {visitedCount} | Remaining: {remaining?.length || 0} | Total: {totalPlannedCount}
                </p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Form and Station Management */}
            <div className="space-y-6">
              {/* Basic Activity Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Activity Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter activity title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Enter activity notes" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Activity'}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Visited Stations (Read-only) */}
              {hasVisited && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span>Visited Stations ({visitedCount})</span>
                      <Badge variant="destructive" className="text-xs">
                        <Lock className="w-3 h-3 mr-1" />
                        LOCKED
                      </Badge>
                    </CardTitle>
                    {hasVisited && (
                      <p className="text-sm text-muted-foreground">
                        Start is locked to {getStationName(visited[0].station_tfl_id)} once you've checked in.
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {visited.map((visit) => (
                        <div key={`visited-${visit.station_tfl_id}`} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <span className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {visit.seq_actual}
                          </span>
                          <span className="font-medium flex-1">{getStationName(visit.station_tfl_id)}</span>
                          <Badge variant="destructive" className="text-xs">
                            {visit.status === 'verified' ? 'VERIFIED' : 'PENDING'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Remaining Stations (Read-only) */}
              {remaining && remaining.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span>Remaining Stations ({remaining.length})</span>
                      <Badge variant="secondary" className="text-xs">READ-ONLY</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {remaining.map((item, index) => {
                        const sequenceNumber = visitedCount + index + 1;
                        return (
                          <div key={`remaining-${item.station_tfl_id}`} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {sequenceNumber}
                            </span>
                            <span className="font-medium flex-1">{getStationName(item.station_tfl_id)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Unified Activity Map */}
            <div className="space-y-6">
              <div className="min-h-[600px]">
                <UnifiedActivityMap 
                  activityId={activityId!} 
                  activity={activity}
                />
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityEdit;