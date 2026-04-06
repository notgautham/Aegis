import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, Clock, ArrowRight, ClipboardList, Sparkles, Map } from 'lucide-react';
import { useScanContext } from '@/contexts/ScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { addMonths, format } from 'date-fns';

const remediationTabs = [
  { id: 'action-plan', label: 'Action Plan', icon: ClipboardList, route: '/dashboard/remediation/action-plan' },
  { id: 'ai-patch', label: 'AI Patch Generator', icon: Sparkles, route: '/dashboard/remediation/ai-patch' },
  { id: 'roadmap', label: 'Migration Roadmap', icon: Map, route: '/dashboard/remediation/roadmap' },
];

interface Phase {
  id: number; name: string; timeline: string; status: 'completed' | 'in_progress' | 'upcoming'; progress: number;
  tasks: { task: string; status: 'done' | 'in_progress' | 'pending' }[];
}

const phases: Phase[] = [
  { id: 1, name: 'Discovery & Assessment', timeline: 'Jan 2026 – Mar 2026', status: 'completed', progress: 100,
    tasks: [{ task: 'Complete asset inventory scan', status: 'done' }, { task: 'Generate CBOM', status: 'done' }, { task: 'HNDL risk assessment', status: 'done' }, { task: 'Quantum Debt baseline', status: 'done' }] },
  { id: 2, name: 'Quick Wins — TLS Hardening', timeline: 'Apr 2026 – Jun 2026', status: 'in_progress', progress: 35,
    tasks: [{ task: 'Disable TLS 1.0/1.1', status: 'in_progress' }, { task: 'Replace RSA key exchange', status: 'in_progress' }, { task: 'Enable HSTS', status: 'pending' }, { task: 'Upgrade certificates', status: 'pending' }] },
  { id: 3, name: 'PQC Hybrid Deployment', timeline: 'Jul 2026 – Dec 2026', status: 'upcoming', progress: 0,
    tasks: [{ task: 'Deploy OQS-OpenSSL 3.2+', status: 'pending' }, { task: 'Enable ML-KEM-768', status: 'pending' }, { task: 'Test PQC compatibility', status: 'pending' }, { task: 'Update SWIFT gateway', status: 'pending' }] },
  { id: 4, name: 'Full PQC Migration', timeline: 'Jan 2027 – Jun 2027', status: 'upcoming', progress: 0,
    tasks: [{ task: 'Replace RSA-2048 with ML-DSA-65', status: 'pending' }, { task: 'Migrate VPN gateways', status: 'pending' }, { task: 'Deploy SLH-DSA code signing', status: 'pending' }, { task: 'All APIs to TLS 1.3 + PQC', status: 'pending' }] },
  { id: 5, name: 'Validation & Certification', timeline: 'Jul 2027 – Sep 2027', status: 'upcoming', progress: 0,
    tasks: [{ task: 'Third-party quantum audit', status: 'pending' }, { task: 'NIST FIPS compliance', status: 'pending' }, { task: 'Achieve Q-Score 900+', status: 'pending' }, { task: 'Publish attestation', status: 'pending' }] },
];

const statusColors: Record<string, string> = { completed: 'bg-status-safe text-white', in_progress: 'bg-status-warn text-white', upcoming: 'bg-muted text-muted-foreground' };
const taskIcon: Record<string, React.ReactNode> = {
  done: <CheckCircle2 className="w-3.5 h-3.5 text-status-safe flex-shrink-0" />,
  in_progress: <Clock className="w-3.5 h-3.5 text-status-warn flex-shrink-0" />,
  pending: <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />,
};

const quickWinsMatrix = {
  'Quick Wins': { bg: 'bg-[hsl(var(--status-safe)/0.08)]', border: 'border-[hsl(var(--status-safe)/0.2)]', items: ['Disable TLS 1.0/1.1', 'Enable HSTS', 'Renew expiring certificates'] },
  'Hard — High Impact': { bg: 'bg-[hsl(210,70%,50%,0.08)]', border: 'border-[hsl(210,70%,50%,0.2)]', items: ['Deploy ML-KEM-768 key exchange', 'Replace RSA certificates with ML-DSA-65'] },
  'Low Hanging Fruit': { bg: 'bg-[hsl(var(--accent-amber)/0.08)]', border: 'border-[hsl(var(--accent-amber)/0.2)]', items: ['Update cipher suite order', 'Enable OCSP stapling'] },
  'Avoid': { bg: 'bg-[hsl(var(--status-critical)/0.05)]', border: 'border-[hsl(var(--status-critical)/0.15)]', items: ['Migrate legacy mainframe integrations'] },
};

