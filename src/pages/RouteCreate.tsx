import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RouteSchema = z.object({
  name: z.string().min(3, "Name is too short"),
  description: z.string().optional(),
  start_station_tfl_id: z.string().min(1, "Start station required"),
  end_station_tfl_id: z.string().min(1, "End station required"),
  estimated_duration_minutes: z.string().optional(),
  station_sequence: z.array(z.string()).min(2, "Route must have at least start and end stations"),
  search: z.string().optional(),
});

type RouteFormValues = z.infer<typeof RouteSchema>;

const RouteCreate = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // SEO tags
  useEffect(() => {
    document.title = "Create Route | Tube Challenge";
    const desc = "Create a new tube route or challenge with station sequences.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", window.location.origin + "/routes/new");
  }, []);

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(RouteSchema),
    defaultValues: {
      name: "",
      description: "",
      start_station_tfl_id: "",
      end_station_tfl_id: "",
      estimated_duration_minutes: "",
      station_sequence: [],
      search: "",
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting, errors } } = form;

  // Fetch stations
  const { data: stations = [], isLoading: stationsLoading } = useQuery({
    queryKey: ["stations-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("tfl_id,name,zone,lines")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const search = watch("search") || "";
  const startStation = watch("start_station_tfl_id");
  const endStation = watch("end_station_tfl_id");

  const filteredStations = stations.filter((s: any) => {
    const query = search.trim().toLowerCase();
    if (showOnlySelected && !selectedStations.includes(s.tfl_id)) return false;
    if (!query) return true;
    return s.name.toLowerCase().includes(query) || (s.zone || "").toLowerCase().includes(query);
  });

  const toggleStation = (tfl_id: string) => {
    const newSequence = selectedStations.includes(tfl_id)
      ? selectedStations.filter(id => id !== tfl_id)
      : [...selectedStations, tfl_id];
    
    setSelectedStations(newSequence);
    setValue("station_sequence", newSequence, { shouldValidate: true });
  };

  const moveStation = (fromIndex: number, toIndex: number) => {
    const newSequence = [...selectedStations];
    const [moved] = newSequence.splice(fromIndex, 1);
    newSequence.splice(toIndex, 0, moved);
    setSelectedStations(newSequence);
    setValue("station_sequence", newSequence);
  };

  const onSubmit = async (values: RouteFormValues) => {
    if (!user) return;
    try {
      const duration = values.estimated_duration_minutes ? Number(values.estimated_duration_minutes) : null;

      // Create route
      const { data: route, error: routeError } = await supabase
        .from("routes")
        .insert({
          user_id: user.id,
          name: values.name,
          description: values.description || null,
          start_station_tfl_id: values.start_station_tfl_id,
          end_station_tfl_id: values.end_station_tfl_id,
          estimated_duration_minutes: duration,
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
      navigate("/routes");
    } catch (e: any) {
      toast({ title: "Failed to create route", description: e?.message || "Please try again.", variant: "destructive" });
    }
  };

  const getStationName = (tfl_id: string) => {
    const station = stations.find((s: any) => s.tfl_id === tfl_id);
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
            <h1 className="text-3xl font-bold text-foreground">Create Route</h1>
            <p className="text-muted-foreground">Design a custom tube route or challenge</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Route Details */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Route Details</CardTitle>
              <CardDescription>Basic route information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Route Name</Label>
                <Input id="name" placeholder="e.g. Circle Line Challenge" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} placeholder="Optional description" {...register("description")} />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_station">Start Station</Label>
                  <Select onValueChange={(value) => setValue("start_station_tfl_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select start station" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map((station: any) => (
                        <SelectItem key={station.tfl_id} value={station.tfl_id}>
                          {station.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.start_station_tfl_id && <p className="text-sm text-destructive">{errors.start_station_tfl_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_station">End Station</Label>
                  <Select onValueChange={(value) => setValue("end_station_tfl_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select end station" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map((station: any) => (
                        <SelectItem key={station.tfl_id} value={station.tfl_id}>
                          {station.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.end_station_tfl_id && <p className="text-sm text-destructive">{errors.end_station_tfl_id.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_duration">Estimated Duration (minutes)</Label>
                <Input id="estimated_duration" type="number" min="1" placeholder="Optional" {...register("estimated_duration_minutes")} />
              </div>
            </CardContent>
          </Card>

          {/* Middle: Station Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Select Stations</CardTitle>
              <CardDescription>Choose stations for your route</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Input placeholder="Search stations..." {...register("search")} />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox checked={showOnlySelected} onCheckedChange={(v: any) => setShowOnlySelected(Boolean(v))} />
                  Selected only
                </label>
              </div>
              <div className="h-80 overflow-auto rounded-md border p-2">
                {stationsLoading ? (
                  <p className="text-sm text-muted-foreground px-2 py-1">Loading stations...</p>
                ) : filteredStations.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2 py-1">No stations found</p>
                ) : (
                  <ul className="space-y-1">
                    {filteredStations.map((station: any) => (
                      <li key={station.tfl_id} className="px-2 py-1 rounded hover:bg-muted/50">
                        <label className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={selectedStations.includes(station.tfl_id)}
                            onCheckedChange={() => toggleStation(station.tfl_id)}
                          />
                          <span className="flex-1">
                            {station.name}
                            <span className="text-xs text-muted-foreground"> · Zone {station.zone}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.station_sequence && (
                <p className="text-sm text-destructive">{errors.station_sequence.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Right: Route Sequence */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Route Sequence</CardTitle>
              <CardDescription>Arrange stations in order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-80 overflow-auto rounded-md border p-2">
                {selectedStations.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2 py-1">No stations selected</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedStations.map((tfl_id, index) => (
                      <li key={tfl_id} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/30">
                        <span className="text-xs font-mono w-6">{index + 1}</span>
                        <span className="flex-1 text-sm">{getStationName(tfl_id)}</span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveStation(index, Math.max(0, index - 1))}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveStation(index, Math.min(selectedStations.length - 1, index + 1))}
                            disabled={index === selectedStations.length - 1}
                          >
                            ↓
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Stations: {selectedStations.length}
                </div>
                <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting || selectedStations.length < 2}>
                  {isSubmitting ? "Creating..." : "Create Route"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default RouteCreate;