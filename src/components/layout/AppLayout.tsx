import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import ChatWidget from "@/components/ChatWidget";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayoutInner = ({ children }: AppLayoutProps) => {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${collapsed ? "lg:ml-16" : "lg:ml-60"}`}>
        <AppHeader />
        <main className="flex-1 p-3 sm:p-4 md:p-6">{children}</main>
        <ChatWidget />
      </div>
    </div>
  );
};

const AppLayout = ({ children }: AppLayoutProps) => (
  <SidebarProvider>
    <AppLayoutInner>{children}</AppLayoutInner>
  </SidebarProvider>
);

export default AppLayout;
