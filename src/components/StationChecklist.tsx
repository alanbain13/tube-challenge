import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Line {
  id: string;
  name: string;
  color: string;
}

interface Station {
  id: string;
  name: string;
  displayName: string;
  lines: string[];
}

interface StationChecklistProps {
  lines: Line[];
  stations: Station[];
  verifiedVisits: string[];
}

export default function StationChecklist({ 
  lines, 
  stations, 
  verifiedVisits 
}: StationChecklistProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const stationsByLine = useMemo(() => {
    const lineMap = new Map<string, { line: Line; stations: Station[] }>();
    
    lines.forEach(line => {
      const lineStations = stations.filter(station => 
        station.lines.includes(line.name)
      );
      if (lineStations.length > 0) {
        lineMap.set(line.id, { line, stations: lineStations });
      }
    });

    return lineMap;
  }, [lines, stations]);

  const filteredStationsByLine = useMemo(() => {
    if (!searchQuery.trim()) return stationsByLine;

    const query = searchQuery.toLowerCase();
    const filtered = new Map();

    stationsByLine.forEach((value, key) => {
      const matchingStations = value.stations.filter(station =>
        station.displayName.toLowerCase().includes(query)
      );
      if (matchingStations.length > 0) {
        filtered.set(key, { ...value, stations: matchingStations });
      }
    });

    return filtered;
  }, [stationsByLine, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Accordion type="multiple" className="w-full">
        {Array.from(filteredStationsByLine.entries()).map(([lineId, { line, stations: lineStations }]) => {
          const visitedInLine = lineStations.filter(s => verifiedVisits.includes(s.id)).length;
          const totalInLine = lineStations.length;

          return (
            <AccordionItem key={lineId} value={lineId}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: line.color }}
                  />
                  <span className="font-semibold">{line.name}</span>
                  <Badge variant="secondary" className="ml-auto mr-2">
                    {visitedInLine} / {totalInLine}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  {lineStations.map(station => {
                    const isVisited = verifiedVisits.includes(station.id);
                    return (
                      <div 
                        key={station.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox 
                          checked={isVisited} 
                          disabled
                          className="pointer-events-none"
                        />
                        <span className={`text-sm ${isVisited ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {station.displayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}