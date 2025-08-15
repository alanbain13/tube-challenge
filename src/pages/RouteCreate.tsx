import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStations } from "@/hooks/useStations";
import RouteMap from "@/components/RouteMap";
import { supabase } from "@/integrations/supabase/client";

const RouteSchema = z.object({
  name: z.string().min(3, "Name is too short"),
  description: z.string().optional(),
  start_station_tfl_id: z.string().min(1, "Start station required"),
  end_station_tfl_id: z.string().min(1, "End station required"),
  estimated_duration_minutes: z.number().optional(),
  station_sequence: z.array(z.string()).min(2, "Route must have at least start and end stations"),
});

type RouteFormValues = z.infer<typeof RouteSchema>;

const RouteCreate = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id: routeId } = useParams();
  const isEditMode = !!routeId;
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const selectedStationsRef = useRef<string[]>([]);
  const { stations } = useStations();

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(RouteSchema),
    defaultValues: {
      name: "",
      description: "",
      start_station_tfl_id: "",
      end_station_tfl_id: "",
      station_sequence: [],
    },
  });

  const { setValue } = form;

  // Fetch existing route data if in edit mode
  const { data: existingRoute, isLoading: routeLoading } = useQuery({
    queryKey: ["route", routeId],
    queryFn: async () => {
      if (!routeId) return null;
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          route_stations(station_tfl_id, sequence_number)
        `)
        .eq("id", routeId)
        .eq("user_id", user?.id || "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!routeId && !!user,
  });

  // Debug: Track selectedStations changes
  useEffect(() => {
    selectedStationsRef.current = selectedStations;
    console.log('🔧 RouteCreate selectedStations state changed to:', selectedStations);
  }, [selectedStations]);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // SEO tags
  useEffect(() => {
    document.title = `${isEditMode ? 'Edit' : 'Create'} Route | Tube Challenge`;
    const desc = `${isEditMode ? 'Edit an existing' : 'Create a new'} tube route or challenge with station sequences.`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, [isEditMode]);

  // Populate form when editing existing route
  useEffect(() => {
    if (isEditMode && existingRoute) {
      console.log('🔧 Loading existing route:', existingRoute);
      const sortedStations = (existingRoute.route_stations || [])
        .sort((a: any, b: any) => a.sequence_number - b.sequence_number)
        .map((rs: any) => rs.station_tfl_id);
      
      console.log('🔧 Sorted stations:', sortedStations);
      
      // Set start and end stations from the actual sequence
      const startStation = sortedStations.length > 0 ? sortedStations[0] : "";
      const endStation = sortedStations.length > 0 ? sortedStations[sortedStations.length - 1] : "";
      
      console.log('🔧 Start station:', startStation, 'End station:', endStation);
      console.log('🔧 Start station name:', getStationName(startStation));
      console.log('🔧 End station name:', getStationName(endStation));
      
      form.reset({
        name: existingRoute.name,
        description: existingRoute.description || "",
        start_station_tfl_id: startStation,
        end_station_tfl_id: endStation,
        estimated_duration_minutes: existingRoute.estimated_duration_minutes || undefined,
        station_sequence: sortedStations,
      });
      
      setSelectedStations(sortedStations);
      
      console.log('🔧 Form values after reset:', form.getValues());
    }
  }, [existingRoute, isEditMode, form]);

  const handleStationSelect = (stationId: string) => {
    console.log('🔧 RouteCreate handleStationSelect called with:', stationId);
    const currentSelected = selectedStationsRef.current;
    console.log('🔧 RouteCreate current selectedStations before update (from ref):', currentSelected);
    const newSequence = [...currentSelected, stationId];
    console.log('🔧 New sequence will be:', newSequence);
    
    setSelectedStations(newSequence);
    setValue("station_sequence", newSequence, { shouldValidate: true });
    
    // Auto-set start station if none selected
    if (newSequence.length === 1 && !form.getValues("start_station_tfl_id")) {
      setValue("start_station_tfl_id", stationId);
    }
    
    // Auto-set end station to last selected
    if (newSequence.length > 0) {
      setValue("end_station_tfl_id", newSequence[newSequence.length - 1]);
    }
  };

  const handleStationRemove = (stationId: string) => {
    const newSequence = selectedStations.filter(id => id !== stationId);
    setSelectedStations(newSequence);
    setValue("station_sequence", newSequence, { shouldValidate: true });
    
    // Update start/end stations if needed
    if (newSequence.length > 0) {
      setValue("start_station_tfl_id", newSequence[0]);
      setValue("end_station_tfl_id", newSequence[newSequence.length - 1]);
    } else {
      setValue("start_station_tfl_id", "");
      setValue("end_station_tfl_id", "");
    }
  };

  const handleSequenceChange = (fromIndex: number, toIndex: number) => {
    const newSequence = [...selectedStations];
    const [moved] = newSequence.splice(fromIndex, 1);
    newSequence.splice(toIndex, 0, moved);
    setSelectedStations(newSequence);
    setValue("station_sequence", newSequence);
    
    // Update start/end stations
    if (newSequence.length > 0) {
      setValue("start_station_tfl_id", newSequence[0]);
      setValue("end_station_tfl_id", newSequence[newSequence.length - 1]);
    }
  };

  const onSubmit = async (values: RouteFormValues) => {
    if (!user) return;
    try {
      if (isEditMode && routeId) {
        // Update existing route
        const { error: routeError } = await supabase
          .from("routes")
          .update({
            name: values.name,
            description: values.description || null,
            start_station_tfl_id: values.start_station_tfl_id,
            end_station_tfl_id: values.end_station_tfl_id,
            estimated_duration_minutes: values.estimated_duration_minutes || null,
          })
          .eq("id", routeId)
          .eq("user_id", user.id);

        if (routeError) throw routeError;

        // Delete existing route stations
        const { error: deleteError } = await supabase
          .from("route_stations")
          .delete()
          .eq("route_id", routeId);

        if (deleteError) throw deleteError;

        // Create new route stations
        const routeStations = selectedStations.map((tfl_id, index) => ({
          route_id: routeId,
          station_tfl_id: tfl_id,
          sequence_number: index + 1,
        }));

        const { error: stationsError } = await supabase
          .from("route_stations")
          .insert(routeStations);

        if (stationsError) throw stationsError;

        toast({ title: "Route updated", description: "Your route was updated successfully." });
      } else {
        // Create new route
        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({
            user_id: user.id,
            name: values.name,
            description: values.description || null,
            start_station_tfl_id: values.start_station_tfl_id,
            end_station_tfl_id: values.end_station_tfl_id,
            estimated_duration_minutes: values.estimated_duration_minutes || null,
          })
          .select()
          .single();

        if (routeError) throw routeError;

        // Create route stations
        const routeStations = selectedStations.map((tfl_id, index) => ({
          route_id: route.id,
          station_tfl_id: tfl_id,
          sequence_number: index + 1,
        }));

        const { error: stationsError } = await supabase
          .from("route_stations")
          .insert(routeStations);

        if (stationsError) throw stationsError;

        toast({ title: "Route created", description: "Your route was created successfully." });
      }
      
      navigate("/routes");
    } catch (e: any) {
      toast({ 
        title: `Failed to ${isEditMode ? 'update' : 'create'} route`, 
        description: e?.message || "Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const getStationName = (tfl_id: string) => {
    console.log('🔧 getStationName called with:', tfl_id);
    console.log('🔧 Available stations:', stations.length);
    const station = stations.find(s => s.id === tfl_id);
    console.log('🔧 Found station:', station);
    return station?.name || tfl_id;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isEditMode ? 'Edit Route' : 'Create Route'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? 'Modify your existing tube route' : 'Design a custom tube route using the interactive map'}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </header>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Route Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Route Details</CardTitle>
                  <CardDescription>Basic information about your route</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Route Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My Custom Route" {...field} />
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe your route..."
                            className="min-h-20"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="start_station_tfl_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Station</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Auto-set from map selection">
                                {field.value ? getStationName(field.value) : "Auto-set from map selection"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stations.map((station) => (
                              <SelectItem key={station.id} value={station.id}>
                                {station.name} (Zone {station.zone})
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
                    name="end_station_tfl_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Station</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Auto-set from map selection">
                                {field.value ? getStationName(field.value) : "Auto-set from map selection"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stations.map((station) => (
                              <SelectItem key={station.id} value={station.id}>
                                {station.name} (Zone {station.zone})
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
                    name="estimated_duration_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="60"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 border-t">
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={selectedStations.length < 2}
                    >
                      {isEditMode ? 'Update Route' : 'Create Route'}
                    </Button>
                    {selectedStations.length < 2 && (
                      <p className="text-sm text-muted-foreground text-center mt-2">
                        Select at least 2 stations on the map to {isEditMode ? 'update' : 'create'} a route
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Interactive Map */}
              <div>
                <RouteMap
                  selectedStations={selectedStations}
                  onStationSelect={handleStationSelect}
                  onStationRemove={handleStationRemove}
                  onSequenceChange={handleSequenceChange}
                />
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default RouteCreate;