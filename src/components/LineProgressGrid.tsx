import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface Line {
  id: string;
  name: string;
  display_name: string;
  color: string;
  line_type: string;
}

interface LineProgress {
  line: Line;
  visitedCount: number;
  totalCount: number;
  percentage: number;
}

interface LineProgressGridProps {
  lineProgress: LineProgress[];
}

export default function LineProgressGrid({ lineProgress }: LineProgressGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {lineProgress.map(({ line, visitedCount, totalCount, percentage }) => (
        <Card key={line.id} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: line.color }}
              />
              <h3 className="font-semibold">{line.name}</h3>
            </div>
            <Badge variant="secondary">
              {percentage}%
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{visitedCount} / {totalCount} stations</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        </Card>
      ))}
    </div>
  );
}