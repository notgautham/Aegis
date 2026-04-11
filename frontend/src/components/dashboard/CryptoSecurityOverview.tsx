import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Asset } from '@/data/demoData';
import { cn } from '@/lib/utils';

interface CryptoSecurityOverviewProps {
  selectedAssets: Asset[];
}

const CryptoSecurityOverview = ({ selectedAssets }: CryptoSecurityOverviewProps) => {
  const rows = selectedAssets;

  return (
    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Crypto & Security Overview</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[22rem] overflow-y-auto">
        <table className="w-full text-xs font-body">
          <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Key Exchange</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cipher Suite</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">TLS</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">CA</th>
          </tr></thead>
          <tbody>
            {rows.map((a, i) => {
              const isWeak = /DES|RC4|NULL|EXPORT|CBC/.test(a.cipher);
              const isPqcRow = a.keyExchange === 'ML-KEM-768' && a.tlsVersionsSupported.includes('TLS_1_3');
              return (
                <tr key={a.id} className={cn(
                  "border-b border-border/50",
                  isWeak && "text-[hsl(var(--status-critical))]",
                  isPqcRow && "border-l-2 border-l-[hsl(var(--status-safe))]"
                )}>
                  <td className="px-3 py-2 font-mono font-medium">{a.domain}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{a.keyExchange}</td>
                  <td className={cn("px-3 py-2 font-mono text-[10px]", isWeak && "text-[hsl(var(--status-critical))] font-semibold")}>{a.cipher}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{a.tls}</td>
                  <td className="px-3 py-2 text-muted-foreground">{a.certInfo.certificate_authority}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default CryptoSecurityOverview;
