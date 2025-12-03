import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight } from "lucide-react";

interface LineProgress {
  lineId: string;
  lineName: string;
  color: string;
  visited: number;
  total: number;
  percentage: number;
}

interface QuickLineProgressProps {
  lines: LineProgress[];
  loading?: boolean;
}

export function QuickLineProgress({ lines, loading = false }: QuickLineProgressProps) {
  const navigate = useNavigate();
  
  // Sort by percentage and take top 3 (with at least some progress)
  const topLines = lines
    .filter(l => l.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3);

  // If no progress, show first 3 lines
  const displayLines = topLines.length > 0 ? topLines : lines.slice(0, 3);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Your Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-2 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Your Progress</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => navigate('/metros/london-underground')}
          >
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayLines.map((line) => (
          <div key={line.lineId} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: line.color }}
                />
                <span className="font-medium text-sm">{line.lineName}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {line.visited}/{line.total}
              </span>
            </div>
            <div className="relative">
              <Progress value={line.percentage} className="h-2" />
              <span className="absolute right-0 -top-5 text-xs font-semibold">
                {line.percentage}%
              </span>
            </div>
          </div>
        ))}
        
        {displayLines.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Start visiting stations to track your progress!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
