import { useState, useEffect, MouseEvent, useMemo } from "react";
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
  Shield,
  History as HistoryIcon,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserRole } from "@/hooks/useUserManagement";
import { usePermissions } from "@/hooks/usePermissions";
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
  badge?: string; // Small badge text next to label
  permissionKey?: string; // For permission-based filtering
  children?: { to: string; icon: React.ElementType; label: string; permissionKey?: string; badge?: string }[];
};

// 使用翻译的导航项生成函数
const getNavItems = (t: ReturnType<typeof useLanguage>['t']): NavItem[] => [
  { 
    to: "/inbound", 
    icon: PackageCheck, 
    label: t.nav.inbound,
    permissionKey: "inboundScan",
    children: [
      { to: "/inbound/scan", icon: ScanLine, label: t.nav.inboundScan, permissionKey: "inboundScan" },
      { to: "/inbound/records", icon: History, label: t.nav.inboundRecords, permissionKey: "inboundScan" },
      { to: "/inbound/discrepancy", icon: AlertTriangle, label: t.nav.inboundDiscrepancy, permissionKey: "inboundScan" },
    ]
  },
  { 
    to: "/refurbishment", 
    icon: Wrench, 
    label: t.nav.refurbishment || "翻新处理",
    permissionKey: "refurbishment",
    children: [
      { to: "/refurbishment/scan", icon: ScanLine, label: t.nav.refurbishmentScan || "翻新扫码", permissionKey: "refurbishment" },
      { to: "/refurbishment/records", icon: History, label: t.nav.refurbishmentRecords || "翻新记录", permissionKey: "refurbishment" },
    ]
  },
  { to: "/dashboard", icon: LayoutDashboard, label: t.nav.dashboard, permissionKey: "viewDashboard" },
  { to: "/orders", icon: ClipboardList, label: t.nav.orders, badge: "领星导入", permissionKey: "manageOrders" },
  { to: "/removals", icon: PackageX, label: t.nav.removals, badge: "领星导入", permissionKey: "manageOrders" },
  { to: "/order-findings", icon: AlertTriangle, label: t.nav.orderFindings || "退货订单发现", permissionKey: "manageCases" },
  { to: "/inventory", icon: Warehouse, label: t.nav.inventory, permissionKey: "viewInventory" },
  { to: "/products", icon: Package, label: t.nav.products, permissionKey: "manageProducts" },
  { to: "/outbound", icon: PackageOpen, label: t.nav.outbound, permissionKey: "viewInventory" },
  { to: "/cases", icon: FileWarning, label: t.nav.cases, permissionKey: "manageCases" },
];

const getAdminNavItems = (t: ReturnType<typeof useLanguage>['t']): NavItem[] => [
  { 
    to: "/settings", 
    icon: Settings, 
    label: t.nav.settings || "系统设置",
    permissionKey: "manageUsers",
    children: [
      { to: "/users", icon: Users, label: t.nav.users, permissionKey: "manageUsers" },
      { to: "/roles", icon: Shield, label: t.nav.roles || "角色管理", permissionKey: "manageRoles" },
      { to: "/logs", icon: HistoryIcon, label: t.nav.logs || "操作日志", permissionKey: "manageUsers" },
    ]
  },
];

// Filter nav items based on permissions
const filterNavItems = (items: NavItem[], can: Record<string, boolean>): NavItem[] => {
  return items
    .filter(item => {
      if (!item.permissionKey) return true;
      return can[item.permissionKey] ?? false;
    })
    .map(item => {
      if (item.children) {
        const filteredChildren = item.children.filter(child => {
          if (!child.permissionKey) return true;
          return can[child.permissionKey] ?? false;
        });
        // Only include parent if it has visible children
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }
      return item;
    })
    .filter((item): item is NavItem => item !== null);
};

// 移动端侧边栏内容
function MobileSidebarContent({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { can, isAdmin } = usePermissions();
  const { t } = useLanguage();

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

  // Filter nav items based on permissions
  const filteredNavItems = useMemo(() => filterNavItems(navItems, can), [navItems, can]);
  const filteredAdminNavItems = useMemo(() => filterNavItems(adminNavItems, can), [adminNavItems, can]);
  const allNavItems = [...filteredNavItems, ...filteredAdminNavItems];

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
              <Collapsible key={item.to} defaultOpen={isChildActive}>
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
              {item.badge && (
                <span className="ml-auto text-[9px] font-medium text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
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
  const { can, isAdmin } = usePermissions();
  const { t } = useLanguage();

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

  // Filter nav items based on permissions
  const filteredNavItems = useMemo(() => filterNavItems(navItems, can), [navItems, can]);
  const filteredAdminNavItems = useMemo(() => filterNavItems(adminNavItems, can), [adminNavItems, can]);
  const allNavItems = [...filteredNavItems, ...filteredAdminNavItems];

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
                <Collapsible key={item.to} defaultOpen={isChildActive}>
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
                {!collapsed && item.badge && (
                  <span className="ml-auto text-[9px] font-medium text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
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
