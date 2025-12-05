import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useStations } from "@/hooks/useStations";
import SearchStationInput from "@/components/SearchStationInput";
import { Loader2, Plus, X, ChevronUp, ChevronDown, Save } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const challengeTypes = [
  { value: "sequenced", label: "Sequenced Route", description: "Stations must be visited in order" },
  { value: "unsequenced", label: "Unsequenced Route", description: "All stations must be visited in any order" },
  { value: "timed", label: "Timed Challenge", description: "Visit as many stations as possible within time limit" },
  { value: "station_count", label: "Station Count", description: "Visit N stations as fast as possible" },
  { value: "point_to_point", label: "Point to Point", description: "Travel from start to end station" },
] as const;

const difficultyLevels = ["easy", "medium", "hard", "expert"] as const;

const verificationLevels = [
  { value: "location_verified", label: "Location", description: "All stations must be verified by GPS location" },
  { value: "photo_verified", label: "Photo", description: "Stations can be verified by photo or GPS" },
  { value: "remote_verified", label: "Remote", description: "Any verification method accepted" },
] as const;

const challengeSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(100, "Name must be less than 100 characters"),
  description: z.string().trim().max(500, "Description must be less than 500 characters").optional(),
  challenge_type: z.enum(["sequenced", "unsequenced", "timed", "station_count", "point_to_point"]),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]).optional(),
  is_sequenced: z.boolean().default(false),
  time_limit_seconds: z.number().min(60, "Minimum 1 minute").max(86400, "Maximum 24 hours").optional(),
  target_station_count: z.number().min(2, "Minimum 2 stations").max(300, "Maximum 300 stations").optional(),
  estimated_duration_minutes: z.number().min(1).max(1440).optional(),
  required_verification: z.enum(["location_verified", "photo_verified", "remote_verified"]).default("remote_verified"),
});

type ChallengeFormData = z.infer<typeof challengeSchema>;

interface ChallengeCreateFormProps {
  onSuccess?: () => void;
  editingChallenge?: Tables<"challenges"> | null;
  onCancelEdit?: () => void;
}

