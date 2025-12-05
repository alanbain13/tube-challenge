import { Activity, Trophy, Globe, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickActionsProps {
  onStartActivity: () => void;
}

interface ActionItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function ActionItem({ icon, title, description, onClick }: ActionItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/30 hover:bg-muted/50 transition-all text-left group w-full"
    >
      <div className="p-2 rounded-md bg-muted text-muted-foreground group-hover:text-primary transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </button>
  );
}

export function QuickActions({ onStartActivity }: QuickActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <ActionItem
        icon={<Activity className="w-4 h-4" />}
        title="Start Activity"
        description="Track your journey"
        onClick={onStartActivity}
      />
      <ActionItem
        icon={<Trophy className="w-4 h-4" />}
        title="Challenges"
        description="Test yourself"
        onClick={() => navigate('/challenges')}
      />
      <ActionItem
        icon={<Globe className="w-4 h-4" />}
        title="Explore Map"
        description="Find stations"
        onClick={() => navigate('/metros/london')}
      />
    </div>
  );
}
