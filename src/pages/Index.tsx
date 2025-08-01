import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import ProfileSetup from "@/components/ProfileSetup";

const Index = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

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

  // Show profile setup if user hasn't completed their profile
  if (!profile || !profile.display_name) {
    return <ProfileSetup userId={user.id} onComplete={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Tube Challenge
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {profile.display_name || user.email}!
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </header>
        
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">
            Ready to conquer the London Underground?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Track your progress through all 272 stations across the Tube network. 
            Complete challenges, earn badges, and compete with fellow travelers.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="text-xl font-semibold mb-2">Zone 1 Sprint</h3>
              <p className="text-muted-foreground mb-4">
                Visit all Zone 1 stations as fast as possible
              </p>
              <Button className="w-full" disabled>
                Coming Soon
              </Button>
            </div>
            
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="text-xl font-semibold mb-2">Interactive Map</h3>
              <p className="text-muted-foreground mb-4">
                Explore the Tube network and track your progress
              </p>
              <Button className="w-full" disabled>
                Coming Soon
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
