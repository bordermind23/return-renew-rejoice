import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* 移动端：顶部留出 header 高度；桌面端：左侧留出 sidebar 宽度 */}
      <main className="min-h-screen transition-all duration-300 pt-14 lg:pt-0 lg:ml-64">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
