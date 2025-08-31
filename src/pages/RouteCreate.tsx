import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useStations, Station } from '@/hooks/useStations';
import { supabase } from '@/integrations/supabase/client';
import RouteMap from '@/components/RouteMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Switch } from "@/components/ui/switch"

const routeSchema = z.object({
  name: z.string().min(2, {
    message: "Route name must be at least 2 characters.",
  }),
  description: z.string().optional(),
  startStation: z.string().optional(),
  endStation: z.string().optional(),
  estimatedDuration: z.number().optional(),
  isPublic: z.boolean().default(false),
});

interface Route {
  id: string;
  name: string;
  description?: string;
  start_station_tfl_id: string;
  end_station_tfl_id: string;
  estimated_duration_minutes?: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const RouteCreate = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const { stations, loading: stationsLoading } = useStations();
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      name: '',
      description: '',
      startStation: '',
      endStation: '',
      estimatedDuration: 0,
      isPublic: false,
    },
  });

  useEffect(() => {
    console.log('🔄 RouteCreate useEffect - routeId:', routeId);
    if (routeId && stations.length > 0) {
      console.log('📝 Setting edit mode for route:', routeId);
      setIsEditMode(true);
      loadRouteData(routeId);
    } else if (!routeId) {
      console.log('✨ Setting create mode');
      setIsEditMode(false);
      form.reset();
      setSelectedStations([]);
    }
  }, [routeId, form, stations]);

  const loadRouteData = async (routeId: string) => {
    console.log('📥 Loading route data for ID:', routeId);
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .single();

      if (error) {
        console.error('Error fetching route:', error);
        toast({
          title: 'Error',
          description: 'Failed to load route data.',
          variant: 'destructive',
        });
        return;
      }

      const route = data as Route;
      form.setValue('name', route.name);
      form.setValue('description', route.description || '');
      
      // Find stations by TFL ID and set the form values with the internal station IDs
      const startStation = stations.find(s => s.id === route.start_station_tfl_id);
      const endStation = stations.find(s => s.id === route.end_station_tfl_id);
      
      form.setValue('startStation', startStation?.id || '');
      form.setValue('endStation', endStation?.id || '');
      form.setValue('estimatedDuration', route.estimated_duration_minutes || 0);
      form.setValue('isPublic', route.is_public);
      
      // Load route stations from the separate route_stations table
      const { data: routeStations } = await supabase
        .from('route_stations')
        .select('station_tfl_id')
        .eq('route_id', routeId)
        .order('sequence_number');
      
      if (routeStations) {
        setSelectedStations(routeStations.map(rs => rs.station_tfl_id));
      }
    } catch (error) {
      console.error('Error loading route data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load route data.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof routeSchema>) => {
    setIsSubmitting(true);
    try {
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to create a route.',
          variant: 'destructive',
        });
        return;
      }

      // Map form values to database column names
      const routeData = {
        name: values.name,
        description: values.description,
        start_station_tfl_id: values.startStation || selectedStations[0] || '',
        end_station_tfl_id: values.endStation || selectedStations[selectedStations.length - 1] || '',
        estimated_duration_minutes: values.estimatedDuration,
        is_public: values.isPublic,
        user_id: user.id,
      };

      let response;
      let currentRouteId: string;
      
      if (isEditMode && routeId) {
        response = await supabase
          .from('routes')
          .update(routeData)
          .eq('id', routeId);
        currentRouteId = routeId;
      } else {
        response = await supabase
          .from('routes')
          .insert([routeData])
          .select('id')
          .single();
        currentRouteId = response.data?.id;
      }

      // Handle route stations separately
      if (!response.error && currentRouteId) {
        if (selectedStations.length > 0) {
          // Delete existing route stations for edit mode
          if (isEditMode) {
            await supabase
              .from('route_stations')
              .delete()
              .eq('route_id', currentRouteId);
          }

          // Insert new route stations with proper sequencing
          const routeStations = selectedStations.map((stationId, index) => ({
            route_id: currentRouteId,
            station_tfl_id: stationId,
            sequence_number: index + 1,
            is_bypass_allowed: false
          }));

          const stationInsertResponse = await supabase
            .from('route_stations')
            .insert(routeStations);
            
          if (stationInsertResponse.error) {
            console.error('Error saving route stations:', stationInsertResponse.error);
            throw new Error('Failed to save route stations');
          }
        }
      }

      if (response.error) {
        console.error('Error saving route:', response.error);
        toast({
          title: 'Error',
          description: 'Failed to save route.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: isEditMode ? 'Route updated successfully!' : 'Route created successfully!',
        });
        navigate('/routes');
      }
    } catch (error) {
      console.error('Error saving route:', error);
      toast({
        title: 'Error',
        description: 'Failed to save route.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStationName = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    return station ? station.name : stationId;
  };

  const handleStationAdd = (stationId: string) => {
    setSelectedStations((prev) => [...prev, stationId]);
    form.setValue('startStation', form.getValues('startStation') || stationId);
    form.setValue('endStation', stationId);
  };

  const handleStationRemove = (stationId: string) => {
    setSelectedStations((prev) => prev.filter((id) => id !== stationId));
  };

  const handleStationSetRole = (stationId: string, role: 'start' | 'finish') => {
    const stationName = getStationName(stationId);
    console.log(`🏁 UI Bind: ${role}=${stationId}/${stationName}`);
    
    if (role === 'start') {
      form.setValue('startStation', stationId);
      // Ensure the station is in the selected list and at the beginning
      setSelectedStations((prev) => {
        const filtered = prev.filter(id => id !== stationId);
        return [stationId, ...filtered];
      });
    } else if (role === 'finish') {
      form.setValue('endStation', stationId);
      // Ensure the station is in the selected list and at the end
      setSelectedStations((prev) => {
        const filtered = prev.filter(id => id !== stationId);
        return [...filtered, stationId];
      });
    }
  };

  const handleSequenceChange = (fromIndex: number, toIndex: number) => {
    const newStations = [...selectedStations];
    const [movedStation] = newStations.splice(fromIndex, 1);
    newStations.splice(toIndex, 0, movedStation);
    setSelectedStations(newStations);
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
  }, [form]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <header className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isEditMode ? 'Edit Route' : 'Create New Route'}
              </h1>
              <p className="text-muted-foreground">
                {isEditMode 
                  ? 'Modify your existing route' 
                  : 'Plan your perfect tube journey'
                }
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/routes')}>
              Back to Routes
            </Button>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <Card>
              <CardHeader>
                <CardTitle>Route Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Route Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter route name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter route description" {...field} />
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

                    <FormField
                      control={form.control}
                      name="estimatedDuration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Enter estimated duration" 
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isPublic"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Public Route
                            </FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Make this route visible to other users
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Route' : 'Create Route')}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Right Column - Route Map and Summary */}
            <div className="space-y-6">
              <RouteMap
                selectedStations={selectedStations}
                onStationSelect={handleStationAdd}
                onStationRemove={handleStationRemove}
                onSequenceChange={handleSequenceChange}
                onStationSetRole={handleStationSetRole}
              />

              {/* Route Summary */}
              {selectedStations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Route Summary</CardTitle>
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

export default RouteCreate;
