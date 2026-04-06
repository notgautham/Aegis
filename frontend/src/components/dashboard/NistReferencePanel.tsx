import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { HelpCircle, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const nistData = [
  { standard: 'FIPS 203', algo: 'ML-KEM-512', level: 'Level 1 (AES-128 eq.)', replaces: 'ECDH P-256', safe: 'yes' },
  { standard: 'FIPS 203', algo: 'ML-KEM-768', level: 'Level 3 (AES-192 eq.)', replaces: 'ECDH P-384', safe: 'yes' },
  { standard: 'FIPS 203', algo: 'ML-KEM-1024', level: 'Level 5 (AES-256 eq.)', replaces: 'ECDH P-521', safe: 'yes' },
  { standard: 'FIPS 204', algo: 'ML-DSA-44', level: 'Level 2', replaces: 'ECDSA P-256', safe: 'yes' },
  { standard: 'FIPS 204', algo: 'ML-DSA-65', level: 'Level 3', replaces: 'ECDSA P-384', safe: 'yes' },
  { standard: 'FIPS 204', algo: 'ML-DSA-87', level: 'Level 5', replaces: 'ECDSA P-521', safe: 'yes' },
  { standard: 'FIPS 205', algo: 'SLH-DSA-128s', level: 'Level 1', replaces: 'RSA-2048 (backup)', safe: 'yes' },
  { standard: 'FIPS 205', algo: 'SLH-DSA-256f', level: 'Level 5', replaces: 'RSA-4096 (backup)', safe: 'yes' },
  { standard: 'Legacy', algo: 'RSA-2048', level: '—', replaces: '—', safe: 'vuln' },
  { standard: 'Legacy', algo: 'ECDH/ECDSA', level: '—', replaces: '—', safe: 'vuln' },
  { standard: 'Legacy', algo: 'AES-256', level: '—', replaces: '—', safe: 'grover' },
];

const NistReferencePanel = () => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <HelpCircle className="w-4 h-4 text-muted-foreground" />
      </Button>
    </SheetTrigger>
    <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="font-display text-lg italic text-brand-primary">NIST PQC Algorithm Reference</SheetTitle>
      </SheetHeader>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-body">
          <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
            <th className="text-left px-2 py-2 font-medium text-muted-foreground">Standard</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground">Algorithm</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground">Security Level</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground">Replaces</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground">Quantum Safe</th>
          </tr></thead>
          <tbody>
            {nistData.map((row, i) => (
              <tr key={i} className={`border-b border-border/50 ${row.safe === 'vuln' ? 'bg-[hsl(var(--status-critical)/0.03)]' : ''}`}>
                <td className="px-2 py-2 font-mono font-semibold">{row.standard}</td>
                <td className="px-2 py-2 font-mono">{row.algo}</td>
                <td className="px-2 py-2 text-muted-foreground">{row.level}</td>
                <td className="px-2 py-2 text-muted-foreground">{row.replaces}</td>
                <td className="px-2 py-2">
                  {row.safe === 'yes' && <span className="flex items-center gap-1 text-[hsl(var(--status-safe))]"><Check className="w-3 h-3" /> ✅</span>}
                  {row.safe === 'vuln' && <span className="flex items-center gap-1 text-[hsl(var(--status-critical))] font-semibold"><X className="w-3 h-3" /> QUANTUM VULNERABLE</span>}
                  {row.safe === 'grover' && <span className="flex items-center gap-1 text-[hsl(var(--accent-amber))]"><AlertTriangle className="w-3 h-3" /> GROVER-REDUCED</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--bg-sunken))] text-xs font-body text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Recommended banking migration path:</strong> ML-KEM-768 (key exchange) + ML-DSA-65 (signatures). Supported by OpenSSL 3.4+ with OQS provider.
      </div>
    </SheetContent>
  </Sheet>
);

export default NistReferencePanel;
