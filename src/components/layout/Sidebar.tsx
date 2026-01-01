import { useState, useEffect, MouseEvent } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  PackageX,
  PackageCheck,
  Warehouse,
  ClipboardList,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Package,
  Menu,
  X,
  LogOut,
  Users,
  FileWarning,
  ScanLine,
  History,
  AlertTriangle,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserRole } from "@/hooks/useUserManagement";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { toast } from "sonner";

// 检查并触发入库警告的导航函数
const handleNavWithInboundCheck = (
  e: MouseEvent<HTMLAnchorElement>,
  targetPath: string,
  currentPath: string
) => {
  // 如果目标路径和当前路径相同，不拦截
  if (targetPath === currentPath) return;
  
  // 如果当前在入库扫码页面且有入库进行中
  if (
    currentPath === "/inbound/scan" &&
    (window as any).__inboundInProgress &&
    (window as any).__showInboundLeaveWarning
  ) {
    e.preventDefault();
    (window as any).__showInboundLeaveWarning(targetPath);
  }
};

type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  children?: { to: string; icon: React.ElementType; label: string }[];
};

// 使用翻译的导航项生成函数
const getNavItems = (t: ReturnType<typeof useLanguage>['t']): NavItem[] => [
  { 
    to: "/inbound", 
    icon: PackageCheck, 
    label: t.nav.inbound,
    children: [
      { to: "/inbound/scan", icon: ScanLine, label: t.nav.inboundScan },
      { to: "/inbound/records", icon: History, label: t.nav.inboundRecords },
      { to: "/inbound/discrepancy", icon: AlertTriangle, label: t.nav.inboundDiscrepancy },
    ]
  },
  { to: "/dashboard", icon: LayoutDashboard, label: t.nav.dashboard },
  { to: "/orders", icon: ClipboardList, label: t.nav.orders },
  { to: "/removals", icon: PackageX, label: t.nav.removals },
  { to: "/inventory", icon: Warehouse, label: t.nav.inventory },
  { to: "/products", icon: Package, label: t.nav.products },
  { 
    to: "/refurbishment", 
    icon: Wrench, 
    label: t.nav.refurbishment || "翻新处理",
    children: [
      { to: "/refurbishment/scan", icon: ScanLine, label: t.nav.refurbishmentScan || "翻新扫码" },
      { to: "/refurbishment/records", icon: History, label: t.nav.refurbishmentRecords || "翻新记录" },
    ]
  },
  { to: "/outbound", icon: PackageOpen, label: t.nav.outbound },
  { to: "/cases", icon: FileWarning, label: t.nav.cases },
];

const getAdminNavItems = (t: ReturnType<typeof useLanguage>['t']): NavItem[] => [
  { to: "/users", icon: Users, label: t.nav.users },
];

// 移动端侧边栏内容
function MobileSidebarContent({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: userRole } = useCurrentUserRole();
  const { t } = useLanguage();
  const isAdmin = userRole === "admin";

  const navItems = getNavItems(t);
  const adminNavItems = getAdminNavItems(t);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("退出失败");
    } else {
      toast.success("已退出登录");
      navigate("/auth");
    }
    onClose();
  };

  const allNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <Warehouse className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">
            境焕
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-sidebar-foreground">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {allNavItems.map((item) => {
          if (item.children) {
            const isChildActive = item.children.some(child => location.pathname === child.to);
            return (
              <Collapsible key={item.to} defaultOpen={true}>
                <CollapsibleTrigger className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-base font-medium transition-all duration-200",
                  isChildActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 pt-1 space-y-1">
                  {item.children.map((child) => {
                    const isActive = location.pathname === child.to;
                    return (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={(e) => {
                          handleNavWithInboundCheck(e, child.to, location.pathname);
                          if (!e.defaultPrevented) onClose();
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <child.icon className="h-4 w-4 flex-shrink-0" />
                        <span>{child.label}</span>
                      </NavLink>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          }
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={(e) => {
                handleNavWithInboundCheck(e, item.to, location.pathname);
                if (!e.defaultPrevented) onClose();
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">
            {user.email}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          <span>{t.common.logout}</span>
        </button>
      </div>
    </div>
  );
}

// 桌面端侧边栏
function DesktopSidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: userRole } = useCurrentUserRole();
  const { t } = useLanguage();
  const isAdmin = userRole === "admin";

  const navItems = getNavItems(t);
  const adminNavItems = getAdminNavItems(t);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("退出失败");
    } else {
      toast.success("已退出登录");
      navigate("/auth");
    }
  };

  const allNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ease-in-out hidden lg:block",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                <Warehouse className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-sidebar-foreground">
                境焕
              </span>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
              <Warehouse className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {allNavItems.map((item) => {
            if (item.children) {
              const isChildActive = item.children.some(child => location.pathname === child.to);
              return (
                <Collapsible key={item.to} defaultOpen={true}>
                  <CollapsibleTrigger className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isChildActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center"
                  )}>
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </div>
                    {!collapsed && <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />}
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent className="pl-4 pt-1 space-y-1">
                      {item.children.map((child) => {
                        const isActive = location.pathname === child.to;
                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            onClick={(e) => handleNavWithInboundCheck(e, child.to, location.pathname)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                              isActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <child.icon className="h-4 w-4 flex-shrink-0" />
                            <span>{child.label}</span>
                          </NavLink>
                        );
                      })}
                    </CollapsibleContent>
                  )}
                </Collapsible>
              );
            }
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={(e) => handleNavWithInboundCheck(e, item.to, location.pathname)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User info & Actions */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          {!collapsed && user && (
            <div className="px-3 py-1 text-xs text-sidebar-foreground/70 truncate">
              {user.email}
            </div>
          )}
          {!collapsed && (
            <div className="px-1">
              <LanguageSwitcher />
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
              collapsed && "justify-center"
            )}
            title="退出登录"
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>退出登录</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span>收起菜单</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

// 移动端顶部导航栏
export function MobileHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // 路由变化时关闭菜单
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b flex items-center justify-between px-4">
      <div className="flex items-center">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <MobileSidebarContent onClose={() => setIsOpen(false)} />
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-2 ml-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
            <Warehouse className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold">境焕</span>
        </div>
      </div>
      <LanguageSwitcher />
    </header>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <MobileHeader />
      <DesktopSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
    </>
  );
}

export function useSidebarCollapsed() {
  // 简单实现，可以后续改为 context
  return false;
}
