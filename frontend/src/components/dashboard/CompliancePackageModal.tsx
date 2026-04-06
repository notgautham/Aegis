import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Download, FileText, Shield } from 'lucide-react';

interface CompliancePackageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CompliancePackageModal = ({ open, onOpenChange }: CompliancePackageModalProps) => {
  const [scope, setScope] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const [standards, setStandards] = useState({ fips203: true, fips204: true, fips205: true, rbi: true });

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setReady(true);
    }, 2000);
  };

  const handleClose = () => {
    onOpenChange(false);
    setReady(false);
    setGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-body text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-primary" />
            Generate Compliance Evidence Package
          </DialogTitle>
          <DialogDescription className="text-xs font-body">
            Creates a signed, timestamped package for regulatory submission containing the CBOM, per-asset PQC certificates, attestation manifest, and executive summary.
          </DialogDescription>
        </DialogHeader>

        {!ready ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Scope</label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assets</SelectItem>
                  <SelectItem value="customer">Customer-Facing Only</SelectItem>
                  <SelectItem value="custom">Custom Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-body text-muted-foreground mb-2 block">Standards Mapped</label>
              <div className="space-y-2">
                {[
                  { key: 'fips203', label: 'NIST FIPS 203 (ML-KEM)' },
                  { key: 'fips204', label: 'NIST FIPS 204 (ML-DSA)' },
                  { key: 'fips205', label: 'NIST FIPS 205 (SLH-DSA)' },
                  { key: 'rbi', label: 'RBI IT Framework' },
                ].map(s => (
                  <div key={s.key} className="flex items-center gap-2">
                    <Checkbox
                      checked={standards[s.key as keyof typeof standards]}
                      onCheckedChange={(v) => setStandards(prev => ({ ...prev, [s.key]: !!v }))}
                    />
                    <span className="text-xs font-body">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Date Range</label>
              <p className="text-xs font-mono text-foreground">Last 30 days (default)</p>
            </div>

            <Button onClick={handleGenerate} disabled={generating} className="w-full text-xs">
              {generating ? 'Generating Package...' : 'Generate Package'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-[hsl(var(--status-safe))] mx-auto" />
            <h3 className="font-body text-lg font-semibold">Package Ready</h3>
            <div className="text-left space-y-1.5 bg-[hsl(var(--bg-sunken))] p-3 rounded-lg">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">File Manifest</p>
              {['CBOM_CycloneDX_v1.6.json', 'PQC_Certificates_Bundle.zip', 'Attestation_Manifest.cdxa', 'Executive_Summary.pdf', 'Asset_Compliance_Matrix.xlsx'].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs font-mono">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  {f}
                </div>
              ))}
            </div>
            <Button className="w-full text-xs gap-1.5"><Download className="w-3.5 h-3.5" /> Download Package (.zip)</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CompliancePackageModal;
