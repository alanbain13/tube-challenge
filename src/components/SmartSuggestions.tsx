import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Target, MapPin, Trophy } from "lucide-react";

interface Suggestion {
  type: "line-completion" | "nearest" | "challenge";
  title: string;
  description: string;
  action: string;
  href: string;
  icon: "target" | "map" | "trophy";
}

interface SmartSuggestionsProps {
  suggestions: Suggestion[];
  loading?: boolean;
}

const iconMap = {
  target: Target,
  map: MapPin,
  trophy: Trophy,
};

export function SmartSuggestions({ suggestions, loading = false }: SmartSuggestionsProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-action-orange" />
            Suggested Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-action-orange" />
          Suggested Next Steps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.slice(0, 2).map((suggestion, index) => {
          const Icon = iconMap[suggestion.icon];
          return (
            <div 
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{suggestion.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {suggestion.description}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="flex-shrink-0"
                onClick={() => navigate(suggestion.href)}
              >
                {suggestion.action}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
