import { Calendar, Clock, Wrench, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuickFilterPreset {
  id: string;
  label: string;
  icon: React.ReactNode;
  filter: {
    statusFilters?: ("未到货" | "到货" | "出库")[];
    gradeFilter?: string;
    dateRange?: "today" | "week" | "month";
  };
}

const presets: QuickFilterPreset[] = [
  {
    id: "today-arrived",
    label: "今日到货",
    icon: <Calendar className="h-3.5 w-3.5" />,
    filter: { statusFilters: ["到货"], dateRange: "today" },
  },
  {
    id: "pending",
    label: "待处理",
    icon: <Clock className="h-3.5 w-3.5" />,
    filter: { statusFilters: ["未到货"] },
  },
  {
    id: "needs-refurbishment",
    label: "需翻新",
    icon: <Wrench className="h-3.5 w-3.5" />,
    filter: { gradeFilter: "B,C" },
  },
  {
    id: "all-arrived",
    label: "全部到货",
    icon: <Package className="h-3.5 w-3.5" />,
    filter: { statusFilters: ["到货"] },
  },
  {
    id: "grade-a",
    label: "A级商品",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    filter: { gradeFilter: "A" },
  },
];

interface QuickFiltersProps {
  activePreset: string | null;
  onPresetChange: (preset: QuickFilterPreset | null) => void;
}

export function QuickFilters({ activePreset, onPresetChange }: QuickFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground mr-1">快速筛选:</span>
      {presets.map((preset) => (
        <Button
          key={preset.id}
          variant={activePreset === preset.id ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-7 text-xs gap-1.5 transition-all",
            activePreset === preset.id 
              ? "gradient-primary text-primary-foreground shadow-sm" 
              : "hover:bg-primary/10 hover:text-primary hover:border-primary/50"
          )}
          onClick={() => {
            if (activePreset === preset.id) {
              onPresetChange(null);
            } else {
              onPresetChange(preset);
            }
          }}
        >
          {preset.icon}
          {preset.label}
        </Button>
      ))}
    </div>
  );
}

export { presets as quickFilterPresets };
