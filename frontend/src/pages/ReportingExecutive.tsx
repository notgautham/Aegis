import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Calendar, Shield, TrendingUp, AlertTriangle, Clock, PenTool } from 'lucide-react';
import SectionTabBar from '@/components/dashboard/SectionTabBar';

const reportingTabs = [
  { id: 'executive', label: 'Executive Reports', icon: TrendingUp, route: '/dashboard/reporting/executive' },
  { id: 'scheduled', label: 'Scheduled Reports', icon: Clock, route: '/dashboard/reporting/scheduled' },
  { id: 'on-demand', label: 'On-Demand Builder', icon: PenTool, route: '/dashboard/reporting/on-demand' },
];

const reportTemplates = [
  {
    id: 'executive',
    title: 'Executive Summary',
    description: 'High-level quantum readiness overview for C-suite and board presentation',
    sections: ['Q-Score Overview', 'Tier Classification', 'Top 5 Risks', 'Migration Progress', 'Recommendations'],
    lastGenerated: '2026-03-30',
    format: 'PDF',
    icon: TrendingUp,
  },
  {
    id: 'compliance',
    title: 'NIST Compliance Report',
    description: 'Detailed FIPS 203/204/205 compliance assessment with gap analysis',
    sections: ['Compliance Matrix', 'Algorithm Inventory', 'Gap Analysis', 'Remediation Timeline'],
    lastGenerated: '2026-03-28',
    format: 'PDF',
    icon: Shield,
  },
  {
    id: 'risk',
    title: 'Quantum Risk Assessment',
    description: 'Full HNDL risk analysis with break-year projections per asset',
    sections: ['HNDL Risk Matrix', 'Break Year Timeline', 'Quantum Debt Score', 'Asset-Level Risk'],
    lastGenerated: '2026-03-29',
    format: 'PDF',
    icon: AlertTriangle,
  },
  {
    id: 'cbom',
    title: 'CBOM Inventory Report',
    description: 'Complete Cryptographic Bill of Materials in CycloneDX format',
    sections: ['CBOM Summary', 'Per-Asset CBOM Tree', 'Crypto Algorithm Distribution', 'Vulnerability Annotations'],
    lastGenerated: '2026-03-31',
    format: 'JSON/XML',
    icon: FileText,
  },
];

const recentReports = [
  { name: 'Executive_Summary_Q1_2026.pdf', date: '2026-03-30', size: '2.4 MB', type: 'Executive Summary' },
  { name: 'CBOM_CycloneDX_20260331.json', date: '2026-03-31', size: '847 KB', type: 'CBOM Report' },
  { name: 'NIST_Compliance_Mar2026.pdf', date: '2026-03-28', size: '3.1 MB', type: 'Compliance' },
  { name: 'Risk_Assessment_VPN.pdf', date: '2026-03-29', size: '1.8 MB', type: 'Risk Assessment' },
  { name: 'Migration_Progress_W13.pdf', date: '2026-03-27', size: '1.2 MB', type: 'Progress Report' },
];

const ReportingExecutive = () => {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">Executive Reports</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Pre-built report templates for stakeholder communication and compliance documentation</p>
      </div>
      <SectionTabBar tabs={reportingTabs} />

      {/* Report Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {reportTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <Card key={template.id} className="bg-surface border-border hover:border-accent-amber/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-primary/5 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-accent-amber" />
                    </div>
                    <div>
                      <CardTitle className="font-body text-sm">{template.title}</CardTitle>
                      <p className="font-body text-xs text-muted-foreground mt-0.5">{template.description}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">{template.format}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {template.sections.map((section) => (
                    <span key={section} className="font-mono text-[9px] text-muted-foreground bg-sunken px-2 py-0.5 rounded">
                      {section}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Last: {template.lastGenerated}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                    <Download className="w-3 h-3" /> Generate
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Reports */}
      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-body text-base">Recent Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="font-mono text-[10px]">FILE NAME</TableHead>
                <TableHead className="font-mono text-[10px]">TYPE</TableHead>
                <TableHead className="font-mono text-[10px]">DATE</TableHead>
                <TableHead className="font-mono text-[10px]">SIZE</TableHead>
                <TableHead className="font-mono text-[10px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentReports.map((report) => (
                <TableRow key={report.name} className="border-border hover:bg-sunken/50">
                  <TableCell className="font-mono text-xs flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    {report.name}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-mono">{report.type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{report.date}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{report.size}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Download className="w-3.5 h-3.5" />
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

export default ReportingExecutive;
