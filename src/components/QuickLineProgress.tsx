import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Line Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 bg-muted animate-pulse rounded w-24" />
              <div className="h-1.5 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Line Progress</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-auto py-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/metros')}
          >
            View All
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {displayLines.map((line) => (
          <div key={line.lineId} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: line.color }}
                />
                <span className="font-medium text-foreground">{line.lineName}</span>
              </div>
              <span className="text-muted-foreground tabular-nums">
                {line.visited}/{line.total}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${line.percentage}%`,
                  backgroundColor: line.color 
                }}
              />
            </div>
          </div>
        ))}
        
        {displayLines.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">
            Start visiting stations to track progress
          </p>
        )}
      </CardContent>
    </Card>
  );
}
