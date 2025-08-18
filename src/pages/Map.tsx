import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import MapComponent from '@/components/Map';
import ActivityStartModal from '@/components/ActivityStartModal';


const MapPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showActivityModal, setShowActivityModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Tube Network Map
            </h1>
            <p className="text-muted-foreground">
              Click on stations to mark them as visited
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setShowActivityModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Start Activity
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}> 
              Back to Home
            </Button>
          </div>
        </header>
        
        <MapComponent />
        
        <ActivityStartModal 
          open={showActivityModal} 
          onOpenChange={setShowActivityModal} 
        />
      </div>
    </div>
  );
};

export default MapPage;