import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Metros() {
  const metros = [
    {
      id: "london",
      name: "London Underground",
      city: "London",
      country: "United Kingdom",
      stations: 272,
      lines: 11,
      isActive: true,
      image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=200&fit=crop"
    },
    {
      id: "paris",
      name: "Paris Métro",
      city: "Paris",
      country: "France",
      stations: 302,
      lines: 16,
      isActive: false,
      image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=200&fit=crop"
    },
    {
      id: "vienna",
      name: "Vienna U-Bahn",
      city: "Vienna",
      country: "Austria",
      stations: 109,
      lines: 5,
      isActive: false,
      image: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=400&h=200&fit=crop"
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Metro Systems</h1>
          <p className="text-muted-foreground">Choose a metro system to track your progress</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {metros.map((metro) => (
            <Card key={metro.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-32 overflow-hidden">
                <img 
                  src={metro.image} 
                  alt={metro.name}
                  className="w-full h-full object-cover"
                />
                {!metro.isActive && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>
                )}
              </div>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {metro.city}
                  {metro.isActive && <Badge>Active</Badge>}
                </CardTitle>
                <CardDescription>{metro.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stations</span>
                    <span className="font-medium">{metro.stations}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lines</span>
                    <span className="font-medium">{metro.lines}</span>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  disabled={!metro.isActive}
                  variant={metro.isActive ? "default" : "outline"}
                >
                  {metro.isActive ? "View Map" : "Coming Soon"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
