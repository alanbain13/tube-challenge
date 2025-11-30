import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface MetroSystem {
  id: string;
  name: string;
  city: string;
  country: string;
  code: string;
  station_count: number;
  line_count: number;
  is_active: boolean;
  image_url: string;
}

export default function Metros() {
  const navigate = useNavigate();

  const { data: metros, isLoading } = useQuery({
    queryKey: ['metro-systems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metro_systems')
        .select('*')
        .order('is_active', { ascending: false })
        .order('city');
      
      if (error) throw error;
      return data as MetroSystem[];
    }
  });

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black mb-2 text-foreground">Metro Systems</h1>
          <p className="text-muted-foreground">Choose a metro system to explore and track your progress</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-32 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metros?.map((metro) => (
              <Card key={metro.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-32 overflow-hidden">
                  <img 
                    src={metro.image_url} 
                    alt={metro.name}
                    className="w-full h-full object-cover"
                  />
                  {!metro.is_active && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Badge variant="secondary">Coming Soon</Badge>
                    </div>
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {metro.city}
                    {metro.is_active && <Badge className="bg-success">Active</Badge>}
                  </CardTitle>
                  <CardDescription>{metro.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stations</span>
                      <span className="font-medium">{metro.station_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lines</span>
                      <span className="font-medium">{metro.line_count}</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    disabled={!metro.is_active}
                    variant={metro.is_active ? "default" : "outline"}
                    onClick={() => metro.is_active && navigate(`/metros/${metro.code}`)}
                  >
                    {metro.is_active ? "View Map" : "Coming Soon"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
