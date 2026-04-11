import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Download, Copy, CheckCircle2 } from 'lucide-react';
import { Asset, getStatusLabel } from '@/data/demoData';

interface PQCCertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
}

const PQCCertificateModal = ({ open, onOpenChange, asset }: PQCCertificateModalProps) => {
  const [copied, setCopied] = useState(false);
  const isElite = asset.status === 'elite-pqc';
  const isTransitioning =
    asset.complianceTier === 'PQC_TRANSITIONING' ||
    asset.status === 'transitioning' ||
    asset.status === 'safe';
  const certId = `AEGIS-PQC-2026-${String(parseInt(asset.id.replace('a', '')) + 41).padStart(5, '0')}`;
  const issueDate = '2026-04-01';
  const expiryDate = '2027-04-01';

  const handleCopy = () => {
    navigator.clipboard.writeText(certId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <div className="text-center space-y-6 py-4">
          {/* Header */}
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-8 h-8 text-accent-amber fill-accent-amber/20" />
            <span className="font-mono text-sm font-bold text-brand-primary">AEGIS</span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Quantum Cryptographic Intelligence Platform</p>

          {/* Title */}
          <h2 className="font-display text-xl italic text-brand-primary">
            {isElite ? 'Post-Quantum Cryptography Readiness Certificate' : 'PQC Transition Certificate'}
          </h2>

          {/* Asset */}
          <div className="space-y-1">
            <p className="font-mono text-lg font-bold text-foreground">{asset.domain}</p>
            <p className="font-mono text-xs text-muted-foreground">{asset.url}</p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-left text-xs font-body bg-[hsl(var(--bg-sunken))] p-4 rounded-lg">
            <div><span className="text-muted-foreground">Issue Date</span><p className="font-mono font-medium">{issueDate}</p></div>
            <div><span className="text-muted-foreground">Expiry Date</span><p className="font-mono font-medium">{expiryDate}</p></div>
            <div><span className="text-muted-foreground">Certificate ID</span><p className="font-mono font-medium text-brand-primary">{certId}</p></div>
            <div><span className="text-muted-foreground">Status</span><p className="font-mono font-medium">{getStatusLabel(asset.status)}</p></div>
          </div>

          {/* NIST Standards */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono text-muted-foreground uppercase">NIST Standards Met</p>
            <div className="flex items-center justify-center gap-3">
              {['FIPS 203 (ML-KEM)', 'FIPS 204 (ML-DSA)', 'FIPS 205 (SLH-DSA)'].map(s => (
                <div key={s} className="flex items-center gap-1 text-xs font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--status-safe))]" />
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Attestation */}
          <div className="text-left bg-[hsl(var(--bg-sunken))] p-3 rounded-lg space-y-1">
            <p className="text-[10px] font-mono text-muted-foreground">Attested by: AEGIS Quantum Scanner v1.0</p>
            <p className="text-[10px] font-mono text-muted-foreground break-all">Ed25519 Hash: a7f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1</p>
          </div>

          {/* Verify URL */}
          <p className="text-[10px] font-mono text-muted-foreground">
            Verify at: <span className="text-brand-primary">aegis.com/verify/{certId}</span>
          </p>

          {/* Actions */}
          <div className="flex gap-2 justify-center">
            <Button className="text-xs gap-1.5"><Download className="w-3.5 h-3.5" /> Download as PDF</Button>
            <Button variant="outline" className="text-xs gap-1.5" onClick={handleCopy}>
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Certificate ID'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PQCCertificateModal;
