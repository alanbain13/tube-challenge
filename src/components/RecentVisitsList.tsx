import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Clock, MapPin, Zap, Eye, Lock } from "lucide-react";
import { format } from "date-fns";

interface Visit {
  id: string;
  sequence_number: number;
  station_tfl_id: string;
  status: string;
  verification_method: string;
  visited_at: string;
  verification_image_url?: string;
  ai_station_text?: string;
  ai_verification_result?: any;
}

interface Station {
  tfl_id?: string;
  name: string;
  zone?: string;
}

interface RecentVisitsListProps {
  visits: Visit[];
  stations: Station[];
  isSimulation: boolean;
}

export const RecentVisitsList = ({ visits, stations, isSimulation }: RecentVisitsListProps) => {
  const getStationName = (tflId: string) => {
    const station = stations.find(s => s.tfl_id === tflId || (s as any).id === tflId);
    return station?.name || tflId;
  };

  const getStatusBadge = (status: string, verificationMethod: string) => {
    if (status === 'visited') {
      return (
        <Badge variant="default" className="bg-green-100 text-green-700">
          {isSimulation ? 'SIM_VERIFIED' : 'VERIFIED'}
        </Badge>
      );
    } else if (status === 'pending') {
      return (
        <Badge variant="outline" className="border-yellow-400 text-yellow-700">
          PENDING
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          FAILED
        </Badge>
      );
    }
  };

  if (visits.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Visits</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No check-ins yet for this activity.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          Recent Visits
          {isSimulation && (
            <Badge variant="outline" className="border-yellow-400 text-yellow-700 bg-yellow-50">
              <Zap className="h-3 w-3 mr-1" />
              SIMULATION
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visits
            .sort((a, b) => b.sequence_number - a.sequence_number)
            .map((visit) => (
              <div
                key={visit.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  visit.status === 'visited' 
                    ? isSimulation 
                      ? 'bg-yellow-50 border-yellow-200' 
                      : 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-xs font-medium">
                    #{visit.sequence_number}
                  </div>
                </div>

                {visit.verification_image_url && (
                  <div className="flex-shrink-0">
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="relative cursor-pointer group">
                          <img 
                            src={visit.verification_image_url} 
                            alt="Visit verification"
                            className="w-12 h-12 rounded object-cover border"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <Eye className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>
                            Visit #{visit.sequence_number} - {getStationName(visit.station_tfl_id)}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <img 
                            src={visit.verification_image_url} 
                            alt="Full verification image"
                            className="w-full rounded-lg"
                          />
                          <div className="text-sm space-y-2">
                            <div><strong>Station:</strong> {getStationName(visit.station_tfl_id)}</div>
                            <div><strong>Time:</strong> {format(new Date(visit.visited_at), "MMM d, HH:mm:ss")}</div>
                            <div><strong>Method:</strong> {visit.verification_method}</div>
                            {visit.ai_station_text && (
                              <div><strong>AI Read:</strong> "{visit.ai_station_text}"</div>
                            )}
                            {visit.ai_verification_result?.confidence && (
                              <div><strong>Confidence:</strong> {Math.round(visit.ai_verification_result.confidence * 100)}%</div>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">
                      {getStationName(visit.station_tfl_id)}
                    </p>
                    {visit.status === 'visited' && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(visit.visited_at), "HH:mm")}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {getStatusBadge(visit.status, visit.verification_method)}
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
};