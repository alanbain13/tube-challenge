import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Map, Activity, Trophy, Route, Award, Users, Menu, Shield, Settings, LogOut, User, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { name: "Home", path: "/", icon: Home },
  { name: "Metros", path: "/metros", icon: Map },
  { name: "Activities", path: "/activities", icon: Activity },
  { name: "Routes", path: "/routes", icon: Route },
  { name: "Challenges", path: "/challenges", icon: Trophy },
  { name: "Leaderboards", path: "/leaderboards", icon: Medal },
  { name: "Badges", path: "/badges", icon: Award },
  { name: "Friends", path: "/friends", icon: Users },
];

export const MainNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, loading, signOut } = useAuth();
  const { isAdmin } = useUserRole();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <nav className="bg-background border-b border-border/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 lg:gap-3 font-bold text-lg lg:text-xl text-foreground hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-hero flex items-center justify-center text-white text-xs lg:text-sm font-bold shadow-md">
              TC
            </div>
            <span className="hidden sm:inline">Tube Challenge</span>
          </Link>

          {/* Desktop Navigation */}
          <TooltipProvider delayDuration={100}>
            <div className="hidden xl:flex items-center gap-1 xl:gap-4">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.path}
                        className={cn(
                          "flex items-center gap-1.5 px-2 xl:px-3 py-2 text-sm font-medium transition-colors rounded-md",
                          isActive
                            ? "text-foreground bg-accent/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden xl:inline">{item.name}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent className="xl:hidden">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              
              {/* Admin Link (conditional) */}
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/admin"
                      className={cn(
                        "flex items-center gap-1.5 px-2 xl:px-3 py-2 text-sm font-medium transition-colors rounded-md",
                        location.pathname === "/admin"
                          ? "text-foreground bg-accent/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Shield className="w-4 h-4" />
                      <span className="hidden xl:inline">Admin</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent className="xl:hidden">
                    Admin
                  </TooltipContent>
                </Tooltip>
              )}
            
            {/* Notification Bell */}
            {!loading && user && <NotificationBell />}
            
            {/* Account Dropdown */}
            {!loading && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-popover border border-border shadow-lg z-50">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </div>
          </TooltipProvider>

          {/* Mobile Navigation */}
          <div className="xl:hidden flex items-center gap-2">
            {!loading && user && <NotificationBell />}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <div className="flex flex-col h-full bg-background">
                  {/* Header with User Info */}
                  <div className="p-6 border-b border-border">
                    {user ? (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {getInitials()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {profile?.display_name || "User"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-hero flex items-center justify-center text-white text-sm font-bold shadow-md">
                          TC
                        </div>
                        <span className="font-bold text-lg">Tube Challenge</span>
                      </div>
                    )}
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
                            "flex items-center gap-3 px-6 py-3 text-base font-medium transition-colors",
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
                    
                    {/* Admin Link (conditional) */}
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-6 py-3 text-base font-medium transition-colors",
                          location.pathname === "/admin"
                            ? "text-foreground bg-accent/10 border-l-4 border-accent"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Shield className="w-5 h-5" />
                        Admin
                      </Link>
                    )}
                  </nav>
                  
                  {/* Footer with Profile, Settings and Sign Out */}
                  {user && (
                    <div className="border-t border-border p-4 space-y-2">
                      <Link
                        to="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-2 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                      >
                        <User className="w-5 h-5" />
                        Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-2 py-2 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                      >
                        <Settings className="w-5 h-5" />
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOut();
                        }}
                        className="flex items-center gap-3 px-2 py-2 w-full text-base font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
