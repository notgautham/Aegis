import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileJson, FileText, Table, FileCode, Globe, Shield } from 'lucide-react';
import DataContextBadge from '@/components/dashboard/DataContextBadge';

import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { FileText as FileTextIcon, Cpu, Package } from 'lucide-react';

const cbomTabs = [
  { id: 'overview', label: 'Overview', icon: FileTextIcon, route: '/dashboard/cbom' },
  { id: 'per-asset', label: 'Per-Asset', icon: Cpu, route: '/dashboard/cbom/per-asset' },
  { id: 'export', label: 'Export Center', icon: Package, route: '/dashboard/cbom/export' },
];

const formats = [
  { icon: FileJson, title: 'CycloneDX 1.6 JSON', desc: 'Standard CBOM format — interoperable with SBOMaaS tools', ext: '.json' },
  { icon: FileCode, title: 'CycloneDX XML', desc: 'XML variant for legacy tool integration', ext: '.xml' },
  { icon: Table, title: 'CSV Export', desc: 'Flat table for spreadsheet analysis', ext: '.csv' },
  { icon: FileText, title: 'PDF Report', desc: 'Executive summary with charts and findings', ext: '.pdf' },
  { icon: Globe, title: 'HTML Report', desc: 'Interactive shareable report — no software needed', ext: '.html' },
  { icon: Shield, title: 'CDXA Attestation Document', desc: 'CycloneDX Attestation document with Ed25519-signed CBOM hash for regulatory submission', ext: '.cdxa' },
];

const CBOMExport = () => (
  <div className="space-y-5">
    <DataContextBadge />
    <h1 className="font-display text-2xl italic text-brand-primary">CBOM Export Center</h1>
    <SectionTabBar tabs={cbomTabs} />

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {formats.map(f => (
        <Card key={f.title} className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)] hover:shadow-lg transition-shadow cursor-pointer group">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-[hsl(var(--bg-sunken))] group-hover:bg-brand-primary/10 transition-colors">
                <f.icon className="w-5 h-5 text-brand-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-body font-semibold">{f.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</p>
                <Button size="sm" className="mt-3 h-7 text-xs">Generate {f.ext}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    <Card className="shadow-sm">
      <CardHeader><CardTitle className="text-sm font-body">Scheduled Exports</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground font-body">Configure recurring CBOM exports to email or storage. <a href="/dashboard/reporting/scheduled" className="text-brand-primary hover:underline">No scheduled exports configured yet — set one up →</a></p>
        <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => window.location.href = '/dashboard/reporting/scheduled'}>Configure Schedule</Button>
      </CardContent>
    </Card>
  </div>
);

export default CBOMExport;