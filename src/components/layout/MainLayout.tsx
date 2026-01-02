import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* 
        手机端 (<768px): 顶部留出 header 高度 (pt-14)
        平板端 (≥768px): 左侧留出 sidebar 宽度 (md:ml-64)
        桌面端 (≥768px): 同平板端
      */}
      <main className="min-h-screen transition-all duration-300 pt-14 md:pt-0 md:ml-64">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
