import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Shield, Clock, Globe, Zap, Save } from 'lucide-react';

const SettingsScanConfig = () => {
  const [autoScan, setAutoScan] = useState(true);
  const [frequency, setFrequency] = useState('daily');
  const [depth, setDepth] = useState([3]);
  const [tlsProbe, setTlsProbe] = useState(true);
  const [pqcCheck, setPqcCheck] = useState(true);
  const [cbomGen, setCbomGen] = useState(true);
  const [shadowIt, setShadowIt] = useState(true);
  const [timeout, setTimeout] = useState('30');

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display italic text-2xl text-foreground">Scan Configuration</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Configure how AEGIS scans your infrastructure</p>
        </div>
        <button className="flex items-center gap-2 font-body text-sm font-semibold bg-accent-amber text-brand-primary px-4 py-2 rounded-lg hover:brightness-110 transition-all">
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>

      <div className="space-y-6">
        {/* Scheduling */}
        <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-accent-amber" />
            <h2 className="font-body font-bold text-sm text-foreground">Scheduling</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm text-foreground">Automatic Scanning</p>
                <p className="font-body text-xs text-muted-foreground">Run scans on a recurring schedule</p>
              </div>
              <Switch checked={autoScan} onCheckedChange={setAutoScan} />
            </div>
            {autoScan && (
              <div className="flex items-center justify-between">
                <p className="font-body text-sm text-foreground">Scan Frequency</p>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="w-40 font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Every Hour</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="font-body text-sm text-foreground">Connection Timeout</p>
              <Select value={timeout} onValueChange={setTimeout}>
                <SelectTrigger className="w-40 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="120">120 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Scan Modules */}
        <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-accent-amber" />
            <h2 className="font-body font-bold text-sm text-foreground">Scan Modules</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'TLS/SSL Probing', desc: 'Protocol versions, cipher suites, certificate analysis', checked: tlsProbe, onChange: setTlsProbe },
              { label: 'PQC Readiness Check', desc: 'Post-quantum cryptography support assessment', checked: pqcCheck, onChange: setPqcCheck },
              { label: 'CBOM Generation', desc: 'Cryptographic Bill of Materials extraction', checked: cbomGen, onChange: setCbomGen },
              { label: 'Shadow IT Detection', desc: 'Certificate transparency & OSINT discovery', checked: shadowIt, onChange: setShadowIt },
            ].map(mod => (
              <div key={mod.label} className="flex items-center justify-between">
                <div>
                  <p className="font-body text-sm text-foreground">{mod.label}</p>
                  <p className="font-body text-xs text-muted-foreground">{mod.desc}</p>
                </div>
                <Switch checked={mod.checked} onCheckedChange={mod.onChange} />
              </div>
            ))}
          </div>
        </div>

        {/* Discovery Depth */}
        <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-accent-amber" />
            <h2 className="font-body font-bold text-sm text-foreground">Discovery Depth</h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-body text-sm text-foreground">Subdomain Enumeration Depth</p>
                <Badge variant="secondary" className="font-mono text-xs">Level {depth[0]}</Badge>
              </div>
              <Slider value={depth} onValueChange={setDepth} min={1} max={5} step={1} className="w-full" />
              <div className="flex justify-between mt-1">
                <span className="font-mono text-[10px] text-muted-foreground">Shallow</span>
                <span className="font-mono text-[10px] text-muted-foreground">Deep</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-accent-amber" />
            <h2 className="font-body font-bold text-sm text-foreground">Performance</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-body text-sm text-foreground">Max Concurrent Connections</p>
              <Select defaultValue="10">
                <SelectTrigger className="w-40 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 threads</SelectItem>
                  <SelectItem value="10">10 threads</SelectItem>
                  <SelectItem value="20">20 threads</SelectItem>
                  <SelectItem value="50">50 threads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <p className="font-body text-sm text-foreground">Rate Limit</p>
              <Select defaultValue="100">
                <SelectTrigger className="w-40 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 req/min</SelectItem>
                  <SelectItem value="100">100 req/min</SelectItem>
                  <SelectItem value="200">200 req/min</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsScanConfig;
