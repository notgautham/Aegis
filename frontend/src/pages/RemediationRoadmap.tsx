import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, Clock, ArrowRight, ClipboardList, Sparkles, Map } from 'lucide-react';
import { useScanContext } from '@/contexts/ScanContext';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { addMonths, format } from 'date-fns';

const remediationTabs = [
  { id: 'action-plan', label: 'Action Plan', icon: ClipboardList, route: '/dashboard/remediation/action-plan' },
  { id: 'patch', label: 'Patch Generator', icon: Sparkles, route: '/dashboard/remediation/patch' },
  { id: 'roadmap', label: 'Migration Roadmap', icon: Map, route: '/dashboard/remediation/roadmap' },
];

type PhaseStatus = 'completed' | 'in_progress' | 'upcoming';
type TaskStatus = 'done' | 'in_progress' | 'pending';

interface TaskItem {
  task: string;
  status: TaskStatus;
}

interface Phase {
  id: number;
  name: string;
  timeline: string;
  status: PhaseStatus;
  progress: number;
  tasks: TaskItem[];
}

const statusColors: Record<PhaseStatus, string> = {
  completed: 'bg-status-safe text-white',
  in_progress: 'bg-status-warn text-white',
  upcoming: 'bg-muted text-muted-foreground',
};

const taskIcon: Record<TaskStatus, React.ReactNode> = {
  done: <CheckCircle2 className="w-3.5 h-3.5 text-status-safe flex-shrink-0" />,
  in_progress: <Clock className="w-3.5 h-3.5 text-status-warn flex-shrink-0" />,
  pending: <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />,
};

const effortWeights: Record<string, number> = { low: 4, medium: 16, high: 80 };

function deriveStatusFromCoverage(count: number, total: number): TaskStatus {
  if (total === 0) return 'pending';
  if (count >= total) return 'done';
  if (count > 0) return 'in_progress';
  return 'pending';
}

function deriveStatusFromActions(statuses: string[], fallbackDone: boolean): TaskStatus {
  if (statuses.length === 0) return fallbackDone ? 'done' : 'pending';
  if (statuses.every((status) => status === 'done' || status === 'verified')) return 'done';
  if (statuses.some((status) => status === 'in_progress' || status === 'done' || status === 'verified')) return 'in_progress';
  return 'pending';
}

function phaseProgress(tasks: TaskItem[]): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, task) => (
    sum + (task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 0)
  ), 0);
  return Math.round(total / tasks.length);
}

function phaseStatus(progress: number): PhaseStatus {
  if (progress >= 100) return 'completed';
  if (progress > 0) return 'in_progress';
  return 'upcoming';
}

