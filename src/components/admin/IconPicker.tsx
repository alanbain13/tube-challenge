import { useState, useMemo } from "react";
import { icons, LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Curated list of badge-appropriate icons
const BADGE_ICONS = [
  // Achievements & Awards
  "Trophy", "Medal", "Award", "Star", "Crown", "Gem", "Diamond", "Heart",
  // Progress & Milestones
  "Target", "Flag", "Milestone", "TrendingUp", "Rocket", "Zap", "Flame",
  // Transportation (relevant to tube challenge)
  "Train", "TrainFront", "Tram", "Map", "MapPin", "Navigation", "Compass", "Route",
  // Numbers & Counts
  "Hash", "Timer", "Clock", "Hourglass", "Calendar", "CalendarCheck",
  // Checkmarks & Success
  "Check", "CheckCircle", "CheckCircle2", "CircleCheck", "BadgeCheck", "ShieldCheck",
  // Badges & Shields
  "Shield", "ShieldPlus", "Badge", "BadgePlus", "Ribbon",
  // Misc Achievement-related
  "Sparkles", "PartyPopper", "Gift", "Cake", "Sun", "Moon", "Mountain", "Trees",
  "Building", "Building2", "Landmark", "Castle", "Church", "Factory",
  // User & Social
  "User", "Users", "UserCheck", "UserPlus", "HandMetal", "ThumbsUp",
] as const;

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Extract icon name from stored value (e.g., "lucide:Trophy" -> "Trophy")
  const selectedIconName = value?.startsWith("lucide:") ? value.replace("lucide:", "") : "";
  const SelectedIcon = selectedIconName ? (icons[selectedIconName as keyof typeof icons] as LucideIcon) : null;

  const filteredIcons = useMemo(() => {
    const searchLower = search.toLowerCase();
    return BADGE_ICONS.filter(name => 
      name.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const handleSelect = (iconName: string) => {
    onChange(`lucide:${iconName}`);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start gap-2"
        >
          {SelectedIcon ? (
            <>
              <SelectedIcon className="h-4 w-4" />
              <span>{selectedIconName}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Select an icon...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-popover" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="h-64">
          <div className="grid grid-cols-6 gap-1 p-2">
            {filteredIcons.map((iconName) => {
              const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
              if (!Icon) return null;
              
              const isSelected = selectedIconName === iconName;
              
              return (
                <Button
                  key={iconName}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-10 w-10",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  onClick={() => handleSelect(iconName)}
                  title={iconName}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              );
            })}
          </div>
          {filteredIcons.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No icons found
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// Helper to render a badge icon from stored value
export function BadgeIcon({ value, className }: { value: string; className?: string }) {
  if (value?.startsWith("lucide:")) {
    const iconName = value.replace("lucide:", "");
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    if (Icon) {
      return <Icon className={className} />;
    }
  }
  // Fallback to image URL
  return <img src={value} alt="Badge" className={className} />;
}
