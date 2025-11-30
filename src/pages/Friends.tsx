import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";

export default function Friends() {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Friends</h1>
            <p className="text-muted-foreground">Connect with other Tube Challenge enthusiasts</p>
          </div>
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Friend
          </Button>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Connect with friends to see their activities and compete on challenges</p>
            <Button variant="outline">
              <UserPlus className="w-4 h-4 mr-2" />
              Find Friends
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
