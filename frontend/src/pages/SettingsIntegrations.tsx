import { Badge } from '@/components/ui/badge';
import { Plug, ExternalLink } from 'lucide-react';

interface Integration {
  name: string;
  description: string;
  logo: string;
  status: 'connected' | 'available' | 'coming_soon';
  category: string;
}

const integrations: Integration[] = [
  { name: 'Jira', description: 'Sync remediation actions as Jira tickets', logo: '🎫', status: 'connected', category: 'Project Management' },
  { name: 'Slack', description: 'Real-time alerts and scan notifications', logo: '💬', status: 'connected', category: 'Communication' },
  { name: 'ServiceNow', description: 'ITSM ticket creation and tracking', logo: '🔧', status: 'available', category: 'ITSM' },
  { name: 'Splunk', description: 'Forward scan results to SIEM', logo: '📊', status: 'available', category: 'SIEM' },
  { name: 'Microsoft Sentinel', description: 'Azure SIEM integration', logo: '🛡', status: 'available', category: 'SIEM' },
  { name: 'PagerDuty', description: 'Critical alert escalation', logo: '🚨', status: 'available', category: 'Incident Management' },
  { name: 'Tenable', description: 'Vulnerability data enrichment', logo: '🔍', status: 'coming_soon', category: 'Vulnerability Management' },
  { name: 'CrowdStrike', description: 'Endpoint correlation with crypto posture', logo: '🦅', status: 'coming_soon', category: 'Endpoint' },
];

const statusConfig = {
  connected: { label: 'Connected', className: 'bg-status-safe/10 text-status-safe border-status-safe/20' },
  available: { label: 'Available', className: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20' },
  coming_soon: { label: 'Coming Soon', className: 'bg-muted text-muted-foreground border-border' },
};

const SettingsIntegrations = () => {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display italic text-2xl text-foreground">Integrations</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Connect AEGIS with your existing security and IT tools</p>
      </div>

        <p className="text-xs font-body text-muted-foreground mt-0.5">Manage downstream platform connectors for ticketing, SIEM, and team notifications.</p>
      {/* Connected */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Plug className="w-4 h-4 text-status-safe" />
          <h2 className="font-body font-bold text-sm text-foreground">Active Integrations</h2>
        </div>
        <div className="grid gap-3">
          {integrations.filter(i => i.status === 'connected').map(int => (
            <div key={int.name} className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-sunken flex items-center justify-center text-xl">{int.logo}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-body text-sm font-semibold text-foreground">{int.name}</p>
                    <Badge className={statusConfig[int.status].className}>{statusConfig[int.status].label}</Badge>
                  </div>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">{int.description}</p>
                </div>
              </div>
              <button className="font-body text-xs text-muted-foreground hover:text-foreground border border-[hsl(var(--border-default))] px-3 py-1.5 rounded-lg transition-colors">
                Configure
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Available */}
      <div className="mb-8">
        <h2 className="font-body font-bold text-sm text-foreground mb-4">Available Integrations</h2>
        <div className="grid gap-3">
          {integrations.filter(i => i.status === 'available').map(int => (
            <div key={int.name} className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-sunken flex items-center justify-center text-xl">{int.logo}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-body text-sm font-semibold text-foreground">{int.name}</p>
                    <span className="font-mono text-[10px] text-muted-foreground">{int.category}</span>
                  </div>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">{int.description}</p>
                </div>
              </div>
              <button className="flex items-center gap-1.5 font-body text-xs font-semibold text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-lg hover:bg-brand-primary/20 transition-colors">
                Connect <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Coming Soon */}
      <div>
        <h2 className="font-body font-bold text-sm text-foreground mb-4">Coming Soon</h2>
        <div className="grid gap-3">
          {integrations.filter(i => i.status === 'coming_soon').map(int => (
            <div key={int.name} className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-5 flex items-center justify-between opacity-60">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-sunken flex items-center justify-center text-xl">{int.logo}</div>
                <div>
                  <p className="font-body text-sm font-semibold text-foreground">{int.name}</p>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">{int.description}</p>
                </div>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px]">Coming Soon</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsIntegrations;
