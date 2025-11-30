import { ReactNode } from "react";
import { MainNavigation } from "./MainNavigation";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};
