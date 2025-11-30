import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  colorClass: string;
}

export const ActionCard = ({ title, description, icon: Icon, href, colorClass }: ActionCardProps) => {
  const navigate = useNavigate();

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all hover:scale-105",
        "border-none",
        colorClass
      )}
      onClick={() => navigate(href)}
    >
      <CardContent className="p-6">
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg bg-white/20 w-fit">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
            <p className="text-sm text-white/90">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
