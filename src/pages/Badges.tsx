import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Award } from "lucide-react";

export default function Badges() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Badges</h1>
          <p className="text-muted-foreground">Your earned achievements and completed challenges</p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Complete challenges to earn badges!</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
