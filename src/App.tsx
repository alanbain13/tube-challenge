import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MapPage from "./pages/Map";
import ActivityNew from "./pages/ActivityNew";
import ActivityCheckin from "./pages/ActivityCheckin";
import RouteCreate from "@/pages/RouteCreate";
import RoutesPage from "@/pages/Routes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/activities/new" element={<ActivityNew />} />
            <Route path="/activities/:activityId/checkin" element={<ActivityCheckin />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/routes/create" element={<RouteCreate />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;