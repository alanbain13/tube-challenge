import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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
import { ArrowLeft } from 'lucide-react';
import { ActivityPhotoManager } from '@/components/ActivityPhotoManager';

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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

      toast({
        title: 'Success',
        description: 'Activity updated successfully!',
      });
      
      // Invalidate caches for immediate thumbnail refresh
      await queryClient.invalidateQueries({ queryKey: ['activity-extra-photos', 'activity', activity.id] });
      await queryClient.invalidateQueries({ queryKey: ['activities'] });
      navigate('/activities');
      
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

  const handleCancel = () => {
    queryClient.invalidateQueries({ queryKey: ['activity-extra-photos', 'activity', activityId] });
    queryClient.invalidateQueries({ queryKey: ['activities'] });
    navigate('/activities');
  };

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
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <header className="flex items-center gap-4 mb-8">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleCancel}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Edit Activity</h1>
          </header>

          {/* Activity Details Form */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form id="activity-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Additional Photos Section */}
          {activityId && (
            <ActivityPhotoManager activityId={activityId} />
          )}
        </div>
      </div>

      {/* Page-level Cancel/Save Buttons - Sticky Footer */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-lg mx-auto flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="activity-edit-form"
              className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityEdit;