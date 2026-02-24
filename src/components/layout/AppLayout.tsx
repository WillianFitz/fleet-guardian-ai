import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import ChatWidget from "@/components/ChatWidget";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:ml-60 flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 p-3 sm:p-4 md:p-6">{children}</main>
        <ChatWidget />
      </div>
    </div>
  );
};

export default AppLayout;
