import { Link, useLocation } from "react-router-dom";
import { Home, Map, Activity, Trophy, Route, Award, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Home", path: "/", icon: Home },
  { name: "Metros", path: "/metros", icon: Map },
  { name: "Activities", path: "/activities", icon: Activity },
  { name: "Challenges", path: "/challenges", icon: Trophy },
  { name: "Routes", path: "/routes", icon: Route },
  { name: "Badges", path: "/badges", icon: Award },
  { name: "Friends", path: "/friends", icon: Users },
  { name: "Settings", path: "/settings", icon: Settings },
];

export const MainNavigation = () => {
  const location = useLocation();

  return (
    <nav className="bg-background border-b border-border/50 sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 font-bold text-xl text-foreground hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-gradient-hero flex items-center justify-center text-white text-sm font-bold shadow-md">
              TC
            </div>
            <span>Tube Challenge</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Mobile Navigation - Simplified for now */}
          <div className="md:hidden">
            <button className="p-2 text-muted-foreground hover:text-foreground">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
