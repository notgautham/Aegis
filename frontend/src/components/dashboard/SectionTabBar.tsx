import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface SectionTab {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
}

interface SectionTabBarProps {
  tabs: SectionTab[];
}

const SectionTabBar = ({ tabs }: SectionTabBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-[hsl(var(--bg-sunken))] w-fit">
      {tabs.map(t => {
        const isActive = currentPath === t.route || location.pathname === t.route;
        return (
          <button
            key={t.id}
            onClick={() => navigate(t.route)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body transition-all",
              isActive
                ? "bg-white shadow-sm text-brand-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

export default SectionTabBar;
