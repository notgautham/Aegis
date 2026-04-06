import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Terminal, Play, RotateCcw, CheckCircle2, Loader2, Clock, LayoutDashboard, FileText, Wrench } from 'lucide-react';
import { useScanContext } from '@/contexts/ScanContext';

interface ScanPhase {
  id: number;
  name: string;
  description: string;
  duration: number; // seconds
  logLines: string[];
}

function generateScanPhases(domain: string): ScanPhase[] {
  const root = domain || 'target.com';
  return [
    {
      id: 1,
      name: 'Discovery',
      description: 'Enumerating domains, subdomains, and IP ranges',
      duration: 4,
      logLines: [
        `> Initiating DNS enumeration for *.${root} ...`,
        `  [+] Found: ${root} (A: 14.140.82.10)`,
        `  [+] Found: netbanking.${root} (A: 14.140.82.25)`,
        `  [+] Found: vpn.${root} (A: 14.140.82.10)`,
        `  [+] Found: auth.${root} (A: 14.140.82.40)`,
        `  [+] Found: swift.${root} (A: 14.140.82.20)`,
        `  [+] Found: mail.${root} (A: 14.140.82.32)`,
        `  [+] Found: pqc-api.${root} (A: 14.140.82.50)`,
        `  [!] Shadow IT: dev-api.${root} (external registrar)`,
        `  [!] Shadow IT: test-portal.${root} (unknown owner)`,
        '  [✓] Discovery complete: 12 domains, 8 IPs, 3 shadow IT alerts',
      ],
    },
    {
      id: 2,
      name: 'TLS Probing',
      description: 'Scanning TLS configurations and cipher suites',
      duration: 5,
      logLines: [
        '> Probing TLS configuration on 8 endpoints ...',
        `  [SCAN] vpn.${root}:443 — TLS 1.2 | RSA-2048 | AES-128-CBC`,
        `  [WARN] vpn.${root} — TLS 1.0, 1.1 enabled (legacy)`,
        `  [WARN] vpn.${root} — No forward secrecy (RSA key exchange)`,
        `  [SCAN] netbanking.${root}:443 — TLS 1.2 | ECDHE-RSA | AES-256-GCM`,
        `  [SCAN] auth.${root}:443 — TLS 1.3 | X25519 | AES-256-GCM`,
        `  [SCAN] swift.${root}:443 — TLS 1.2 | ECDHE-RSA | AES-256-GCM`,
        `  [CRIT] staging.${root}:443 — No TLS response (connection refused)`,
        `  [SCAN] pqc-api.${root}:443 — TLS 1.3 | X25519MLKEM768 | AES-256-GCM`,
        `  [OK]   pqc-api.${root} — PQC hybrid key exchange detected!`,
        '  [✓] TLS probing complete: 2 critical, 3 warnings, 1 PQC-ready',
      ],
    },
    {
      id: 3,
      name: 'PQC Classification',
      description: 'Assessing post-quantum cryptography readiness',
      duration: 4,
      logLines: [
        '> Running PQC classification engine ...',
        '  [HNDL] Computing Harvest-Now-Decrypt-Later risk ...',
        `  [HNDL] vpn.${root} — Break Year: 2031 (5 years) — CRITICAL`,
        `  [HNDL] netbanking.${root} — Break Year: 2034 (8 years) — HIGH`,
        `  [HNDL] auth.${root} — Break Year: 2038+ (12+ years) — LOW`,
        `  [HNDL] pqc-api.${root} — Quantum-Safe (ML-KEM-768)`,
        '  [TIER] Classifying assets into Q-Score tiers ...',
        '  [TIER] 1 Elite-PQC | 2 Standard | 1 Legacy | 5 Critical',
        '  [DEBT] Quantum Debt Score: 742 / 1000',
        '  [✓] PQC classification complete',
      ],
    },
    {
      id: 4,
      name: 'CBOM Generation',
      description: 'Building Cryptographic Bill of Materials',
      duration: 3,
      logLines: [
        '> Generating CycloneDX 1.7 CBOM ...',
        '  [CBOM] Processing 21 crypto components across 9 assets ...',
        '  [CBOM] Mapping: TLS Certificates → Key Exchange → Cipher Suites',
        '  [CBOM] Annotating quantum vulnerability metadata ...',
        '  [CBOM] CBOM components: 8 certificates, 6 key exchanges, 7 ciphers',
        '  [SIGN] Signing CBOM with Ed25519 attestation key ...',
        '  [✓] CBOM generated: aegis-cbom-20260331.json (847 KB)',
      ],
    },
    {
      id: 5,
      name: 'Certification',
      description: 'Verifying NIST FIPS 203/204/205 compliance',
      duration: 3,
      logLines: [
        '> Running NIST FIPS compliance verification ...',
        '  [FIPS] Checking FIPS 203 (ML-KEM) compliance ...',
        '  [FIPS] 1/9 assets compliant with ML-KEM-768',
        '  [FIPS] Checking FIPS 204 (ML-DSA) compliance ...',
        '  [FIPS] 1/9 assets using ML-DSA-65 signatures',
        '  [FIPS] Checking FIPS 205 (SLH-DSA) compliance ...',
        '  [FIPS] 0/9 assets using SLH-DSA',
        '  [RATE] Enterprise Q-Score: 455 / 1000 (Standard Tier)',
        '  [✓] Certification complete — Report ready',
        '',
        '═══════════════════════════════════════════════',
        '  AEGIS SCAN COMPLETE — 9 assets analyzed',
        '  Q-Score: 455 | Tier: Standard | CBOM: Generated',
        '═══════════════════════════════════════════════',
      ],
    },
  ];
}

