import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, Clock } from "lucide-react";

export default function Challenges() {
  const availableChallenges = [
    {
      id: "1",
      name: "Complete All Lines",
      description: "Visit every station on all London Underground lines",
      type: "Full Network",
      stations: 272,
      participants: 1243,
      recordTime: "18h 35m",
      recordHolder: "SpeedRunner_UK"
    },
    {
      id: "2",
      name: "Circle Line Challenge",
      description: "Complete the entire Circle Line in one journey",
      type: "Single Line",
      stations: 36,
      participants: 5621,
      recordTime: "1h 47m",
      recordHolder: "TubeExplorer"
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Challenges</h1>
          <p className="text-muted-foreground">Test yourself with official and community challenges</p>
        </div>

        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-6">
            <div className="grid gap-6">
              {availableChallenges.map((challenge) => (
                <Card key={challenge.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-2xl mb-2">{challenge.name}</CardTitle>
                        <CardDescription>{challenge.description}</CardDescription>
                      </div>
                      <Badge variant="secondary">{challenge.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-muted-foreground" />
                        <div className="text-sm">
                          <p className="text-muted-foreground">Stations</p>
                          <p className="font-semibold">{challenge.stations}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div className="text-sm">
                          <p className="text-muted-foreground">Participants</p>
                          <p className="font-semibold">{challenge.participants.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div className="text-sm">
                          <p className="text-muted-foreground">Record</p>
                          <p className="font-semibold">{challenge.recordTime}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1">Start Challenge</Button>
                      <Button variant="outline">Leaderboard</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <Card>
              <CardContent className="p-12 text-center">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No completed challenges yet. Start your first challenge!</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