const RemediationRoadmap = () => {
  const { rootDomain } = useScanContext();
  const overallProgress = Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / phases.length);
  const [teamSize, setTeamSize] = useState(4);
  const [hoursPerWeek, setHoursPerWeek] = useState('10');

  const estCompletion = useMemo(() => {
    const baseMonths = 18;
    const adjusted = baseMonths * (40 / (teamSize * parseInt(hoursPerWeek)));
    return format(addMonths(new Date(), Math.round(adjusted)), 'MMM yyyy');
  }, [teamSize, hoursPerWeek]);

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">Migration Roadmap</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">5-phase quantum-safe migration plan for {rootDomain || 'target'} infrastructure</p>
      </div>
      <SectionTabBar tabs={remediationTabs} />

      <Card className="bg-surface border-border">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">OVERALL MIGRATION PROGRESS</span>
            <span className="font-mono text-sm font-bold text-foreground">{overallProgress}%</span>
          </div>
          <div className="h-3 bg-sunken rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-status-safe to-accent-amber rounded-full" initial={{ width: 0 }} animate={{ width: `${overallProgress}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-body text-xs text-muted-foreground">Target: Sep 2027</span>
            <span className="font-body text-xs text-muted-foreground">{phases.filter(p => p.status === 'completed').length} of {phases.length} phases complete</span>
          </div>
        </CardContent>
      </Card>

      <div className="hidden lg:block">
        <Card className="bg-surface border-border">
          <CardHeader className="pb-2"><CardTitle className="font-body text-base">Timeline View</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {phases.map((phase) => (
                <div key={phase.id} className="flex items-center gap-4">
                  <div className="w-48 flex-shrink-0">
                    <p className="font-body text-xs font-medium text-foreground truncate">{phase.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{phase.timeline}</p>
                  </div>
                  <div className="flex-1 h-8 bg-sunken rounded-lg overflow-hidden relative">
                    <motion.div className={`h-full rounded-lg ${phase.status === 'completed' ? 'bg-status-safe/80' : phase.status === 'in_progress' ? 'bg-status-warn/80' : 'bg-muted-foreground/20'}`} initial={{ width: 0 }} animate={{ width: `${Math.max(phase.progress, 5)}%` }} transition={{ duration: 0.8, delay: phase.id * 0.1 }} />
                    <span className="absolute inset-0 flex items-center px-3 font-mono text-[10px] text-foreground">{phase.progress}%</span>
                  </div>
                  <Badge className={`${statusColors[phase.status]} text-[10px] font-mono flex-shrink-0 capitalize`}>{phase.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {phases.map((phase, idx) => (
          <motion.div key={phase.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
            <Card className="bg-surface border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm font-bold ${phase.status === 'completed' ? 'bg-status-safe/10 text-status-safe' : phase.status === 'in_progress' ? 'bg-status-warn/10 text-status-warn' : 'bg-muted text-muted-foreground'}`}>{phase.id}</div>
                    <div><CardTitle className="font-body text-sm">{phase.name}</CardTitle><p className="font-mono text-[10px] text-muted-foreground">{phase.timeline}</p></div>
                  </div>
                  <Badge className={`${statusColors[phase.status]} text-[10px] font-mono capitalize`}>{phase.status.replace('_', ' ')}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {phase.tasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2.5">{taskIcon[t.status]}<span className={`font-body text-xs ${t.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{t.task}</span></div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {idx < phases.length - 1 && <div className="flex justify-center py-1"><ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" /></div>}
          </motion.div>
        ))}
      </div>

      <Card className="bg-surface border-border">
        <CardHeader className="pb-2">
          <CardTitle className="font-body text-base">Effort vs. Impact Matrix</CardTitle>
          <p className="font-body text-xs text-muted-foreground">Focus on the bottom-right quadrant first — high impact changes that require minimal effort.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(quickWinsMatrix).map(([label, { bg, border, items }]) => (
              <div key={label} className={`p-4 rounded-lg ${bg} border ${border}`}>
                <p className="font-body text-xs font-semibold mb-2">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(item => (
                    <span key={item} className="font-mono text-[10px] px-2 py-1 rounded-full bg-background/50 text-foreground">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface border-border">
        <CardHeader className="pb-2"><CardTitle className="font-body text-base">Resource Estimator</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div>
              <label className="font-body text-xs text-muted-foreground">Team Size (engineers)</label>
              <Input type="number" value={teamSize} onChange={(e) => setTeamSize(Math.max(1, parseInt(e.target.value) || 1))} className="w-24 h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Hours per week</label>
              <Select value={hoursPerWeek} onValueChange={setHoursPerWeek}>
                <SelectTrigger className="w-24 h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 30, 40].map(h => <SelectItem key={h} value={String(h)}>{h}h</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="font-body text-xs text-muted-foreground">Est. Phase 4 completion</label>
              <div className="h-8 flex items-center px-3 rounded-md bg-[hsl(var(--bg-sunken))] font-mono text-sm font-bold text-foreground mt-1">{estCompletion}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RemediationRoadmap;