const ScanConsole = () => {
  const { rootDomain } = useScanContext();
  const navigate = useNavigate();
  const scanPhases = generateScanPhases(rootDomain);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(-1);
  const [logOutput, setLogOutput] = useState<string[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const startScan = () => {
    setIsRunning(true);
    setCurrentPhase(0);
    setLogOutput([
      '╔═══════════════════════════════════════════════╗',
      `║   AEGIS Quantum Readiness Scanner v2.1.0      ║`,
      `║   Target: *.${rootDomain || 'target.com'}`,
      '║   Scan ID: AEGIS-2026-0331-001                ║',
      '╚═══════════════════════════════════════════════╝',
      '',
    ]);
    setLineIndex(0);
    setPhaseProgress(0);
    setCompleted(false);
  };

  const resetScan = () => {
    setIsRunning(false);
    setCurrentPhase(-1);
    setLogOutput([]);
    setLineIndex(0);
    setPhaseProgress(0);
    setCompleted(false);
  };

  // Simulate log lines appearing one by one
  useEffect(() => {
    if (!isRunning || currentPhase < 0 || currentPhase >= scanPhases.length) return;

    const phase = scanPhases[currentPhase];
    if (lineIndex >= phase.logLines.length) {
      // Move to next phase
      const timer = setTimeout(() => {
        if (currentPhase < scanPhases.length - 1) {
          setCurrentPhase(prev => prev + 1);
          setLineIndex(0);
        } else {
          setIsRunning(false);
          setCompleted(true);
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setLogOutput(prev => [...prev, phase.logLines[lineIndex]]);
      setLineIndex(prev => prev + 1);
      setPhaseProgress(((lineIndex + 1) / phase.logLines.length) * 100);
    }, 150 + Math.random() * 250);

    return () => clearTimeout(timer);
  }, [isRunning, currentPhase, lineIndex]);

  // Auto-scroll
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logOutput]);

  const overallProgress = currentPhase >= 0
    ? Math.round(((currentPhase + (phaseProgress / 100)) / scanPhases.length) * 100)
    : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-body text-2xl font-bold text-foreground">Scan Console</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Real-time scanning terminal with 5-phase pipeline output</p>
        </div>
        <div className="flex gap-2">
          {!isRunning && !completed && (
            <Button onClick={startScan} className="gap-1.5 text-xs bg-accent-amber text-brand-primary hover:brightness-105">
              <Play className="w-3.5 h-3.5" /> Start Scan
            </Button>
          )}
          {(isRunning || completed) && (
            <Button onClick={resetScan} variant="outline" className="gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Phase Indicators */}
      <div className="flex gap-2">
        {scanPhases.map((phase, i) => (
          <div key={phase.id} className={`flex-1 text-center px-2 py-2 rounded-lg border transition-all ${
            i === currentPhase ? 'border-accent-amber bg-accent-amber/5' :
            i < currentPhase || completed ? 'border-status-safe/30 bg-status-safe/5' :
            'border-border bg-surface'
          }`}>
            <div className="flex items-center justify-center gap-1 mb-0.5">
              {i < currentPhase || completed ? (
                <CheckCircle2 className="w-3 h-3 text-status-safe" />
              ) : i === currentPhase ? (
                <Loader2 className="w-3 h-3 text-accent-amber animate-spin" />
              ) : (
                <Clock className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="font-mono text-[9px] font-bold">{phase.id}</span>
            </div>
            <p className="font-mono text-[9px] text-muted-foreground leading-tight">{phase.name}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      {(isRunning || completed) && (
        <Card className="bg-surface border-border">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">
                {completed ? 'SCAN COMPLETE' : `PHASE ${currentPhase + 1}: ${scanPhases[currentPhase]?.name.toUpperCase()}`}
              </span>
              <span className="font-mono text-[10px] font-bold text-foreground">{completed ? '100' : overallProgress}%</span>
            </div>
            <Progress value={completed ? 100 : overallProgress} className="h-1.5" />
          </CardContent>
        </Card>
      )}

      {/* Terminal */}
      <Card className="bg-brand-primary border-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
          <Terminal className="w-3.5 h-3.5 text-accent-amber" />
          <span className="font-mono text-[10px] text-white/60">aegis-scanner — *.pnb.co.in</span>
          {isRunning && (
            <Badge className="bg-status-safe/20 text-status-safe text-[9px] font-mono ml-auto">LIVE</Badge>
          )}
        </div>
        <div
          ref={logRef}
          className="p-4 h-[400px] overflow-y-auto font-mono text-xs leading-relaxed"
        >
          {logOutput.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30">
              <Terminal className="w-8 h-8 mb-3" />
              <p className="text-sm">Click "Start Scan" to begin</p>
              <p className="text-[10px] mt-1">Target: *.pnb.co.in</p>
            </div>
          ) : (
            logOutput.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.1 }}
                className={`${
                  line.includes('[CRIT]') || line.includes('[!]') ? 'text-status-critical' :
                  line.includes('[WARN]') ? 'text-status-warn' :
                  line.includes('[OK]') || line.includes('[✓]') ? 'text-status-safe' :
                  line.includes('[+]') ? 'text-accent-amber' :
                  line.includes('═') || line.includes('╔') || line.includes('╚') || line.includes('║') ? 'text-accent-amber' :
                  'text-white/70'
                }`}
              >
                {line || '\u00A0'}
              </motion.div>
            ))
          )}
          {isRunning && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-accent-amber"
            >
              ▌
            </motion.span>
          )}
        </div>
      </Card>
      {/* What Next Panel */}
      {completed && (
        <Card className="bg-surface border-border">
          <CardContent className="pt-5 pb-4">
            <h3 className="font-body text-sm font-semibold mb-4">What do you want to do next?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="p-4 rounded-lg border border-border hover:border-[hsl(var(--accent-amber)/0.3)] transition-colors">
                <LayoutDashboard className="w-5 h-5 text-brand-primary mb-2" />
                <h4 className="font-body text-xs font-semibold">View Full Results</h4>
                <p className="text-[10px] text-muted-foreground font-body mt-1">See everything this scan found in the dashboard.</p>
                <Button size="sm" className="mt-3 text-xs h-7" onClick={() => navigate('/dashboard')}>Open in Dashboard →</Button>
              </div>
              <div className="p-4 rounded-lg border border-border hover:border-[hsl(var(--accent-amber)/0.3)] transition-colors">
                <FileText className="w-5 h-5 text-brand-primary mb-2" />
                <h4 className="font-body text-xs font-semibold">View Scan Report</h4>
                <p className="text-[10px] text-muted-foreground font-body mt-1">See the detailed per-scan report with findings and CBOM.</p>
                <Button size="sm" className="mt-3 text-xs h-7" onClick={() => navigate('/dashboard/scans/SCN-007')}>View Scan Report →</Button>
              </div>
              <div className="p-4 rounded-lg border border-border hover:border-[hsl(var(--accent-amber)/0.3)] transition-colors">
                <Wrench className="w-5 h-5 text-brand-primary mb-2" />
                <h4 className="font-body text-xs font-semibold">Start Remediation</h4>
                <p className="text-[10px] text-muted-foreground font-body mt-1">Jump directly to the remediation action plan.</p>
                <Button size="sm" className="mt-3 text-xs h-7" onClick={() => navigate('/dashboard/remediation/action-plan')}>Go to Remediation →</Button>
              </div>
            </div>
            <Button variant="outline" className="text-xs" onClick={resetScan}>Run Another Scan</Button>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default ScanConsole;
