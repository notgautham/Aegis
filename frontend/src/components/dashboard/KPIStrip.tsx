import { useEffect, useState, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Asset } from '@/data/demoData';
import { isTransitionAsset } from '@/lib/status';

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  className?: string;
}

const CountUp = ({ end, duration = 800, prefix = '', className = '' }: CountUpProps) => {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    started.current = false;
    setValue(0);

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const animate = (now: number) => {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(eased * end));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref} className={className}>{prefix}{value}</span>;
};

const execLabelMap: Record<string, string> = {
  'Fully Quantum Safe': 'Protected Assets',
  'Critically Vulnerable': 'At Risk',
  'Unknown': 'Pending Assessment',
  'PQC Transition': 'Upgrading',
  'Quantum Vulnerable': 'Needs Upgrade',
};

interface KPIStripProps {
  execMode?: boolean;
  selectedAssets: Asset[];
}

const KPIStrip = ({ execMode = false, selectedAssets }: KPIStripProps) => {
  const kpis = [
    { label: 'Total Assets', value: selectedAssets.length, color: 'text-brand-primary', dotColor: '' },
    { label: 'Fully Quantum Safe', value: selectedAssets.filter((asset) => asset.status === 'elite-pqc').length, color: 'text-status-safe', dotColor: '' },
    { label: 'PQC Transition', value: selectedAssets.filter(isTransitionAsset).length, color: 'text-blue-500', dotColor: '' },
    { label: 'Quantum Vulnerable', value: selectedAssets.filter((asset) => asset.status === 'vulnerable' || asset.status === 'standard').length, color: 'text-status-vuln', dotColor: '' },
    { label: 'Critically Vulnerable', value: selectedAssets.filter((asset) => asset.status === 'critical').length, color: 'text-status-critical', dotColor: 'animate-pulse-dot' },
    { label: 'Unknown', value: selectedAssets.filter((asset) => asset.status === 'unknown').length, color: 'text-status-unknown', dotColor: '' },
    { label: 'Expiring Certs (<=30d)', value: selectedAssets.filter((asset) => asset.certInfo.days_remaining <= 30).length, color: 'text-accent-amber', dotColor: '', icon: 'warn' },
    { label: 'High Risk Assets', value: selectedAssets.filter((asset) => asset.qScore < 40).length, color: 'text-status-critical', dotColor: 'animate-pulse-dot', icon: 'risk' },
  ];

  const getLabel = (label: string) => execMode && execLabelMap[label] ? execLabelMap[label] : label;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
      {kpis.map((k) => (
        <div key={k.label} className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-5 shadow-[0_16px_36px_-28px_hsl(var(--brand-primary)/0.42)]">
          <div className="flex items-center gap-1.5 mb-2">
            {k.dotColor && (
              <span className={`w-2 h-2 rounded-full bg-status-critical ${k.dotColor}`} />
            )}
            {(k as any).icon === 'warn' && <AlertTriangle className="w-3 h-3 text-accent-amber" />}
            <span className="font-body text-xs font-medium text-muted-foreground uppercase">{getLabel(k.label)}</span>
          </div>
          <CountUp end={k.value} className={`font-mono text-3xl font-bold ${k.color}`} />
        </div>
      ))}
    </div>
  );
};

export default KPIStrip;
