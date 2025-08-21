import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, Zap, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";

interface CheckinConfirmationProps {
  stationName: string;
  timestamp: Date;
  isSimulation: boolean;
  sequenceNumber: number;
  imageUrl?: string;
  onDismiss: () => void;
  visible: boolean;
}

export const CheckinConfirmation = ({ 
  stationName, 
  timestamp, 
  isSimulation, 
  sequenceNumber, 
  imageUrl, 
  onDismiss, 
  visible 
}: CheckinConfirmationProps) => {
  if (!visible) return null;

  return (
    <Card className={`mb-4 border-2 ${isSimulation ? 'border-yellow-400 bg-yellow-50' : 'border-green-400 bg-green-50'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className={`h-5 w-5 ${isSimulation ? 'text-yellow-600' : 'text-green-600'}`} />
            <CardTitle className={`text-lg ${isSimulation ? 'text-yellow-800' : 'text-green-800'}`}>
              Check-in verified at {stationName}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className={`h-6 w-6 p-0 ${isSimulation ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-start gap-4">
          {imageUrl && (
            <div className="flex-shrink-0">
              <img 
                src={imageUrl} 
                alt="Roundel verification"
                className="w-16 h-16 rounded-lg object-cover border"
              />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={isSimulation ? "outline" : "default"} 
                    className={isSimulation ? "border-yellow-400 text-yellow-700 bg-yellow-100" : "bg-green-100 text-green-700"}>
                {isSimulation && <Zap className="h-3 w-3 mr-1" />}
                {isSimulation ? "SIMULATION" : "VERIFIED"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                #{sequenceNumber}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(timestamp, "HH:mm:ss")}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Station visit confirmed
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};