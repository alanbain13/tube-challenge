import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Users } from "lucide-react";

interface Route {
  id: string;
  name: string;
  description: string | null;
  start_station_tfl_id: string;
  end_station_tfl_id: string;
  estimated_duration_minutes: number | null;
  user_id: string;
  route_stations?: { station_tfl_id: string; sequence_number: number }[];
}

interface ShareAsChallengeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: Route | null;
  onSuccess: () => void;
}

export function ShareAsChallengeModal({ open, onOpenChange, route, onSuccess }: ShareAsChallengeModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    difficulty: "medium",
    estimatedDuration: "",
    verificationLevel: "remote_verified",
  });

  // Reset form when route changes
  const resetForm = () => {
    if (route) {
      setFormData({
        name: route.name,
        description: route.description || "",
        difficulty: "medium",
        estimatedDuration: route.estimated_duration_minutes?.toString() || "",
        verificationLevel: "remote_verified",
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route) return;

    setIsSubmitting(true);
    try {
      // Get station sequence from route_stations
      const stationIds = route.route_stations
        ?.sort((a, b) => a.sequence_number - b.sequence_number)
        .map(rs => rs.station_tfl_id) || [];

      if (stationIds.length < 2) {
        toast({
          title: "Cannot create challenge",
          description: "Route must have at least 2 stations",
          variant: "destructive",
        });
        return;
      }

      // Get metro_system_id from the first station
      const { data: stationData } = await supabase
        .from("stations")
        .select("metro_system_id")
        .eq("tfl_id", stationIds[0])
        .single();

      const metroSystemId = stationData?.metro_system_id;

      if (!metroSystemId) {
        toast({
          title: "Error",
          description: "Could not determine metro system for this route",
          variant: "destructive",
        });
        return;
      }

      // Create the challenge
      const { error: challengeError } = await supabase
        .from("challenges")
        .insert({
          name: formData.name,
          description: formData.description || null,
          challenge_type: "sequenced_route",
          is_sequenced: true,
          is_official: false,
          created_by_user_id: route.user_id,
          created_from_route_id: route.id,
          metro_system_id: metroSystemId,
          station_tfl_ids: stationIds,
          start_station_tfl_id: stationIds[0],
          end_station_tfl_id: stationIds[stationIds.length - 1],
          difficulty: formData.difficulty,
          estimated_duration_minutes: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
          required_verification: formData.verificationLevel,
        });

      if (challengeError) throw challengeError;

      // Mark route as shared (public)
      const { error: routeError } = await supabase
        .from("routes")
        .update({ is_public: true })
        .eq("id", route.id);

      if (routeError) throw routeError;

      toast({
        title: "Challenge created!",
        description: "Your route has been shared as a Social Challenge with friends",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating challenge:", error);
      toast({
        title: "Error creating challenge",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!route) return null;

  const stationCount = route.route_stations?.length || 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Share as Challenge
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            Create a Social Challenge from your route that friends can attempt
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Challenge Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter challenge name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your challenge..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value) => setFormData(prev => ({ ...prev, difficulty: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Est. Duration (mins)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.estimatedDuration}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: e.target.value }))}
                placeholder="e.g. 60"
                min="1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verification">Verification Level</Label>
            <Select
              value={formData.verificationLevel}
              onValueChange={(value) => setFormData(prev => ({ ...prev, verificationLevel: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="location_verified">Location (GPS Required)</SelectItem>
                <SelectItem value="photo_verified">Photo (Photo Match)</SelectItem>
                <SelectItem value="remote_verified">Remote (Honor System)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Determines how strictly station visits are verified
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Route Details</p>
            <p className="text-muted-foreground">{stationCount} stations • Sequenced Route</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Challenge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
