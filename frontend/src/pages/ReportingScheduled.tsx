import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, Mail, Calendar, Trash2, Plus, CheckCircle2, TrendingUp, PenTool } from 'lucide-react';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { useSelectedScan } from '@/contexts/SelectedScanContext';

const reportingTabs = [
  { id: 'executive', label: 'Executive Reports', icon: TrendingUp, route: '/dashboard/reporting/executive' },
  { id: 'scheduled', label: 'Scheduled Reports', icon: Clock, route: '/dashboard/reporting/scheduled' },
  { id: 'on-demand', label: 'On-Demand Builder', icon: PenTool, route: '/dashboard/reporting/on-demand' },
];

interface ScheduledReport {
  id: string;
  name: string;
  template: string;
  frequency: string;
  nextRun: string;
  recipients: string[];
  enabled: boolean;
}

function buildSchedules(target: string): ScheduledReport[] {
  const normalized = target && target.includes('.') ? target : `${target || 'target'}.com`;
  return [
    { id: 's1', name: 'Weekly Executive Summary', template: 'Executive Summary', frequency: 'Weekly', nextRun: '2026-04-14', recipients: [`ciso@${normalized}`, `cto@${normalized}`], enabled: true },
    { id: 's2', name: 'Monthly NIST Compliance', template: 'NIST Compliance Report', frequency: 'Monthly', nextRun: '2026-04-30', recipients: [`compliance@${normalized}`], enabled: true },
    { id: 's3', name: 'Daily Risk Alert', template: 'Quantum Risk Assessment', frequency: 'Daily', nextRun: '2026-04-10', recipients: [`soc@${normalized}`], enabled: false },
    { id: 's4', name: 'Bi-Weekly CBOM Export', template: 'CBOM Inventory Report', frequency: 'Bi-Weekly', nextRun: '2026-04-22', recipients: [`audit@${normalized}`, `crypto-team@${normalized}`], enabled: true },
  ];
}

const ReportingScheduled = () => {
  const { selectedScanResults, selectedAssets } = useSelectedScan();
  const targetLabel = selectedScanResults?.target ?? selectedAssets[0]?.domain ?? 'target.com';
  const [schedules, setSchedules] = useState(() => buildSchedules(targetLabel));

  const toggleSchedule = (id: string) => {
    setSchedules((prev) => prev.map((schedule) => schedule.id === id ? { ...schedule, enabled: !schedule.enabled } : schedule));
  };

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">Scheduled Reports</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Configure automated report generation and delivery</p>
      </div>
      <SectionTabBar tabs={reportingTabs} />
      <div className="flex items-center justify-between">
        <Button className="gap-1.5 text-xs bg-accent-amber text-brand-primary hover:brightness-105">
          <Plus className="w-3.5 h-3.5" /> New Schedule
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Schedules', value: schedules.filter((schedule) => schedule.enabled).length, icon: CheckCircle2, color: 'text-status-safe' },
          { label: 'Next Report Due', value: 'Apr 10', icon: Calendar, color: 'text-accent-amber' },
          { label: 'Total Recipients', value: new Set(schedules.flatMap((schedule) => schedule.recipients)).size, icon: Mail, color: 'text-brand-accent' },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="bg-surface border-border">
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Icon className={`w-5 h-5 ${kpi.color}`} />
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">{kpi.label}</p>
                  <p className="font-body text-lg font-bold text-foreground">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-body text-base">Configured Schedules</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="font-mono text-[10px]">ENABLED</TableHead>
                <TableHead className="font-mono text-[10px]">REPORT NAME</TableHead>
                <TableHead className="font-mono text-[10px]">TEMPLATE</TableHead>
                <TableHead className="font-mono text-[10px]">FREQUENCY</TableHead>
                <TableHead className="font-mono text-[10px]">NEXT RUN</TableHead>
                <TableHead className="font-mono text-[10px]">RECIPIENTS</TableHead>
                <TableHead className="font-mono text-[10px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id} className="border-border hover:bg-sunken/50">
                  <TableCell>
                    <Switch checked={schedule.enabled} onCheckedChange={() => toggleSchedule(schedule.id)} />
                  </TableCell>
                  <TableCell className="font-body text-xs font-medium">{schedule.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-mono">{schedule.template}</Badge></TableCell>
                  <TableCell className="font-mono text-xs flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    {schedule.frequency}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{schedule.nextRun}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {schedule.recipients.map((recipient) => (
                        <span key={recipient} className="font-mono text-[9px] bg-sunken px-1.5 py-0.5 rounded text-muted-foreground">{recipient}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-status-critical">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportingScheduled;
