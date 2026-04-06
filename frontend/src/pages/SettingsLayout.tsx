import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Settings, ScanLine, Bell, Plug } from 'lucide-react';

const settingsTabs = [
  { id: 'scan-config', label: 'Scan Config', icon: ScanLine, path: '/dashboard/settings/scan-config' },
  { id: 'notifications', label: 'Notifications', icon: Bell, path: '/dashboard/settings/notifications' },
  { id: 'integrations', label: 'Integrations', icon: Plug, path: '/dashboard/settings/integrations' },
];

const SettingsLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-accent-amber" />
        <h1 className="font-display italic text-2xl text-foreground">Settings</h1>
      </div>

      <div className="flex gap-2 mb-8 border-b border-[hsl(var(--border-default))] pb-3">
        {settingsTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-body transition-colors',
                isActive
                  ? 'bg-brand-primary/10 text-brand-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-sunken'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive && 'text-accent-amber')} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
};

export default SettingsLayout;