const RemediationRoadmap = () => {
  const { rootDomain } = useScanContext();
  const { selectedAssets, selectedAssetResults, selectedScanResults } = useSelectedScan();
  const [teamSize, setTeamSize] = useState(4);
  const [hoursPerWeek, setHoursPerWeek] = useState('10');

  const targetLabel = selectedScanResults?.target ?? rootDomain ?? selectedAssets[0]?.domain ?? 'target';
  const baselineDate = selectedScanResults?.created_at ? new Date(selectedScanResults.created_at) : new Date();

  const rawActions = selectedAssetResults.flatMap((asset) => asset.remediation_actions.map((action) => ({
    ...action,
    assetId: asset.asset_id,
  })));

  const actionStatusesFor = (predicate: (action: typeof rawActions[number]) => boolean) => rawActions.filter(predicate).map((action) => action.status ?? 'not_started');
  const openActions = rawActions.filter((action) => action.status !== 'done' && action.status !== 'verified');

  const totalAssets = selectedAssets.length;
  const assessedCount = selectedAssetResults.filter((asset) => asset.assessment).length;
  const cbomCount = selectedAssetResults.filter((asset) => asset.cbom).length;
  const remediationBundleCount = selectedAssetResults.filter((asset) => asset.remediation).length;
  const certificateCount = selectedAssetResults.filter((asset) => asset.certificate).length;
  const hndlCount = selectedAssetResults.filter((asset) => asset.remediation?.hndl_timeline?.entries?.length).length;
  const pqcReadyCount = selectedAssets.filter((asset) =>
    asset.status === 'elite-pqc' ||
    asset.status === 'transitioning' ||
    asset.status === 'safe' ||
    asset.complianceTier === 'PQC_TRANSITIONING'
  ).length;
  const eliteCount = selectedAssets.filter((asset) => asset.status === 'elite-pqc').length;
  const criticalCount = selectedAssets.filter((asset) => asset.tier === 'critical').length;
  const openHighPriorityCount = openActions.filter((action) => action.priority === 'P1' || action.priority === 'P2').length;

  const phases: Phase[] = useMemo(() => {
    const discoveryTasks: TaskItem[] = [
      { task: 'Asset inventory captured', status: totalAssets > 0 ? 'done' : 'pending' },
      { task: 'Risk assessments completed', status: deriveStatusFromCoverage(assessedCount, totalAssets) },
      { task: 'CBOM evidence generated', status: deriveStatusFromCoverage(cbomCount, totalAssets) },
      { task: 'Remediation backlog generated', status: remediationBundleCount > 0 || rawActions.length > 0 ? 'done' : totalAssets > 0 ? 'in_progress' : 'pending' },
    ];

    const quickWinTasks: TaskItem[] = [
      { task: 'Remove legacy TLS exposure', status: deriveStatusFromActions(actionStatusesFor((action) => action.category === 'tls_version'), selectedAssets.every((asset) => asset.tls.includes('1.3'))) },
      { task: 'Strengthen certificate posture', status: deriveStatusFromActions(actionStatusesFor((action) => action.category === 'certificate'), true) },
      { task: 'Address low-effort remediation wins', status: deriveStatusFromActions(actionStatusesFor((action) => (action.priority === 'P1' || action.priority === 'P2') && action.effort !== 'high'), openActions.every((action) => action.effort === 'high')) },
      { task: 'Shrink the 90-day critical backlog', status: openHighPriorityCount === 0 ? 'done' : openHighPriorityCount < rawActions.length ? 'in_progress' : 'pending' },
    ];

    const hybridTasks: TaskItem[] = [
      { task: 'Introduce hybrid or PQC key exchange', status: deriveStatusFromActions(actionStatusesFor((action) => action.category === 'key_exchange'), pqcReadyCount > 0) },
      { task: 'Expand PQC-ready coverage', status: pqcReadyCount >= totalAssets && totalAssets > 0 ? 'done' : pqcReadyCount > 0 ? 'in_progress' : 'pending' },
      { task: 'Validate remediation bundles on transitioned assets', status: remediationBundleCount >= pqcReadyCount && pqcReadyCount > 0 ? 'done' : remediationBundleCount > 0 ? 'in_progress' : 'pending' },
      { task: 'Standardize strong cipher and protocol posture', status: criticalCount === 0 ? 'done' : criticalCount < totalAssets ? 'in_progress' : 'pending' },
    ];

    const migrationTasks: TaskItem[] = [
      { task: 'Replace remaining vulnerable signatures', status: deriveStatusFromActions(actionStatusesFor((action) => action.category === 'certificate'), eliteCount > 0) },
      { task: 'Eliminate critical assets', status: criticalCount === 0 && totalAssets > 0 ? 'done' : criticalCount < totalAssets ? 'in_progress' : 'pending' },
      { task: 'Move portfolio majority into PQC transition or better', status: pqcReadyCount >= Math.ceil(Math.max(totalAssets, 1) / 2) && totalAssets > 0 ? 'done' : pqcReadyCount > 0 ? 'in_progress' : 'pending' },
      { task: 'Reduce residual backlog to low-priority work', status: openHighPriorityCount === 0 && openActions.length > 0 ? 'done' : openActions.length < rawActions.length ? 'in_progress' : 'pending' },
    ];

    const validationTasks: TaskItem[] = [
      { task: 'Issue compliance certificates', status: deriveStatusFromCoverage(certificateCount, totalAssets) },
      { task: 'Preserve CBOM evidence package', status: deriveStatusFromCoverage(cbomCount, totalAssets) },
      { task: 'Verify HNDL intelligence coverage', status: deriveStatusFromCoverage(hndlCount, totalAssets) },
      { task: 'Reach fully quantum safe posture', status: eliteCount >= totalAssets && totalAssets > 0 ? 'done' : eliteCount > 0 ? 'in_progress' : 'pending' },
    ];

    const draftPhases = [
      { id: 1, name: 'Discovery & Assessment', timeline: `${format(baselineDate, 'MMM yyyy')} baseline`, tasks: discoveryTasks },
      { id: 2, name: 'Quick Wins - TLS Hardening', timeline: `${format(baselineDate, 'MMM yyyy')} - ${format(addMonths(baselineDate, 2), 'MMM yyyy')}`, tasks: quickWinTasks },
      { id: 3, name: 'PQC Hybrid Deployment', timeline: `${format(addMonths(baselineDate, 3), 'MMM yyyy')} - ${format(addMonths(baselineDate, 8), 'MMM yyyy')}`, tasks: hybridTasks },
      { id: 4, name: 'Full PQC Migration', timeline: `${format(addMonths(baselineDate, 9), 'MMM yyyy')} - ${format(addMonths(baselineDate, 15), 'MMM yyyy')}`, tasks: migrationTasks },
      { id: 5, name: 'Validation & Certification', timeline: `${format(addMonths(baselineDate, 16), 'MMM yyyy')} - ${format(addMonths(baselineDate, 18), 'MMM yyyy')}`, tasks: validationTasks },
    ];

    return draftPhases.map((phase) => {
      const progress = phaseProgress(phase.tasks);
      return {
        ...phase,
        progress,
        status: phaseStatus(progress),
      };
    });
  }, [assessedCount, baselineDate, cbomCount, certificateCount, criticalCount, eliteCount, hndlCount, openActions, openHighPriorityCount, pqcReadyCount, rawActions, remediationBundleCount, selectedAssets, totalAssets]);

  const overallProgress = Math.round(phases.reduce((sum, phase) => sum + phase.progress, 0) / Math.max(phases.length, 1));

  const quickWinsMatrix = useMemo(() => {
    const uniqueLabels = (items: typeof rawActions) => [...new Set(items.map((item) => item.action))].slice(0, 4);
    return {
      'Quick Wins': { bg: 'bg-[hsl(var(--status-safe)/0.08)]', border: 'border-[hsl(var(--status-safe)/0.2)]', items: uniqueLabels(openActions.filter((action) => (action.priority === 'P1' || action.priority === 'P2') && action.effort !== 'high')) },
      'Hard - High Impact': { bg: 'bg-[hsl(210,70%,50%,0.08)]', border: 'border-[hsl(210,70%,50%,0.2)]', items: uniqueLabels(openActions.filter((action) => (action.priority === 'P1' || action.priority === 'P2') && action.effort === 'high')) },
      'Low Hanging Fruit': { bg: 'bg-[hsl(var(--accent-amber)/0.08)]', border: 'border-[hsl(var(--accent-amber)/0.2)]', items: uniqueLabels(openActions.filter((action) => (action.priority === 'P3' || action.priority === 'P4') && action.effort !== 'high')) },
      'Avoid': { bg: 'bg-[hsl(var(--status-critical)/0.05)]', border: 'border-[hsl(var(--status-critical)/0.15)]', items: uniqueLabels(openActions.filter((action) => (action.priority === 'P3' || action.priority === 'P4') && action.effort === 'high')) },
    };
  }, [openActions]);

  const estimatedTotalHours = openActions.reduce((sum, action) => sum + (effortWeights[action.effort ?? 'medium'] ?? effortWeights.medium), 0);
  const monthlyCapacity = Math.max(1, teamSize * parseInt(hoursPerWeek, 10) * 4);
  const estimatedMonths = Math.max(1, Math.ceil(estimatedTotalHours / monthlyCapacity));
  const estCompletion = format(addMonths(new Date(), estimatedMonths), 'MMM yyyy');

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">Migration Roadmap</h1>
        <p className="text-xs font-body text-muted-foreground mt-0.5">Sequenced migration phases from immediate hardening to full post-quantum rollout.</p>
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
            <span className="font-body text-xs text-muted-foreground">Estimated validation horizon: {phases[phases.length - 1]?.timeline ?? '-'}</span>
            <span className="font-body text-xs text-muted-foreground">{phases.filter((phase) => phase.status === 'completed').length} of {phases.length} phases complete</span>
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
        {phases.map((phase, index) => (
          <motion.div key={phase.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
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
                  {phase.tasks.map((task, taskIndex) => (
                    <div key={taskIndex} className="flex items-center gap-2.5">{taskIcon[task.status]}<span className={`font-body text-xs ${task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.task}</span></div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {index < phases.length - 1 && <div className="flex justify-center py-1"><ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" /></div>}
          </motion.div>
        ))}
      </div>

      <Card className="bg-surface border-border">
        <CardHeader className="pb-2">
          <CardTitle className="font-body text-base">Effort vs. Impact Matrix</CardTitle>
          <p className="font-body text-xs text-muted-foreground">This matrix is derived from the current remediation backlog for the selected scan.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(quickWinsMatrix).map(([label, { bg, border, items }]) => (
              <div key={label} className={`p-4 rounded-lg ${bg} border ${border}`}>
                <p className="font-body text-xs font-semibold mb-2">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.length > 0 ? items.map((item) => (
                    <span key={item} className="font-mono text-[10px] px-2 py-1 rounded-full bg-background/50 text-foreground">{item}</span>
                  )) : <span className="font-body text-[10px] text-muted-foreground">No current items</span>}
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
              <Input type="number" value={teamSize} onChange={(e) => setTeamSize(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-24 h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground">Hours per week</label>
              <Select value={hoursPerWeek} onValueChange={setHoursPerWeek}>
                <SelectTrigger className="w-24 h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 30, 40].map((hours) => <SelectItem key={hours} value={String(hours)}>{hours}h</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="font-body text-xs text-muted-foreground">Est. backlog completion</label>
              <div className="h-8 flex items-center px-3 rounded-md bg-[hsl(var(--bg-sunken))] font-mono text-sm font-bold text-foreground mt-1">{estCompletion}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RemediationRoadmap;
