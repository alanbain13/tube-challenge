import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Save, X } from "lucide-react";
import { IconPicker } from "./IconPicker";
import type { Tables } from "@/integrations/supabase/types";

const badgeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  image_url: z.string().min(1, "Image URL is required"),
  badge_type: z.enum(["milestone", "zone", "line", "timed", "challenge"]),
});

type BadgeFormValues = z.infer<typeof badgeSchema>;

interface BadgeCreateFormProps {
  editingBadge?: Tables<"badges"> | null;
  onCancelEdit?: () => void;
  onSuccess?: () => void;
}

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
    },
  });

  // Pre-populate form when editing
  useEffect(() => {
    if (editingBadge) {
      form.reset({
        name: editingBadge.name,
        description: editingBadge.description || "",
        image_url: editingBadge.image_url,
        badge_type: editingBadge.badge_type as BadgeFormValues["badge_type"],
      });
    } else {
      form.reset({
        name: "",
        description: "",
        image_url: "",
        badge_type: "milestone",
      });
    }
  }, [editingBadge, form]);

  const createBadgeMutation = useMutation({
    mutationFn: async (values: BadgeFormValues) => {
      const { error } = await supabase.from("badges").insert({
        name: values.name,
        description: values.description || null,
        image_url: values.image_url,
        badge_type: values.badge_type,
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
