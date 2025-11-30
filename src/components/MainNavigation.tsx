import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Map, Activity, Trophy, Route, Award, Users, Settings, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <div className="flex flex-col h-full bg-background">
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-hero flex items-center justify-center text-white text-sm font-bold shadow-md">
                        TC
                      </div>
                      <span className="font-bold text-lg">Tube Challenge</span>
                    </div>
                  </div>
                  
                  {/* Navigation Items */}
                  <nav className="flex-1 overflow-y-auto py-4">
                    {navItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;
                      
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-6 py-4 text-base font-medium transition-colors",
                            isActive
                              ? "text-foreground bg-accent/10 border-l-4 border-accent"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
