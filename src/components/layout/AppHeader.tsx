import { Bell, Search, User, AlertTriangle, LogOut, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import useStore from "@/hooks/useStore";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AppHeader = () => {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const { notifications, unreadCount } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { items: clients } = useStore("clients", []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "error":
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return <Bell className="w-4 h-4 text-info" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "error": return "border-destructive/20 bg-destructive/5";
      case "warning": return "border-warning/20 bg-warning/5";
      case "info": return "border-info/20 bg-info/5";
      default: return "border-border bg-muted/30";
    }
  };

  return (
    <>
      <header className="h-16 border-b border-border flex items-center justify-between px-3 sm:px-4 md:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        {/* left: logo spacer on mobile (hamburger is fixed) + search on sm+ */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {/* empty space for the mobile hamburger which is fixed */}
          <div className="w-10 h-10 lg:hidden" />
          <div className="relative max-w-md w-full hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar veículos, motoristas, OS..."
              className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>
        </div>

        {/* right: search icon (mobile), bell, avatar */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mobile search toggle */}
          <button
            className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            aria-label="Buscar"
          >
            {mobileSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full animate-pulse" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(320px,90vw)] p-0" align="end" sideOffset={8}>
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs text-muted-foreground">{unreadCount} nova(s)</span>
                  )}
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-3 hover:bg-muted/30 transition-colors cursor-pointer ${getNotificationColor(notif.type)}`}
                        onClick={() => { if (notif.link) { navigate(notif.link); setNotificationsOpen(false); } }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0">{getNotificationIcon(notif.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {notif.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* User menu */}
          <div className="flex items-center gap-2 sm:gap-3 pl-1 sm:pl-3 border-l border-border ml-1">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-foreground leading-tight">{user?.nome || "Admin"}</p>
              <p className="text-xs text-muted-foreground">{tenant?.nome || "..."}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{user?.nome || "Admin"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{tenant?.nome || "..."}</p>
                </div>
                <DropdownMenuItem onClick={() => navigate("/clientes")} className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Clientes ({clients.length || 0})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile search bar — slides in below header */}
      {mobileSearchOpen && (
        <div className="sm:hidden sticky top-16 z-40 bg-card/95 backdrop-blur-sm border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar veículos, motoristas, OS..."
              className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AppHeader;
