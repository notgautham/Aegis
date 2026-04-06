import { useState } from 'react';
import { useScanContext } from '@/contexts/ScanContext';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Mail, MessageSquare, AlertTriangle, Save } from 'lucide-react';

interface NotificationChannel {
  id: string;
  label: string;
  icon: React.ElementType;
  enabled: boolean;
  target: string;
}

const SettingsNotifications = () => {
  const { rootDomain } = useScanContext();
  const d = rootDomain || 'target.com';
  const [channels, setChannels] = useState<NotificationChannel[]>([
    { id: 'email', label: 'Email', icon: Mail, enabled: true, target: `admin@${d}` },
    { id: 'slack', label: 'Slack', icon: MessageSquare, enabled: true, target: '#aegis-alerts' },
    { id: 'webhook', label: 'Webhook', icon: Bell, enabled: false, target: `https://hooks.${d}/aegis` },
  ]);

  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [scanComplete, setScanComplete] = useState(true);
  const [certExpiry, setCertExpiry] = useState(true);
  const [certExpiryDays, setCertExpiryDays] = useState('30');
  const [shadowItAlert, setShadowItAlert] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  const toggleChannel = (id: string) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display italic text-2xl text-foreground">Notifications</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Configure alerts and notification channels</p>
        </div>
        <button className="flex items-center gap-2 font-body text-sm font-semibold bg-accent-amber text-brand-primary px-4 py-2 rounded-lg hover:brightness-110 transition-all">
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>

      <div className="space-y-6">
        {/* Channels */}
        <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-accent-amber" />
            <h2 className="font-body font-bold text-sm text-foreground">Notification Channels</h2>
          </div>
          <div className="space-y-4">
            {channels.map(ch => {
              const Icon = ch.icon;
              return (
                <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg bg-sunken/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium text-foreground">{ch.label}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{ch.target}</p>
                    </div>
                  </div>
                  <Switch checked={ch.enabled} onCheckedChange={() => toggleChannel(ch.id)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Alert Types */}
        <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-accent-amber" />
            <h2 className="font-body font-bold text-sm text-foreground">Alert Types</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm text-foreground">Critical Vulnerabilities</p>
                <p className="font-body text-xs text-muted-foreground">Immediate alert when P1 findings detected</p>
              </div>
              <Switch checked={criticalAlerts} onCheckedChange={setCriticalAlerts} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm text-foreground">Scan Completion</p>
                <p className="font-body text-xs text-muted-foreground">Notify when scheduled scans finish</p>
              </div>
              <Switch checked={scanComplete} onCheckedChange={setScanComplete} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-body text-sm text-foreground">Certificate Expiry Warning</p>
                <p className="font-body text-xs text-muted-foreground">Alert before SSL certificates expire</p>
              </div>
              <div className="flex items-center gap-3">
                {certExpiry && (
                  <Select value={certExpiryDays} onValueChange={setCertExpiryDays}>
                    <SelectTrigger className="w-28 font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Switch checked={certExpiry} onCheckedChange={setCertExpiry} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm text-foreground">Shadow IT Discovery</p>
                <p className="font-body text-xs text-muted-foreground">Alert when unknown assets are detected</p>
              </div>
              <Switch checked={shadowItAlert} onCheckedChange={setShadowItAlert} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm text-foreground">Weekly Digest</p>
                <p className="font-body text-xs text-muted-foreground">Summary of all findings and changes</p>
              </div>
              <Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsNotifications;