export const ChallengeCreateForm = ({ onSuccess, editingChallenge, onCancelEdit }: ChallengeCreateFormProps) => {
  const queryClient = useQueryClient();
  const { stations, loading: stationsLoading } = useStations();
  const isEditing = !!editingChallenge;
  
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [startStationId, setStartStationId] = useState<string | null>(null);
  const [endStationId, setEndStationId] = useState<string | null>(null);

  const form = useForm<ChallengeFormData>({
    resolver: zodResolver(challengeSchema),
    defaultValues: {
      name: "",
      description: "",
      challenge_type: "sequenced",
      difficulty: "medium",
      is_sequenced: true,
      time_limit_seconds: undefined,
      target_station_count: undefined,
      required_verification: "remote_verified",
      estimated_duration_minutes: undefined,
    },
  });

  // Pre-populate form when editing
  useEffect(() => {
    if (editingChallenge) {
      form.reset({
        name: editingChallenge.name,
        description: editingChallenge.description || "",
        challenge_type: editingChallenge.challenge_type as ChallengeFormData["challenge_type"],
        difficulty: (editingChallenge.difficulty as ChallengeFormData["difficulty"]) || "medium",
        is_sequenced: editingChallenge.is_sequenced || false,
        time_limit_seconds: editingChallenge.time_limit_seconds || undefined,
        target_station_count: editingChallenge.target_station_count || undefined,
        estimated_duration_minutes: editingChallenge.estimated_duration_minutes || undefined,
        required_verification: (editingChallenge.required_verification as ChallengeFormData["required_verification"]) || "remote_verified",
      });
      
      // Set station data
      if (editingChallenge.challenge_type === "point_to_point") {
        setStartStationId(editingChallenge.start_station_tfl_id);
        setEndStationId(editingChallenge.end_station_tfl_id);
        setSelectedStations([]);
      } else {
        setSelectedStations(editingChallenge.station_tfl_ids || []);
        setStartStationId(null);
        setEndStationId(null);
      }
    } else {
      form.reset({
        name: "",
        description: "",
        challenge_type: "sequenced",
        difficulty: "medium",
        is_sequenced: true,
        time_limit_seconds: undefined,
        target_station_count: undefined,
        estimated_duration_minutes: undefined,
        required_verification: "remote_verified",
      });
      setSelectedStations([]);
      setStartStationId(null);
      setEndStationId(null);
    }
  }, [editingChallenge, form]);

  const challengeType = form.watch("challenge_type");

  // Update is_sequenced based on challenge type
  const updateSequencedFlag = (type: string) => {
    form.setValue("is_sequenced", type === "sequenced" || type === "point_to_point");
  };

  const validateChallengeData = (data: ChallengeFormData) => {
    if (["sequenced", "unsequenced"].includes(data.challenge_type)) {
      // When editing, use existing stations if selectedStations state is empty
      const stationsToUse = selectedStations.length > 0 
        ? selectedStations 
        : (isEditing && editingChallenge?.station_tfl_ids) || [];
      if (stationsToUse.length < 2) {
        throw new Error("Please select at least 2 stations");
      }
    }

    if (data.challenge_type === "point_to_point") {
      const start = startStationId || (isEditing && editingChallenge?.start_station_tfl_id) || null;
      const end = endStationId || (isEditing && editingChallenge?.end_station_tfl_id) || null;
      if (!start || !end) {
        throw new Error("Please select both start and end stations");
      }
    }

    if (data.challenge_type === "timed" && !data.time_limit_seconds) {
      throw new Error("Please set a time limit for timed challenges");
    }

    if (data.challenge_type === "station_count" && !data.target_station_count) {
      throw new Error("Please set a target station count");
    }
  };

  const buildChallengePayload = (data: ChallengeFormData, metroSystemId: string) => {
    let stationTflIds: string[] = [];
    if (["sequenced", "unsequenced"].includes(data.challenge_type)) {
      stationTflIds = selectedStations;
    } else if (data.challenge_type === "point_to_point") {
      stationTflIds = [startStationId!, endStationId!];
    }

    return {
      name: data.name,
      description: data.description || null,
      challenge_type: data.challenge_type,
      difficulty: data.difficulty || null,
      is_sequenced: data.is_sequenced,
      is_official: true,
      metro_system_id: metroSystemId,
      station_tfl_ids: stationTflIds,
      start_station_tfl_id: data.challenge_type === "point_to_point" ? startStationId : (selectedStations[0] || null),
      end_station_tfl_id: data.challenge_type === "point_to_point" ? endStationId : (selectedStations[selectedStations.length - 1] || null),
      time_limit_seconds: data.time_limit_seconds || null,
      target_station_count: data.target_station_count || null,
      required_verification: data.required_verification || "remote_verified",
      estimated_duration_minutes: data.estimated_duration_minutes || null,
      ranking_metric: data.challenge_type === "timed" ? "stations" : "time",
    };
  };

  const createChallengeMutation = useMutation({
    mutationFn: async (data: ChallengeFormData) => {
      const { data: metroSystem, error: metroError } = await supabase
        .from("metro_systems")
        .select("id")
        .eq("code", "london")
        .single();

      if (metroError || !metroSystem) {
        throw new Error("Failed to find London metro system");
      }

      validateChallengeData(data);
      const payload = buildChallengePayload(data, metroSystem.id);

      const { error } = await supabase.from("challenges").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Challenge created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      form.reset();
      setSelectedStations([]);
      setStartStationId(null);
      setEndStationId(null);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateChallengeMutation = useMutation({
    mutationFn: async (data: ChallengeFormData) => {
      if (!editingChallenge) throw new Error("No challenge to update");

      validateChallengeData(data);
      
      // Use current state if available, otherwise fall back to editingChallenge data
      const stationsToUse = selectedStations.length > 0 
        ? selectedStations 
        : (editingChallenge.station_tfl_ids || []);
      const startStation = startStationId || editingChallenge.start_station_tfl_id;
      const endStation = endStationId || editingChallenge.end_station_tfl_id;
      
      const payload = {
        name: data.name,
        description: data.description || null,
        challenge_type: data.challenge_type,
        difficulty: data.difficulty || null,
        is_sequenced: data.is_sequenced,
        station_tfl_ids: ["sequenced", "unsequenced"].includes(data.challenge_type) 
          ? stationsToUse 
          : data.challenge_type === "point_to_point" 
            ? [startStation!, endStation!] 
            : [],
        start_station_tfl_id: data.challenge_type === "point_to_point" ? startStation : (stationsToUse[0] || null),
        end_station_tfl_id: data.challenge_type === "point_to_point" ? endStation : (stationsToUse[stationsToUse.length - 1] || null),
        time_limit_seconds: data.time_limit_seconds || null,
        target_station_count: data.target_station_count || null,
        estimated_duration_minutes: data.estimated_duration_minutes || null,
        ranking_metric: data.challenge_type === "timed" ? "stations" : "time",
        required_verification: data.required_verification || "remote_verified",
      };

      const { error } = await supabase
        .from("challenges")
        .update(payload)
        .eq("id", editingChallenge.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Challenge updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-challenges"] });
      onCancelEdit?.();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddStation = (stationTflId: string) => {
    if (!selectedStations.includes(stationTflId)) {
      setSelectedStations([...selectedStations, stationTflId]);
    }
  };

  const handleRemoveStation = (stationTflId: string) => {
    setSelectedStations(selectedStations.filter((id) => id !== stationTflId));
  };

  const moveStation = (index: number, direction: "up" | "down") => {
    const newStations = [...selectedStations];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newStations.length) return;
    [newStations[index], newStations[newIndex]] = [newStations[newIndex], newStations[index]];
    setSelectedStations(newStations);
  };

  const getStationName = (tflId: string) => {
    return stations.find((s) => s.id === tflId)?.name || tflId;
  };

  const onSubmit = (data: ChallengeFormData) => {
    if (isEditing) {
      updateChallengeMutation.mutate(data);
    } else {
      createChallengeMutation.mutate(data);
    }
  };

  const showStationList = ["sequenced", "unsequenced"].includes(challengeType);
  const showPointToPoint = challengeType === "point_to_point";
  const showTimeLimit = challengeType === "timed";
  const showTargetCount = challengeType === "station_count";
  const isPending = createChallengeMutation.isPending || updateChallengeMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEditing ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isEditing ? "Edit Challenge" : "Create Official Challenge"}
        </CardTitle>
        <CardDescription>
          {isEditing ? `Editing: ${editingChallenge?.name}` : "Create a new challenge for all users"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Challenge Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Zone 1 Sprint" {...field} maxLength={100} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="challenge_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Challenge Type *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        updateSequencedFlag(value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {challengeTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-xs text-muted-foreground">{type.description}</div>
                            </div>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the challenge..."
                      {...field}
                      maxLength={500}
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>{field.value?.length || 0}/500 characters</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select difficulty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {difficultyLevels.map((level) => (
                          <SelectItem key={level} value={level} className="capitalize">
                            {level}
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
                        placeholder="e.g., 60"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        value={field.value || ""}
                        min={1}
                        max={1440}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Required Verification Level */}
            <FormField
              control={form.control}
              name="required_verification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Required Verification Level</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select verification level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {verificationLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <div>
                            <div className="font-medium">{level.label}</div>
                            <div className="text-xs text-muted-foreground">{level.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Determines what verification level is required for challenge completion
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Time Limit for Timed Challenges */}
            {showTimeLimit && (
              <FormField
                control={form.control}
                name="time_limit_seconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Limit (seconds) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 3600 for 1 hour"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        value={field.value || ""}
                        min={60}
                        max={86400}
                      />
                    </FormControl>
                    <FormDescription>
                      Common values: 1800 (30 min), 3600 (1 hr), 7200 (2 hrs)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Target Station Count for Station Count Challenges */}
            {showTargetCount && (
              <FormField
                control={form.control}
                name="target_station_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Station Count *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 10"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        value={field.value || ""}
                        min={2}
                        max={300}
                      />
                    </FormControl>
                    <FormDescription>Number of stations to visit to complete the challenge</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Point to Point Station Selection */}
            {showPointToPoint && (
              <div className="space-y-4">
                <div>
                  <Label>Start Station *</Label>
                  {stationsLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading stations...</span>
                    </div>
                  ) : (
                    <SearchStationInput
                      stations={stations}
                      selectedStation={stations.find((s) => s.id === startStationId)}
                      onStationSelect={(station) => setStartStationId(station.id)}
                      placeholder="Select start station"
                    />
                  )}
                </div>
                <div>
                  <Label>End Station *</Label>
                  {stationsLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading stations...</span>
                    </div>
                  ) : (
                    <SearchStationInput
                      stations={stations}
                      selectedStation={stations.find((s) => s.id === endStationId)}
                      onStationSelect={(station) => setEndStationId(station.id)}
                      placeholder="Select end station"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Station List for Sequenced/Unsequenced */}
            {showStationList && (
              <div className="space-y-4">
                <div>
                  <Label>Add Stations *</Label>
                  {stationsLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading stations...</span>
                    </div>
                  ) : (
                    <SearchStationInput
                      stations={stations.filter((s) => !selectedStations.includes(s.id))}
                      onStationSelect={(station) => handleAddStation(station.id)}
                      placeholder="Search and add stations"
                    />
                  )}
                </div>

                {selectedStations.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Stations ({selectedStations.length})</Label>
                    <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                      {selectedStations.map((tflId, index) => (
                        <div key={tflId} className="flex items-center justify-between p-2 text-sm">
                          <div className="flex items-center gap-2">
                            {challengeType === "sequenced" && (
                              <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                                {index + 1}
                              </Badge>
                            )}
                            <span>{getStationName(tflId)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {challengeType === "sequenced" && (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveStation(index, "up")}
                                  disabled={index === 0}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveStation(index, "down")}
                                  disabled={index === selectedStations.length - 1}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveStation(tflId)}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isEditing && (
              <Button type="button" variant="outline" onClick={onCancelEdit} className="w-full">
                Cancel Editing
              </Button>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  {isEditing ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {isEditing ? "Update Challenge" : "Create Challenge"}
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
