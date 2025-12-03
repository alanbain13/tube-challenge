import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, MapPin, Trophy, Sparkles } from "lucide-react";

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
      <Card className="border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-16 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4">
        {suggestions.slice(0, 2).map((suggestion, index) => {
          const Icon = iconMap[suggestion.icon];
          return (
            <div 
              key={index}
              className="flex items-start gap-3 p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="p-1.5 rounded bg-muted flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{suggestion.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {suggestion.description}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="ghost"
                className="flex-shrink-0 h-auto py-1 px-2 text-xs"
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
