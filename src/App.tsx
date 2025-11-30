import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { JourneyTimer } from "@/components/JourneyTimer";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MapPage from "./pages/Map";
import ActivityNew from "./pages/ActivityNew";
import ActivityCheckin from "./pages/ActivityCheckin";
import RouteCreate from "@/pages/RouteCreate";
import RouteView from "@/pages/RouteView";
import ActivityEdit from "@/pages/ActivityEdit";
import ActivityMap from "@/pages/ActivityMap";
import RoutesPage from "@/pages/Routes";
import ActivitiesPage from "@/pages/Activities";
import ActivityDetail from "@/pages/ActivityDetail";
import ProfileSettings from "@/pages/ProfileSettings";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Metros from "@/pages/Metros";
import Challenges from "@/pages/Challenges";
import Badges from "@/pages/Badges";
import Friends from "@/pages/Friends";

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
            <Route path="/metros" element={<Metros />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/challenges" element={<Challenges />} />
            <Route path="/badges" element={<Badges />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/activities/new" element={<ActivityNew />} />
            <Route path="/activities/:activityId/checkin" element={<ActivityCheckin />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/routes/create" element={<RouteCreate />} />
            <Route path="/routes/:id/edit" element={<RouteCreate />} />
            <Route path="/routes/:id/view" element={<RouteView />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/activities/:id" element={<ActivityDetail />} />
            <Route path="/activities/:id/edit" element={<ActivityEdit />} />
            <Route path="/activities/:id/map" element={<ActivityMap />} />
            <Route path="/settings" element={<ProfileSettings />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <JourneyTimer />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;