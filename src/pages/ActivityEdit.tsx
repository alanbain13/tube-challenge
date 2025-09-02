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
import RouteMap from '@/components/RouteMap';
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
import { ArrowLeft, Lock, GripVertical, X } from 'lucide-react';

const activitySchema = z.object({
  title: z.string().min(2, {
    message: "Activity title must be at least 2 characters.",
  }),
  notes: z.string().optional(),
  startStation: z.string().optional(),
  endStation: z.string().optional(),
});

interface Activity {
  id: string;
  title?: string;
  notes?: string;
  start_station_tfl_id?: string;
  end_station_tfl_id?: string;
  station_tfl_ids: string[];
  user_id: string;
  status: string;
  created_at: string;
}

const ActivityEdit = () => {
  const navigate = useNavigate();
  const { id: activityId } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingStations, setRemainingStations] = useState<string[]>([]);
  const { stations } = useStations();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Use unified activity state hook
  const { data: activityState, isLoading: activityLoading, refetch } = useActivityState(activityId);

  console.log('🧭 NAV: ActivityEdit mounted for activity:', activityId);

  const getStationName = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    return station ? station.name : stationId;
  };

  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: '',
      notes: '',
      startStation: '',
      endStation: '',
    },
  });

  // Load activity data and initialize form
  useEffect(() => {
    if (activityId && activityState) {
      loadActivityData(activityId);
    }
  }, [activityId, activityState]);

  const loadActivityData = async (activityId: string) => {
    console.log('📦 DATA: Loading activity edit data for ID:', activityId);
    try {
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
      form.setValue('startStation', activityData.start_station_tfl_id || '');
      form.setValue('endStation', activityData.end_station_tfl_id || '');
    } catch (error) {
      console.error('Error loading activity data:', error);
      navigate('/activities');
    }
  };

  // Initialize remaining stations from activity state
  useEffect(() => {
    if (activityState && activityState.remaining) {
      const remainingIds = activityState.remaining.map(r => r.station_tfl_id);
      setRemainingStations(remainingIds);
    } else if (activityState && activityState.mode === 'unplanned') {
      // For unplanned activities with no visits, show empty remaining
      setRemainingStations([]);
    }
  }, [activityState]);

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

      // Update basic activity info (only if no visited stations to prevent changing locked start/end)
      const hasVisitedStations = activityState.visited.length > 0;
      const activityData: any = {
        title: values.title,
        notes: values.notes,
      };

      // Only update start/end if no stations have been visited
      if (!hasVisitedStations) {
        activityData.start_station_tfl_id = values.startStation || remainingStations[0] || null;
        activityData.end_station_tfl_id = values.endStation || remainingStations[remainingStations.length - 1] || null;
      }

      const { error: activityError } = await supabase
        .from('activities')
        .update(activityData)
        .eq('id', activity.id);

      if (activityError) throw activityError;

      // Update activity plan items for remaining stations only
      // First, delete all existing plan items for this activity
      const { error: deleteError } = await supabase
        .from('activity_plan_item')
        .delete()
        .eq('activity_id', activity.id);

      if (deleteError) throw deleteError;

      // Then insert new plan items for remaining stations only
      // (visited stations should not be in plan items anymore)
      if (remainingStations.length > 0) {
        const planItems = remainingStations.map((stationId, index) => ({
          activity_id: activity.id,
          station_tfl_id: stationId,
          seq_planned: (activityState.visited.length || 0) + index + 1, // Continue numbering after visited
        }));

        const { error: insertError } = await supabase
          .from('activity_plan_item')
          .insert(planItems);

        if (insertError) throw insertError;
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

  const handleStationAdd = (stationId: string) => {
    // Only allow adding to remaining stations (not visited)
    if (activityState?.visited.some(v => v.station_tfl_id === stationId)) {
      toast({
        title: 'Cannot add station',
        description: 'This station has already been visited and cannot be modified.',
        variant: 'destructive',
      });
      return;
    }
    
    setRemainingStations((prev) => {
      if (!prev.includes(stationId)) {
        const newStations = [...prev, stationId];
        console.log('🏁 Adding station to remaining:', { tfl_id: stationId, name: getStationName(stationId) });
        return newStations;
      }
      return prev;
    });
    
    // Auto-set start/end only if no visited stations
    const hasVisitedStations = activityState?.visited.length > 0;
    if (!hasVisitedStations) {
      if (!form.getValues('startStation')) {
        form.setValue('startStation', stationId);
        console.log('🏁 UI Bind: Auto-setting start station:', { tfl_id: stationId, name: getStationName(stationId) });
      }
      form.setValue('endStation', stationId);
      console.log('🏁 UI Bind: Auto-setting end station:', { tfl_id: stationId, name: getStationName(stationId) });
    }
  };

  const handleStationRemove = (stationId: string) => {
    // Only allow removing from remaining stations (not visited)
    if (activityState?.visited.some(v => v.station_tfl_id === stationId)) {
      toast({
        title: 'Cannot remove station',
        description: 'Visited stations cannot be removed.',
        variant: 'destructive',
      });
      return;
    }
    
    setRemainingStations((prev) => {
      const newStations = prev.filter((id) => id !== stationId);
      
      // Clear start/end if they were the removed station and no visited stations
      const hasVisitedStations = activityState?.visited.length > 0;
      if (!hasVisitedStations) {
        if (form.getValues('startStation') === stationId) {
          form.setValue('startStation', newStations[0] || '');
        }
        if (form.getValues('endStation') === stationId) {
          form.setValue('endStation', newStations[newStations.length - 1] || '');
        }
      }
      
      return newStations;
    });
  };

  const handleSequenceChange = (fromIndex: number, toIndex: number) => {
    // Only allow reordering within remaining stations
    const visitedCount = activityState?.visited.length || 0;
    const remainingStartIndex = visitedCount;
    
    // Adjust indices to be relative to remaining stations only
    const adjustedFromIndex = fromIndex - remainingStartIndex;
    const adjustedToIndex = toIndex - remainingStartIndex;
    
    if (adjustedFromIndex < 0 || adjustedToIndex < 0) {
      toast({
        title: 'Cannot reorder',
        description: 'Visited stations cannot be reordered.',
        variant: 'destructive',
      });
      return;
    }
    
    const newStations = [...remainingStations];
    const [movedStation] = newStations.splice(adjustedFromIndex, 1);
    newStations.splice(adjustedToIndex, 0, movedStation);
    setRemainingStations(newStations);
  };

  // Handle form field changes to update remaining stations
  useEffect(() => {
    const hasVisitedStations = activityState?.visited.length > 0;
    if (hasVisitedStations) return; // Don't allow changes if there are visited stations
    
    const subscription = form.watch((value, { name }) => {
      if (name === 'startStation' && value.startStation) {
        console.log('🏁 UI Bind: Form start changed:', { tfl_id: value.startStation, name: getStationName(value.startStation) });
        // Move start station to beginning of remaining sequence
        setRemainingStations((prev) => {
          const filtered = prev.filter(id => id !== value.startStation);
          return [value.startStation, ...filtered];
        });
      }
      if (name === 'endStation' && value.endStation) {
        console.log('🏁 UI Bind: Form end changed:', { tfl_id: value.endStation, name: getStationName(value.endStation) });
        // Move end station to end of remaining sequence
        setRemainingStations((prev) => {
          const filtered = prev.filter(id => id !== value.endStation);
          return [...filtered, value.endStation];
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, getStationName, activityState?.visited.length]);


  // SEO
  useEffect(() => {
    document.title = `Edit ${activity?.title || 'Activity'} | Tube Challenge`;
  }, [activity]);

  if (authLoading || activityLoading) {
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
  const hasVisitedStations = visited.length > 0;
  
  // Get all stations for map display (visited + remaining)
  const allMapStations = [
    ...visited.map(v => v.station_tfl_id),
    ...remainingStations
  ];
  
  // Convert visits for RouteMap component
  const mapVisits = visited.map(visit => ({
    station_tfl_id: visit.station_tfl_id,
    status: visit.status,
    sequence_number: visit.seq_actual
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate('/activities')}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Edit Activity</h1>
                <p className="text-muted-foreground">Modify your activity details and route</p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Form and Station Lists */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="startStation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Station</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                value={field.value}
                                disabled={hasVisitedStations}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={
                                      hasVisitedStations ? 
                                      `Locked to ${getStationName(visited[0]?.station_tfl_id)}` :
                                      "Auto-set from map selection"
                                    } />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {stations.map((station) => (
                                    <SelectItem key={station.id} value={station.id}>
                                      {station.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {hasVisitedStations && (
                                <p className="text-xs text-muted-foreground">
                                  Start is locked to {getStationName(visited[0].station_tfl_id)} once you've checked in.
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="endStation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Station</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                value={field.value}
                                disabled={hasVisitedStations}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={
                                      hasVisitedStations ? 
                                      "Locked after check-in" :
                                      "Auto-set from map selection"
                                    } />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {stations.map((station) => (
                                    <SelectItem key={station.id} value={station.id}>
                                      {station.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {hasVisitedStations && (
                                <p className="text-xs text-muted-foreground">
                                  End station changes are locked after check-in.
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Activity'}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Visited Stations (Read-only) */}
              {visited.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-500" />
                      Visited Stations ({visited.length})
                      <Badge variant="destructive" className="ml-2">Locked</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {visited.map((visit) => (
                        <div key={`visited-${visit.station_tfl_id}-${visit.seq_actual}`} className="flex items-center gap-3 p-2 bg-red-50 border border-red-200 rounded">
                          <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {visit.seq_actual}
                          </span>
                          <span className="font-medium flex-1">{getStationName(visit.station_tfl_id)}</span>
                          <Badge variant="destructive" className="text-xs">
                            {visit.status.toUpperCase()}
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
                    Remaining Stations ({remainingStations.length})
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Editable</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {remainingStations.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Click on stations on the map to add them to your planned route.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {remainingStations.map((stationId, index) => (
                        <div key={`remaining-${stationId}-${index}`} className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-200 rounded">
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {visitedCount + index + 1}
                          </span>
                          <span className="font-medium flex-1">{getStationName(stationId)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleStationRemove(stationId)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Map */}
            <div className="space-y-6">
              <RouteMap
                selectedStations={allMapStations}
                onStationSelect={handleStationAdd}
                onStationRemove={handleStationRemove}
                onSequenceChange={handleSequenceChange}
                readOnly={false}
                activityStations={allMapStations}
                visits={mapVisits}
                activityMode={activityState.mode}
              />

              {/* Activity Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Visited:</span>
                      <span className="font-medium text-red-600">{visitedCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Remaining:</span>
                      <span className="font-medium text-blue-600">{remainingStations.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Planned:</span>
                      <span className="font-medium">{visitedCount + remainingStations.length}</span>
                    </div>
                    {allMapStations.length > 0 && (
                      <div className="text-sm pt-2 border-t">
                        <span className="text-muted-foreground">Route: </span>
                        <span className="font-medium">
                          {allMapStations.map(getStationName).join(' → ')}
                        </span>
                      </div>
                    )}
                  </div>
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