import { ActionCard } from "@/components/ActionCard";
import { Activity, Zap, Map } from "lucide-react";

interface QuickActionsProps {
  onStartActivity: () => void;
}

export function QuickActions({ onStartActivity }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div onClick={onStartActivity} className="cursor-pointer">
        <ActionCard
          title="Start Activity"
          description="Track your tube journey"
          icon={Activity}
          href="#"
          colorClass="bg-gradient-to-br from-action-orange to-action-orange/80"
        />
      </div>
      <ActionCard
        title="Take a Challenge"
        description="Test yourself!"
        icon={Zap}
        href="/challenges"
        colorClass="bg-gradient-to-br from-action-blue to-action-blue/80"
      />
      <ActionCard
        title="Explore Map"
        description="Find stations near you"
        icon={Map}
        href="/map"
        colorClass="bg-gradient-to-br from-action-purple to-action-purple/80"
      />
    </div>
  );
}
