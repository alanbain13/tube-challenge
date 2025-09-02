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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, GripVertical, X, Lock } from 'lucide-react';

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
  const [remainingStations, setRemainingStations] = useState<string[]>([]);
  const { stations } = useStations();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Use unified activity state hook
  const { data: activityState, isLoading: stateLoading, refetch: refetchState } = useActivityState(activityId);

  console.log('🧭 NAV: ActivityEdit mounted for activity:', activityId);
  console.log('📊 Unified State:', activityState);

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

  // Update remaining stations when activity state changes
  useEffect(() => {
    if (activityState?.remaining) {
      const remainingStationIds = activityState.remaining.map(item => item.station_tfl_id);
      setRemainingStations(remainingStationIds);
      console.log('🔄 Updated remaining stations:', remainingStationIds);
    } else if (activityState?.mode === 'unplanned') {
      // For unplanned activities, start with empty remaining
      setRemainingStations([]);
    }
  }, [activityState]);

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
    console.log('📦 DATA: Saving activity changes:', values);
    setIsSubmitting(true);
    try {
      if (!user || !activity || !activityState) {
        toast({
          title: 'Error',
          description: 'Invalid session or activity data.',
          variant: 'destructive',
        });
        return;
      }

      // Update basic activity info
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

      // Update activity plan items for remaining stations only
      // First, delete existing plan items for stations that are not visited
      const visitedStationIds = activityState.visited.map(v => v.station_tfl_id);
      
      // Delete all plan items that aren't visited (we'll recreate them)
      const { error: deleteError } = await supabase
        .from('activity_plan_item')
        .delete()
        .eq('activity_id', activity.id)
        .not('station_tfl_id', 'in', `(${visitedStationIds.map(id => `"${id}"`).join(',')})`);

      if (deleteError) {
        console.error('Error deleting old plan items:', deleteError);
        // Continue anyway, this is not critical
      }

      // Insert new plan items for remaining stations
      if (remainingStations.length > 0) {
        const newPlanItems = remainingStations.map((stationId, index) => ({
          activity_id: activity.id,
          station_tfl_id: stationId,
          seq_planned: activityState.visited.length + index + 1, // Continue sequence after visited
        }));

        const { error: planError } = await supabase
          .from('activity_plan_item')
          .insert(newPlanItems);

        if (planError) {
          console.error('Error updating plan items:', planError);
          toast({
            title: 'Error',
            description: 'Failed to update activity plan.',
            variant: 'destructive',
          });
          return;
        }
      }

      toast({
        title: 'Success',
        description: 'Activity updated successfully!',
      });
      
      // Refresh state and navigate back
      await refetchState();
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

  const handleStationAdd = (stationId: string) => {
    // Only allow adding to remaining stations if not already visited
    if (activityState?.visited.some(v => v.station_tfl_id === stationId)) {
      toast({
        title: 'Station already visited',
        description: 'Cannot add a station that has already been visited.',
        variant: 'destructive',
      });
      return;
    }

    setRemainingStations((prev) => {
      if (!prev.includes(stationId)) {
        const newStations = [...prev, stationId];
        console.log('➕ Added station to remaining:', { stationId, newCount: newStations.length });
        return newStations;
      }
      return prev;
    });
  };

  const handleStationRemove = (stationId: string) => {
    // Only allow removing from remaining stations
    setRemainingStations((prev) => {
      const newStations = prev.filter((id) => id !== stationId);
      console.log('➖ Removed station from remaining:', { stationId, newCount: newStations.length });
      return newStations;
    });
  };

  const handleSequenceChange = (fromIndex: number, toIndex: number) => {
    // Only allow reordering within remaining stations
    const newStations = [...remainingStations];
    const [movedStation] = newStations.splice(fromIndex, 1);
    newStations.splice(toIndex, 0, movedStation);
    setRemainingStations(newStations);
    console.log('🔄 Reordered remaining stations:', newStations);
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

              {/* Remaining Stations (Editable) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Remaining Stations ({remainingStations.length})</span>
                    <Badge variant="secondary" className="text-xs">EDITABLE</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {remainingStations.map((stationId, index) => {
                      const sequenceNumber = visitedCount + index + 1;
                      return (
                        <div key={`remaining-${stationId}`} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg group">
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                            <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {sequenceNumber}
                            </span>
                          </div>
                          <span className="font-medium flex-1">{getStationName(stationId)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStationRemove(stationId)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                    {remainingStations.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No remaining stations planned.</p>
                        <p className="text-sm">Use the map to add stations to your route.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Unified Activity Map */}
            <div className="space-y-6">
              <div className="min-h-[600px]">
                <UnifiedActivityMap 
                  activityId={activityId!} 
                  activity={activity}
                />
              </div>

              {/* Add Station Search */}
              <Card>
                <CardHeader>
                  <CardTitle>Add Station</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select onValueChange={handleStationAdd}>
                    <SelectTrigger>
                      <SelectValue placeholder="Search and select a station to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations
                        .filter(station => 
                          // Exclude already visited stations
                          !visited.some(v => v.station_tfl_id === station.id) &&
                          // Exclude already planned stations
                          !remainingStations.includes(station.id)
                        )
                        .map((station) => (
                          <SelectItem key={station.id} value={station.id}>
                            {station.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityEdit;