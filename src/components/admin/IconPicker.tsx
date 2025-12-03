import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Curated list of badge-appropriate emojis
const BADGE_EMOJIS = [
  // Trophies & Awards
  "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️", "🎗️",
  // Stars & Sparkles
  "⭐", "🌟", "✨", "💫", "🌠",
  // Progress & Milestones
  "🚶", "🔍", "🧭", "💯", "🗺️", "🎯", "📍", "🧩",
  // Transportation
  "🚇", "🚊", "🚉", "🚃", "🛤️", "🚂",
  // Colors (for line badges)
  "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪",
  // Numbers
  "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟",
  // Achievement & Success
  "✅", "☑️", "🎉", "🎊", "🎁", "👑", "💎", "💪",
  // Time & Speed
  "⏱️", "⏰", "⌚", "🕐", "⚡", "🔥", "💨",
  // Nature & Places
  "🌄", "🏙️", "🌃", "🌆", "🏛️", "🗼",
  // Misc
  "❤️", "💜", "💙", "💚", "💛", "🧡", "🤍", "🖤",
];

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredEmojis = useMemo(() => {
    if (!search) return BADGE_EMOJIS;
    // Simple filter - in real app could use emoji names
    return BADGE_EMOJIS;
  }, [search]);

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
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
          {value ? (
            <>
              <span className="text-2xl">{value}</span>
              <span className="text-muted-foreground">Selected icon</span>
            </>
          ) : (
            <span className="text-muted-foreground">Select an icon...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-popover" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Browse icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="h-64">
          <div className="grid grid-cols-8 gap-1 p-2">
            {filteredEmojis.map((emoji, index) => {
              const isSelected = value === emoji;
              
              return (
                <Button
                  key={`${emoji}-${index}`}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-10 w-10 text-2xl",
                    isSelected && "bg-primary/20 ring-2 ring-primary"
                  )}
                  onClick={() => handleSelect(emoji)}
                >
                  {emoji}
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// Helper to render a badge icon from stored value
export function BadgeIcon({ value, className, size = "md" }: { value: string; className?: string; size?: "sm" | "md" | "lg" }) {
  // Check if it's an emoji (single character or emoji sequence)
  const isEmoji = value && !value.startsWith("http") && !value.startsWith("/") && !value.startsWith("lucide:");
  
  const emojiSizes = {
    sm: "text-2xl",
    md: "text-5xl",
    lg: "text-7xl",
  };
  
  if (isEmoji) {
    return (
      <span className={cn("inline-flex items-center justify-center", emojiSizes[size], className)}>
        {value}
      </span>
    );
  }
  
  // Fallback to image URL
  return (
    <img 
      src={value} 
      alt="Badge" 
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/placeholder.svg";
      }}
    />
  );
}
