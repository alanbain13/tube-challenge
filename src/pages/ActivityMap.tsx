import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import UnifiedActivityMap from '@/components/UnifiedActivityMap';

const ActivityMap = () => {
  const { id: activityId } = useParams<{ id: string }>();
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (activityId) {
      loadActivityData(activityId);
    }
  }, [activityId]);

  const loadActivityData = async (activityId: string) => {
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

      setActivity(data);
    } catch (error) {
      console.error('Error loading activity data:', error);
      navigate('/activities');
    } finally {
      setLoading(false);
    }
  };

  // SEO
  useEffect(() => {
    document.title = `${activity?.title || 'Activity'} Map | Tube Challenge`;
  }, [activity]);

  if (loading || !activity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading activity map...</p>
      </div>
    );
  }

  return <UnifiedActivityMap activityId={activityId!} activity={activity} />;
};

export default ActivityMap;