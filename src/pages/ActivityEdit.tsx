import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useStations } from '@/hooks/useStations';
import { supabase } from '@/integrations/supabase/client';
import RouteMap from '@/components/RouteMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { ArrowLeft } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const { stations } = useStations();
  const { user } = useAuth();
  const { toast } = useToast();

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
        .single();

      if (error) {
        console.error('Error fetching activity:', error);
        navigate('/activities');
        return;
      }

      const activityData = data as Activity;
      console.log('📦 DATA: Activity loaded:', { title: activityData.title, stationCount: activityData.station_tfl_ids?.length || 0 });
      setActivity(activityData);
      
      // Set form values
      form.setValue('title', activityData.title || '');
      form.setValue('notes', activityData.notes || '');
      form.setValue('startStation', activityData.start_station_tfl_id || '');
      form.setValue('endStation', activityData.end_station_tfl_id || '');
      
      // Set selected stations
      if (activityData.station_tfl_ids) {
        setSelectedStations(activityData.station_tfl_ids);
      }
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
      if (!user || !activity) {
        toast({
          title: 'Error',
          description: 'Invalid session or activity data.',
          variant: 'destructive',
        });
        return;
      }

      const activityData = {
        title: values.title,
        notes: values.notes,
        start_station_tfl_id: values.startStation || selectedStations[0] || null,
        end_station_tfl_id: values.endStation || selectedStations[selectedStations.length - 1] || null,
        station_tfl_ids: selectedStations,
      };

      const { error } = await supabase
        .from('activities')
        .update(activityData)
        .eq('id', activity.id);

      if (error) {
        console.error('Error updating activity:', error);
        toast({
          title: 'Error',
          description: 'Failed to save activity.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Activity updated successfully!',
        });
        navigate(`/activities/${activity.id}`);
      }
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
    setSelectedStations((prev) => {
      if (!prev.includes(stationId)) {
        const newStations = [...prev, stationId];
        recomputeSequenceAndStatus(newStations);
        return newStations;
      }
      return prev;
    });
    
    // Auto-set start if not set, or update end station
    if (!form.getValues('startStation')) {
      form.setValue('startStation', stationId);
      console.log('🏁 UI Bind: Auto-setting start station:', { tfl_id: stationId, name: getStationName(stationId) });
    }
    form.setValue('endStation', stationId);
    console.log('🏁 UI Bind: Auto-setting end station:', { tfl_id: stationId, name: getStationName(stationId) });
  };

  const handleStationRemove = (stationId: string) => {
    setSelectedStations((prev) => {
      const newStations = prev.filter((id) => id !== stationId);
      recomputeSequenceAndStatus(newStations);
      
      // Clear start/end if they were the removed station
      if (form.getValues('startStation') === stationId) {
        form.setValue('startStation', newStations[0] || '');
      }
      if (form.getValues('endStation') === stationId) {
        form.setValue('endStation', newStations[newStations.length - 1] || '');
      }
      
      return newStations;
    });
  };

  const handleStationSetRole = (stationId: string, role: 'start' | 'finish') => {
    const stationName = getStationName(stationId);
    console.log(`🏁 UI Bind: ${role}=${stationId}/${stationName}`);
    
    if (role === 'start') {
      form.setValue('startStation', stationId);
      // Ensure the station is in the selected list and at the beginning
      setSelectedStations((prev) => {
        const filtered = prev.filter(id => id !== stationId);
        const newStations = [stationId, ...filtered];
        recomputeSequenceAndStatus(newStations);
        return newStations;
      });
    } else if (role === 'finish') {
      form.setValue('endStation', stationId);
      // Ensure the station is in the selected list and at the end
      setSelectedStations((prev) => {
        const filtered = prev.filter(id => id !== stationId);
        const newStations = [...filtered, stationId];
        recomputeSequenceAndStatus(newStations);
        return newStations;
      });
    }
  };

  const handleSequenceChange = (fromIndex: number, toIndex: number) => {
    const newStations = [...selectedStations];
    const [movedStation] = newStations.splice(fromIndex, 1);
    newStations.splice(toIndex, 0, movedStation);
    setSelectedStations(newStations);
    recomputeSequenceAndStatus(newStations);
  };

  const recomputeSequenceAndStatus = (stations: string[]) => {
    // Calculate stats for logging
    const totalStations = stations.length;
    const visitedCount = 0; // In edit mode, no visits yet
    const pendingCount = 0; // In edit mode, no pending visits
    const nextExpected = totalStations > 0 ? stations[0] : null;
    
    console.log('🔄 Sequence recompute:', { 
      total: totalStations, 
      visited: visitedCount, 
      pending: pendingCount, 
      next_expected: nextExpected ? getStationName(nextExpected) : 'none'
    });
    
    // Log the ordered list with sequence numbers and status
    const orderedList = stations.map((stationId, index) => ({
      seq: index + 1,
      tfl_id: stationId,
      status: 'not_visited' as const
    }));
    
    console.log('📋 Station sequence:', orderedList);
  };

  // Handle form field changes to update map
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'startStation' && value.startStation) {
        console.log('🏁 UI Bind: Form start changed:', { tfl_id: value.startStation, name: getStationName(value.startStation) });
        // Move start station to beginning of sequence
        setSelectedStations((prev) => {
          const filtered = prev.filter(id => id !== value.startStation);
          return [value.startStation, ...filtered];
        });
      }
      if (name === 'endStation' && value.endStation) {
        console.log('🏁 UI Bind: Form end changed:', { tfl_id: value.endStation, name: getStationName(value.endStation) });
        // Move end station to end of sequence
        setSelectedStations((prev) => {
          const filtered = prev.filter(id => id !== value.endStation);
          return [...filtered, value.endStation];
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, getStationName]);


  // SEO
  useEffect(() => {
    document.title = `Edit ${activity?.title || 'Activity'} | Tube Challenge`;
  }, [activity]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading activity...</p>
      </div>
    );
  }

  if (!activity) {
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
            {/* Left Column - Form */}
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Auto-set from map selection" />
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Auto-set from map selection" />
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

            {/* Right Column - Activity Map and Summary */}
            <div className="space-y-6">
              <RouteMap
                selectedStations={selectedStations}
                onStationSelect={handleStationAdd}
                onStationRemove={handleStationRemove}
                onSequenceChange={handleSequenceChange}
                onStationSetRole={handleStationSetRole}
              />

              {/* Activity Summary */}
              {selectedStations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Stations:</span>
                        <span className="font-medium">{selectedStations.length}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Route: </span>
                        <span className="font-medium">
                          {selectedStations.map(getStationName).join(' → ')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityEdit;