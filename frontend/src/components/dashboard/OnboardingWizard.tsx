import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight, Scan, BarChart3, ClipboardList, Wrench } from 'lucide-react';
import { useScanContext } from '@/contexts/ScanContext';

const OnboardingWizard = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const { setScannedDomain } = useScanContext();

  useEffect(() => {
    if (!localStorage.getItem('aegis-onboarded')) {
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem('aegis-onboarded', 'true');
    setOpen(false);
  };

  const handleDemoScan = () => {
    setScannedDomain('aegis.com');
    setStep(3);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {step === 1 && (
          <div className="p-8 text-center space-y-6">
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-10 h-10 text-accent-amber fill-accent-amber/20" />
            </div>
            <h2 className="font-display text-2xl italic text-brand-primary">Welcome to AEGIS</h2>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              AEGIS is a Quantum Cryptographic Intelligence Platform that scans your infrastructure, generates a Cryptographic Bill of Materials, and assesses your Post-Quantum Cryptography readiness.
            </p>
            <Button onClick={() => setStep(2)} className="gap-1.5 text-sm">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 space-y-6">
            <h2 className="font-body text-lg font-semibold text-center">Add Your First Target</h2>
            <p className="text-xs text-muted-foreground text-center font-body">
              Enter a domain to scan, or try our demo scan.
            </p>
            <div className="p-4 rounded-lg bg-[hsl(var(--bg-sunken))] text-center">
              <p className="text-xs font-body text-muted-foreground mb-2">Try scanning:</p>
              <code className="font-mono text-sm text-brand-primary">aegis.com</code>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={handleDemoScan} className="gap-1.5 text-sm">
                <Scan className="w-4 h-4" /> Run Demo Scan
              </Button>
              <button onClick={() => { setStep(3); }} className="text-xs text-muted-foreground hover:text-foreground font-body">
                Skip for now →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 space-y-6">
            <h2 className="font-body text-lg font-semibold text-center">Here's What We Found</h2>
            <div className="text-center space-y-1">
              <p className="font-mono text-2xl font-bold text-brand-primary">21 Assets</p>
              <p className="text-xs text-muted-foreground font-body">3 are Critical · Q-Score: 370 (Legacy)</p>
            </div>
            <p className="text-xs text-muted-foreground font-body text-center">Here's where to start:</p>
            <div className="space-y-2">
              <Button variant="outline" className="w-full text-xs justify-start gap-2" onClick={() => { dismiss(); navigate('/dashboard/inventory'); }}>
                <BarChart3 className="w-4 h-4" /> View Critical Assets →
              </Button>
              <Button variant="outline" className="w-full text-xs justify-start gap-2" onClick={() => { dismiss(); navigate('/dashboard/cbom'); }}>
                <ClipboardList className="w-4 h-4" /> See Your CBOM →
              </Button>
              <Button variant="outline" className="w-full text-xs justify-start gap-2" onClick={() => { dismiss(); navigate('/dashboard/remediation/action-plan'); }}>
                <Wrench className="w-4 h-4" /> Start Remediation →
              </Button>
            </div>
            <Button onClick={dismiss} className="w-full text-xs">Go to Dashboard</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingWizard;
