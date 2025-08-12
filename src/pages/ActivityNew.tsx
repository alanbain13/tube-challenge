import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

const tubeLines = [
  "Bakerloo",
  "Central",
  "Circle",
  "District",
  "DLR",
  "Hammersmith & City",
  "Jubilee",
  "Metropolitan",
  "Northern",
  "Piccadilly",
  "Victoria",
  "Waterloo & City",
  "Elizabeth",
  "London Overground",
] as const;

const ActivitySchema = z.object({
  title: z.string().min(3, "Title is too short"),
  started_at: z.string().min(1, "Start time required"),
  ended_at: z.string().optional(),
  distance_km: z.string().optional(),
  notes: z.string().optional(),
  line_ids: z.array(z.string()).optional().default([]),
  station_tfl_ids: z.array(z.string()).min(1, "Select at least one station"),
  search: z.string().optional(),
});

type ActivityFormValues = z.infer<typeof ActivitySchema>;

const ActivityNew = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  // SEO tags
  useEffect(() => {
    document.title = "Log Activity | Tube Challenge";
    const desc = "Create a new transport activity with lines and stations.";
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
    link.setAttribute("href", window.location.origin + "/activities/new");
  }, []);

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(ActivitySchema),
    defaultValues: {
      title: "",
      started_at: new Date().toISOString().slice(0, 16),
      ended_at: "",
      distance_km: "",
      notes: "",
      line_ids: [],
      station_tfl_ids: [],
      search: "",
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting, errors } } = form;

  // Fetch stations from Supabase
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
  });

  const search = watch("search") || "";
  const selectedStations: string[] = watch("station_tfl_ids") || [];
  const selectedLines: string[] = watch("line_ids") || [];

  const [showOnlySelected, setShowOnlySelected] = useState(false);

  const filteredStations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = showOnlySelected
      ? stations.filter((s: any) => selectedStations.includes(s.tfl_id))
      : stations;
    if (!q) return base;
    return base.filter((s: any) =>
      s.name.toLowerCase().includes(q) || (s.zone || "").toLowerCase().includes(q)
    );
  }, [search, stations, showOnlySelected, selectedStations]);

  const toggleStation = (tfl_id: string) => {
    const current = new Set(selectedStations);
    if (current.has(tfl_id)) current.delete(tfl_id); else current.add(tfl_id);
    setValue("station_tfl_ids", Array.from(current), { shouldValidate: true });
  };

  const toggleLine = (line: string) => {
    const current = new Set(selectedLines);
    if (current.has(line)) current.delete(line); else current.add(line);
    setValue("line_ids", Array.from(current));
  };

  const onSubmit = async (values: ActivityFormValues) => {
    if (!user) return;
    try {
      const distance = values.distance_km ? Number(values.distance_km) : null;
      const startedISO = values.started_at ? new Date(values.started_at).toISOString() : new Date().toISOString();
      const endedISO = values.ended_at ? new Date(values.ended_at).toISOString() : null;

      const insert = {
        user_id: user.id,
        title: values.title,
        started_at: startedISO,
        ended_at: endedISO,
        distance_km: distance,
        notes: values.notes || null,
        line_ids: values.line_ids || [],
        station_tfl_ids: values.station_tfl_ids,
      } as const;

      const { error } = await supabase.from("activities").insert(insert);
      if (error) throw error;

      toast({ title: "Activity saved", description: "Your activity was created successfully." });
      navigate("/");
    } catch (e: any) {
      toast({ title: "Failed to save activity", description: e?.message || "Please try again.", variant: "destructive" });
    }
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
            <h1 className="text-3xl font-bold text-foreground">Log Activity</h1>
            <p className="text-muted-foreground">Add lines and stations to your new activity</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Basics */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Basics</CardTitle>
              <CardDescription>Title, time and distance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="e.g. Saturday loop" {...register("title")} />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="started_at">Start</Label>
                  <Input id="started_at" type="datetime-local" {...register("started_at")} />
                  {errors.started_at && <p className="text-sm text-destructive">{errors.started_at.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ended_at">End</Label>
                  <Input id="ended_at" type="datetime-local" {...register("ended_at")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="distance_km">Distance (km)</Label>
                <Input id="distance_km" type="number" step="0.1" min="0" placeholder="Optional" {...register("distance_km")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={4} placeholder="Optional" {...register("notes")} />
              </div>
            </CardContent>
          </Card>

          {/* Middle: Lines */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Lines</CardTitle>
              <CardDescription>Select lines you used</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              {tubeLines.map((line) => (
                <label key={line} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={selectedLines.includes(line)}
                    onCheckedChange={() => toggleLine(line)}
                  />
                  <span>{line}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Right: Stations */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Stations</CardTitle>
              <CardDescription>Search and select stations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Input placeholder="Search by name or zone..." {...register("search")} />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox checked={showOnlySelected} onCheckedChange={(v: any) => setShowOnlySelected(Boolean(v))} />
                  Show selected
                </label>
              </div>
              <div className="h-80 overflow-auto rounded-md border p-2">
                {stationsLoading ? (
                  <p className="text-sm text-muted-foreground px-2 py-1">Loading stations...</p>
                ) : filteredStations.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2 py-1">No stations</p>
                ) : (
                  <ul className="space-y-1">
                    {filteredStations.map((s: any) => (
                      <li key={s.tfl_id} className="px-2 py-1 rounded hover:bg-muted/50">
                        <label className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={selectedStations.includes(s.tfl_id)}
                            onCheckedChange={() => toggleStation(s.tfl_id)}
                          />
                          <span className="flex-1">
                            {s.name}
                            <span className="text-xs text-muted-foreground"> · Zone {s.zone}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.station_tfl_ids && (
                <p className="text-sm text-destructive">{errors.station_tfl_ids.message}</p>
              )}
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Selected: {selectedStations.length}
              </div>
              <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Activity"}
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default ActivityNew;
