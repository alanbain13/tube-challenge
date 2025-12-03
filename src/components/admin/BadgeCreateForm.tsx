import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Save, X } from "lucide-react";
import { IconPicker } from "./IconPicker";
import type { Tables, Json } from "@/integrations/supabase/types";

const badgeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  image_url: z.string().min(1, "Icon is required"),
  badge_type: z.enum(["milestone", "zone", "line", "timed", "challenge"]),
  // Criteria fields
  threshold: z.coerce.number().optional(),
  zone: z.string().optional(),
  line: z.string().optional(),
  time_limit_minutes: z.coerce.number().optional(),
});

type BadgeFormValues = z.infer<typeof badgeSchema>;

interface BadgeCreateFormProps {
  editingBadge?: Tables<"badges"> | null;
  onCancelEdit?: () => void;
  onSuccess?: () => void;
}

// Line options for the line badge type
const LINE_OPTIONS = [
  { value: "bakerloo", label: "Bakerloo" },
  { value: "central", label: "Central" },
  { value: "circle", label: "Circle" },
  { value: "district", label: "District" },
  { value: "hammersmith-city", label: "Hammersmith & City" },
  { value: "jubilee", label: "Jubilee" },
  { value: "metropolitan", label: "Metropolitan" },
  { value: "northern", label: "Northern" },
  { value: "piccadilly", label: "Piccadilly" },
  { value: "victoria", label: "Victoria" },
  { value: "waterloo-city", label: "Waterloo & City" },
];

export function BadgeCreateForm({ editingBadge, onCancelEdit, onSuccess }: BadgeCreateFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingBadge;

  const form = useForm<BadgeFormValues>({
    resolver: zodResolver(badgeSchema),
    defaultValues: {
      name: "",
      description: "",
      image_url: "",
      badge_type: "milestone",
      threshold: undefined,
      zone: undefined,
      line: undefined,
      time_limit_minutes: undefined,
    },
  });

  const badgeType = useWatch({ control: form.control, name: "badge_type" });

  // Pre-populate form when editing
  useEffect(() => {
    if (editingBadge) {
      const criteria = editingBadge.criteria as { threshold?: number; zone?: string; line?: string; time_limit_minutes?: number } | null;
      form.reset({
        name: editingBadge.name,
        description: editingBadge.description || "",
        image_url: editingBadge.image_url,
        badge_type: editingBadge.badge_type as BadgeFormValues["badge_type"],
        threshold: criteria?.threshold,
        zone: criteria?.zone,
        line: criteria?.line,
        time_limit_minutes: criteria?.time_limit_minutes,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        image_url: "",
        badge_type: "milestone",
        threshold: undefined,
        zone: undefined,
        line: undefined,
        time_limit_minutes: undefined,
      });
    }
  }, [editingBadge, form]);

  // Build criteria object based on badge type
  const buildCriteria = (values: BadgeFormValues): Json | null => {
    switch (values.badge_type) {
      case "milestone":
        return values.threshold ? { threshold: values.threshold } : null;
      case "zone":
        return values.zone ? { zone: values.zone } : null;
      case "line":
        return values.line ? { line: values.line } : null;
      case "timed":
        if (values.threshold && values.time_limit_minutes) {
          const criteria: { threshold: number; time_limit_minutes: number; zone?: string } = {
            threshold: values.threshold,
            time_limit_minutes: values.time_limit_minutes,
          };
          if (values.zone) criteria.zone = values.zone;
          return criteria;
        }
        return null;
      case "challenge":
      default:
        return null;
    }
  };

  const createBadgeMutation = useMutation({
    mutationFn: async (values: BadgeFormValues) => {
      const { error } = await supabase.from("badges").insert({
        name: values.name,
        description: values.description || null,
        image_url: values.image_url,
        badge_type: values.badge_type,
        criteria: buildCriteria(values),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Badge created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create badge: ${error.message}`);
    },
  });

  const updateBadgeMutation = useMutation({
    mutationFn: async (values: BadgeFormValues) => {
      if (!editingBadge) throw new Error("No badge to update");
      const { error } = await supabase
        .from("badges")
        .update({
          name: values.name,
          description: values.description || null,
          image_url: values.image_url,
          badge_type: values.badge_type,
          criteria: buildCriteria(values),
        })
        .eq("id", editingBadge.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Badge updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update badge: ${error.message}`);
    },
  });

  const onSubmit = (values: BadgeFormValues) => {
    if (isEditing) {
      updateBadgeMutation.mutate(values);
    } else {
      createBadgeMutation.mutate(values);
    }
  };

  const isPending = createBadgeMutation.isPending || updateBadgeMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{isEditing ? "Edit Badge" : "Create New Badge"}</CardTitle>
            <CardDescription>
              {isEditing ? "Update badge details" : "Add a new badge definition"}
            </CardDescription>
          </div>
          {isEditing && onCancelEdit && (
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badge Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Zone 1 Master" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="badge_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badge Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="milestone">Milestone</SelectItem>
                        <SelectItem value="zone">Zone Completion</SelectItem>
                        <SelectItem value="line">Line Completion</SelectItem>
                        <SelectItem value="timed">Timed Achievement</SelectItem>
                        <SelectItem value="challenge">Challenge</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Badge Icon</FormLabel>
                  <FormControl>
                    <IconPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dynamic criteria fields based on badge type */}
            {badgeType === "milestone" && (
              <FormField
                control={form.control}
                name="threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Station Threshold</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 50" 
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>Number of unique stations required to earn this badge</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {badgeType === "zone" && (
              <FormField
                control={form.control}
                name="zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select zone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["1", "2", "3", "4", "5", "6"].map((zone) => (
                          <SelectItem key={zone} value={zone}>Zone {zone}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>All stations in this zone must be visited</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {badgeType === "line" && (
              <FormField
                control={form.control}
                name="line"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Line</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select line" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LINE_OPTIONS.map((line) => (
                          <SelectItem key={line.value} value={line.value}>{line.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>All stations on this line must be visited</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {badgeType === "timed" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="threshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Station Count</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g., 10" 
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormDescription>Stations to visit</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="time_limit_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time Limit (minutes)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g., 60" 
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormDescription>Maximum time allowed</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="zone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zone Restriction (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Any zone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Any zone</SelectItem>
                          {["1", "2", "3", "4", "5", "6"].map((zone) => (
                            <SelectItem key={zone} value={zone}>Zone {zone} only</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Optionally restrict to a specific zone</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the badge requirements..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : isEditing ? (
                <Save className="w-4 h-4 mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {isEditing ? "Save Changes" : "Create Badge"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
