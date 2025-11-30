import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconColor?: string;
  loading?: boolean;
}

export const StatCard = ({ icon: Icon, label, value, iconColor = "text-primary", loading = false }: StatCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={cn("p-3 rounded-lg bg-muted", iconColor)}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">
              {loading ? "—" : value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
