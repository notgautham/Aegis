import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, XCircle, Server, Database, Cpu } from 'lucide-react';
import { api, type SystemHealthResponse } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const statusTone: Record<string, { badge: string; icon: React.ElementType }> = {
  healthy: { badge: 'bg-[hsl(var(--status-safe))] text-white', icon: CheckCircle2 },
  degraded: { badge: 'bg-[hsl(var(--accent-amber))] text-white', icon: AlertTriangle },
  unhealthy: { badge: 'bg-[hsl(var(--status-critical))] text-white', icon: XCircle },
  unknown: { badge: 'bg-[hsl(var(--status-unknown))] text-white', icon: AlertTriangle },
};

const iconByService: Record<string, React.ElementType> = {
  backend_api: Server,
  postgres: Database,
  qdrant: Cpu,
};

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'n/a';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const SystemHealth = () => {
  const { data, isLoading, error } = useQuery<SystemHealthResponse>({
    queryKey: ['system-health'],
    queryFn: () => api.getSystemHealth(),
    refetchInterval: 10000,
  });

  const overallTone = useMemo(() => {
    if (!data?.overall_status) return statusTone.unknown;
    return statusTone[data.overall_status] ?? statusTone.unknown;
  }, [data?.overall_status]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">System Health</h1>
        <p className="text-xs font-body text-muted-foreground mt-0.5">
          Live dependency and runtime telemetry for the Aegis scanning platform.
        </p>
      </div>

      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-body">Overall Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-xs font-body">
          <Badge className={overallTone.badge}>{data?.overall_status ?? 'unknown'}</Badge>
          <span className="text-muted-foreground">
            Endpoints: {data?.route_totals?.api ?? 0} API / {data?.route_totals?.infra ?? 0} infra
          </span>
          <span className="text-muted-foreground">
            Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'loading...'}
          </span>
        </CardContent>
      </Card>

      {isLoading && <p className="text-xs font-body text-muted-foreground">Loading service checks...</p>}
      {error && (
        <Card className="border-[hsl(var(--status-critical)/0.3)] bg-[hsl(var(--status-critical)/0.05)]">
          <CardContent className="py-3 text-xs font-body text-[hsl(var(--status-critical))]">
            Failed to load system health: {error instanceof Error ? error.message : 'unknown error'}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(data?.services ?? []).map((service) => {
          const tone = statusTone[service.status] ?? statusTone.unknown;
          const Icon = iconByService[service.name] ?? Server;
          const ToneIcon = tone.icon;
          return (
            <Card key={service.name} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-body flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {service.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={tone.badge}>{service.status}</Badge>
                  <ToneIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-1 text-[11px] font-mono text-muted-foreground">
                  {Object.entries(service.details ?? {}).map(([key, value]) => (
                    <p key={key}>
                      <span className="text-foreground">{key}</span>: {renderValue(value)}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(data?.system_checks ?? []).map((check) => {
          const tone = statusTone[check.status] ?? statusTone.unknown;
          const ToneIcon = tone.icon;
          return (
            <Card key={check.name} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-body flex items-center gap-2">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  {check.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={tone.badge}>{check.status}</Badge>
                  <ToneIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-1 text-[11px] font-mono text-muted-foreground">
                  {Object.entries(check.details ?? {}).map(([key, value]) => (
                    <p key={key}>
                      <span className="text-foreground">{key}</span>: {renderValue(value)}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-body">Runtime Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-[11px] font-mono text-muted-foreground">
          {Object.entries(data?.runtime ?? {}).map(([key, value]) => (
            <p key={key}>
              <span className="text-foreground">{key}</span>: {renderValue(value)}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-body">API Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-body">
              <thead>
                <tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Method</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Path</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.api_endpoints ?? []).map((endpoint) => {
                  const tone = statusTone[endpoint.status] ?? statusTone.unknown;
                  return (
                    <tr key={`${endpoint.methods.join(',')}:${endpoint.path}`} className="border-b border-border/50">
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{endpoint.methods.join(', ')}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-foreground">{endpoint.path}</td>
                      <td className="px-3 py-2"><Badge className={tone.badge}>{endpoint.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-body">Infrastructure Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-body">
              <thead>
                <tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Method</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Path</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.infra_endpoints ?? []).map((endpoint) => {
                  const tone = statusTone[endpoint.status] ?? statusTone.unknown;
                  return (
                    <tr key={`${endpoint.methods.join(',')}:${endpoint.path}`} className="border-b border-border/50">
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{endpoint.methods.join(', ')}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-foreground">{endpoint.path}</td>
                      <td className="px-3 py-2"><Badge className={tone.badge}>{endpoint.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemHealth;
