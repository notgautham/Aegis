import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, AlertTriangle, ArrowUpRight, Filter, ClipboardList, Sparkles, Map } from 'lucide-react';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import IntelligencePanel from '@/components/dashboard/IntelligencePanel';
import { useScanContext } from '@/contexts/ScanContext';
import { addDays, format, differenceInDays } from 'date-fns';

const remediationTabs = [
  { id: 'action-plan', label: 'Action Plan', icon: ClipboardList, route: '/dashboard/remediation/action-plan' },
  { id: 'ai-patch', label: 'AI Patch Generator', icon: Sparkles, route: '/dashboard/remediation/ai-patch' },
  { id: 'roadmap', label: 'Migration Roadmap', icon: Map, route: '/dashboard/remediation/roadmap' },
];

const priorityColor: Record<string, string> = {
  P1: 'bg-status-critical text-white',
  P2: 'bg-status-vuln text-white',
  P3: 'bg-status-warn text-white',
  P4: 'bg-status-safe text-white',
};

const statusIcon: Record<string, React.ReactNode> = {
  not_started: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
  in_progress: <ArrowUpRight className="w-3.5 h-3.5 text-status-warn" />,
  done: <CheckCircle2 className="w-3.5 h-3.5 text-status-safe" />,
  verified: <CheckCircle2 className="w-3.5 h-3.5 text-brand-accent" />,
};

const effortLabel: Record<string, string> = {
  low: '~1 hr',
  medium: '~4 hrs',
  high: '~2 wks',
};

const priorityDays: Record<string, number> = { P1: 30, P2: 90, P3: 180, P4: 365 };
const defaultAssignee: Record<string, string> = { P1: 'IT Security', P2: 'DevOps', P3: 'Infrastructure', P4: 'Infrastructure' };
const assigneeOptions = ['IT Security', 'DevOps', 'Infrastructure', 'Compliance'];

const RemediationActionPlan = () => {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const { rootDomain } = useScanContext();
  const { selectedAssets } = useSelectedScan();
  const now = new Date();

  const allActions = selectedAssets.flatMap(asset =>
    asset.remediation.map((r, i) => ({
      ...r,
      assetDomain: asset.domain,
      assetType: asset.type,
      qScore: asset.qScore,
      key: `${asset.id}-${i}`,
      deadline: addDays(now, priorityDays[r.priority]),
      assignee: defaultAssignee[r.priority],
    }))
  );

  const [assignees, setAssignees] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    allActions.forEach(a => { map[a.key] = a.assignee; });
    return map;
  });

  const filtered = filterPriority === 'all' ? allActions : allActions.filter(a => a.priority === filterPriority);

  const totalActions = allActions.length;
  const completedActions = allActions.filter(a => a.status === 'done' || a.status === 'verified').length;
  const p1Count = allActions.filter(a => a.priority === 'P1').length;
  const inProgressCount = allActions.filter(a => a.status === 'in_progress').length;

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">Remediation Action Plan</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Prioritized actions for {rootDomain || 'target'} quantum readiness</p>
      </div>
      <SectionTabBar tabs={remediationTabs} />
      {(() => {
        const p1NotStarted = allActions.filter(a => a.priority === 'P1' && a.status === 'not_started').length;
        const assetsWithP1 = new Set(allActions.filter(a => a.priority === 'P1' && a.status === 'not_started').map(a => a.assetDomain)).size;
        return p1NotStarted > 0 ? (
          <p className="text-xs font-body text-muted-foreground italic">
            Active remediation backlog: {p1NotStarted} P1 critical items requiring action within 30 days across {assetsWithP1} asset{assetsWithP1 !== 1 ? 's' : ''}.
          </p>
        ) : null;
      })()}

      <IntelligencePanel assets={selectedAssets} collapsed />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Actions', value: totalActions, sub: 'across all assets', color: 'text-foreground' },
          { label: 'P1 Critical', value: p1Count, sub: 'require immediate action', color: 'text-status-critical' },
          { label: 'In Progress', value: inProgressCount, sub: 'currently being addressed', color: 'text-status-warn' },
          { label: 'Completed', value: completedActions, sub: `${totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0}% completion rate`, color: 'text-status-safe' },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-surface border-border">
            <CardContent className="pt-4 pb-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
              <p className={`font-body text-2xl font-bold ${kpi.color} mt-1`}>{kpi.value}</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-surface border-border">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-muted-foreground">OVERALL REMEDIATION PROGRESS</span>
            <span className="font-mono text-xs text-foreground font-bold">{totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0}%</span>
          </div>
          <Progress value={totalActions > 0 ? (completedActions / totalActions) * 100 : 0} className="h-2" />
        </CardContent>
      </Card>

      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-body text-base">Action Items</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="P1">P1 Only</SelectItem>
                  <SelectItem value="P2">P2 Only</SelectItem>
                  <SelectItem value="P3">P3 Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="font-mono text-[10px]">PRIORITY</TableHead>
                <TableHead className="font-mono text-[10px]">ASSET</TableHead>
                <TableHead className="font-mono text-[10px]">FINDING</TableHead>
                <TableHead className="font-mono text-[10px]">ACTION</TableHead>
                <TableHead className="font-mono text-[10px]">EFFORT</TableHead>
                <TableHead className="font-mono text-[10px]">DEADLINE</TableHead>
                <TableHead className="font-mono text-[10px]">ASSIGNEE</TableHead>
                <TableHead className="font-mono text-[10px]">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((action) => {
                const daysLeft = differenceInDays(action.deadline, now);
                return (
                  <TableRow key={action.key} className="border-border hover:bg-sunken/50">
                    <TableCell><Badge className={`${priorityColor[action.priority]} text-[10px] font-mono`}>{action.priority}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{action.assetDomain}</TableCell>
                    <TableCell className="font-body text-xs max-w-[200px]">
                      <div className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-status-warn flex-shrink-0" />{action.finding}</div>
                    </TableCell>
                    <TableCell className="font-body text-xs max-w-[250px]">{action.action}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{effortLabel[action.effort]}</TableCell>
                    <TableCell>
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${daysLeft <= 14 ? 'text-[hsl(var(--status-critical))] bg-[hsl(var(--status-critical)/0.1)]' : daysLeft <= 30 ? 'text-[hsl(var(--accent-amber))] bg-[hsl(var(--accent-amber)/0.1)]' : 'text-muted-foreground bg-[hsl(var(--bg-sunken))]'}`}>
                        In {daysLeft}d
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select value={assignees[action.key] || action.assignee} onValueChange={(v) => setAssignees(prev => ({ ...prev, [action.key]: v }))}>
                        <SelectTrigger className="h-6 w-28 text-[10px] border-none bg-transparent p-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{assigneeOptions.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {statusIcon[action.status]}
                        <span className="font-mono text-[10px] capitalize">{action.status.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default RemediationActionPlan;