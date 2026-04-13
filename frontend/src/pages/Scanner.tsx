import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useScanContext } from '@/contexts/ScanContext';
import { useScanQueue } from '@/contexts/ScanQueueContext';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import RainingLetters from '@/components/ui/raining-letters';
import { GradientText } from '@/components/ui/gradient-text';
import { Button } from '@/components/ui/button';

const scanProfiles = [
  {
    key: 'Quick',
    title: 'Quick',
    description: 'Fast triage on common ports and core TLS posture checks.',
  },
  {
    key: 'Standard',
    title: 'Standard',
    description: 'Balanced coverage for discovery, TLS analysis, and remediation planning.',
  },
  {
    key: 'Deep',
    title: 'Deep',
    description: 'Expanded probing and richer service fingerprinting for larger attack surface coverage.',
  },
  {
    key: 'PQC Focus',
    title: 'PQC Focus',
    description: 'Prioritizes cryptographic inventory depth and post-quantum migration intelligence.',
  },
] as const;

const exampleChips = ['example.com', 'iana.org', 'neverssl.com', 'www.gnu.org'];

function formatEtaRange(lowerSeconds: number | null, upperSeconds: number | null): string | null {
  if (lowerSeconds === null && upperSeconds === null) return null;
  const lower = Math.max(0, Math.round((lowerSeconds ?? upperSeconds ?? 0) / 60));
  const upper = Math.max(lower, Math.round((upperSeconds ?? lowerSeconds ?? 0) / 60));

  if (upper <= 1) return 'ETA < 1 min';
  if (lower === upper) return `ETA ~${upper} min`;
  return `ETA ${lower}-${upper} min`;
}

const Scanner = () => {
  const [targetInput, setTargetInput] = useState('');
  const [scanProfile, setScanProfile] = useState<string>('Quick');
  const [fullPortScanEnabled, setFullPortScanEnabled] = useState(false);
  const [subdomainEnumerationEnabled, setSubdomainEnumerationEnabled] = useState(false);
  const startedFromScannerRef = useRef(false);
  const lastRedirectedScanIdRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { setScannedDomain } = useScanContext();
  const { startQueue, latestCompletedScanId, isRunning, queue } = useScanQueue();
  const { setSelectedScanId } = useSelectedScan();
  const autoLaunchHandledRef = useRef(false);

  const resolveScanProfile = () => {
    const segments = [scanProfile];
    segments.push(fullPortScanEnabled ? 'Full Port Scan' : 'Bounded Port Scan');
    segments.push(subdomainEnumerationEnabled ? 'Full Enumeration' : 'No Enumeration');
    return segments.join(' + ');
  };

  const startSingleTargetScan = () => {
    const target = targetInput.trim();
    if (!target) return;

    startedFromScannerRef.current = true;
    setScannedDomain(target);
    startQueue([target], resolveScanProfile());
  };

  useEffect(() => {
    const state = location.state as { target?: string; autoStart?: boolean; profile?: string } | null;
    if (!state?.target) return;

    const incomingTarget = state.target.trim();
    if (!incomingTarget) return;

    setTargetInput(incomingTarget);
    setScanProfile('Quick');
    setFullPortScanEnabled(false);
    setSubdomainEnumerationEnabled(false);

    if (!state.autoStart || autoLaunchHandledRef.current || isRunning) return;

    autoLaunchHandledRef.current = true;
    startedFromScannerRef.current = true;
    setScannedDomain(incomingTarget);
    startQueue([incomingTarget], state.profile ?? 'Quick + Bounded Port Scan + No Enumeration');
    navigate(location.pathname, { replace: true, state: null });
  }, [isRunning, location.pathname, location.state, navigate, setScannedDomain, startQueue]);

  useEffect(() => {
    if (!startedFromScannerRef.current) return;
    if (isRunning) return;
    if (!latestCompletedScanId) return;
    if (lastRedirectedScanIdRef.current === latestCompletedScanId) return;

    lastRedirectedScanIdRef.current = latestCompletedScanId;
    startedFromScannerRef.current = false;
    setSelectedScanId(latestCompletedScanId);
    navigate('/dashboard', { state: { bypassPrompt: true } });
  }, [isRunning, latestCompletedScanId, navigate, setSelectedScanId]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      startSingleTargetScan();
    }
  };

  const activeScan = queue.find((item) => item.status === 'scanning');
  const etaText = activeScan ? formatEtaRange(activeScan.etaLowerSeconds, activeScan.etaUpperSeconds) : null;

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-8.5rem)] px-4 md:px-6 pb-8">
      <RainingLetters />
      <div className="relative z-10 w-full max-w-6xl">
        <div className="text-center mb-7 bg-background/85 backdrop-blur-sm px-6 py-4 rounded-xl">
          <GradientText as="h1" className="font-body font-bold text-3xl lg:text-5xl mb-4">Quantum Readiness Scanner</GradientText>
          <p className="font-body text-base text-muted-foreground max-w-3xl mx-auto">
            Enter one domain and choose how broad the discovery should be. Profiles set the scan depth and analysis style, while the toggles control coverage expansion.
          </p>
        </div>

        <div className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-[hsl(var(--accent-amber))] transition-shadow mb-3">
          <input
            value={targetInput}
            onChange={(event) => setTargetInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter a single target domain (e.g. example.com)"
            className="w-full bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none py-1"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[11px] font-body text-muted-foreground">Examples:</span>
          {exampleChips.map((domain) => (
            <button
              key={domain}
              onClick={() => setTargetInput(domain)}
              className="font-mono text-xs text-muted-foreground px-3 py-1.5 rounded-lg border border-[hsl(var(--border-default))] hover:border-[hsl(var(--border-strong))] hover:text-foreground transition-colors"
            >
              {domain}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-sunken))] px-3 py-3 mb-5">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <span className="text-xs font-body text-muted-foreground">Profile:</span>
            <div className="flex gap-1 p-1 rounded-xl bg-background/80">
              {scanProfiles.map((profile) => (
                <button
                  key={profile.key}
                  onClick={() => {
                    setScanProfile(profile.key);
                    if (profile.key === 'Deep') {
                      setFullPortScanEnabled(true);
                      setSubdomainEnumerationEnabled(true);
                      return;
                    }
                    if (profile.key === 'PQC Focus') {
                      setFullPortScanEnabled(false);
                      setSubdomainEnumerationEnabled(false);
                      return;
                    }
                    // Quick and Standard default to bounded/no-enumeration for fast deterministic runs.
                    setFullPortScanEnabled(false);
                    setSubdomainEnumerationEnabled(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-body transition-all ${scanProfile === profile.key ? 'bg-[hsl(var(--accent-amber))] text-white font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {profile.title}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-body text-muted-foreground">
            {scanProfiles.map((profile) => (
              <p key={profile.key} className="rounded-md border border-[hsl(var(--border-default))] bg-background/70 px-2.5 py-2">
                <span className="text-foreground font-semibold">{profile.title}:</span> {profile.description}
              </p>
            ))}
          </div>
        </div>

        <div className="grid gap-4 mb-4">
          <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-sunken))] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-body font-semibold text-foreground">Full Port Scan</p>
                <p className="text-[11px] font-body text-muted-foreground">
                  Scans all TCP ports (1-65535) instead of the bounded default set.
                </p>
              </div>
              <Button
                type="button"
                variant={fullPortScanEnabled ? 'default' : 'outline'}
                size="sm"
                className="text-xs whitespace-nowrap"
                onClick={() => setFullPortScanEnabled((value) => !value)}
              >
                {fullPortScanEnabled ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-sunken))] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-body font-semibold text-foreground">Subdomain Enumeration</p>
                <p className="text-[11px] font-body text-muted-foreground">
                  Enabled runs broad hostname discovery (api/mail/vpn/etc). Disabled checks only root and www hostnames.
                </p>
              </div>
              <Button
                type="button"
                variant={subdomainEnumerationEnabled ? 'default' : 'outline'}
                size="sm"
                className="text-xs whitespace-nowrap"
                onClick={() => setSubdomainEnumerationEnabled((value) => !value)}
              >
                {subdomainEnumerationEnabled ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--status-warn)/0.35)] bg-[hsl(var(--status-warn)/0.1)] px-3 py-2.5 mb-5">
          <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-warn))] mt-0.5 flex-shrink-0" />
          <p className="text-xs font-body text-[hsl(var(--status-warn))]">
            Scans can take time depending on host responsiveness, DNS complexity, and enabled options. Deep scans and full enumeration usually run longer.
          </p>
        </div>

        {isRunning && activeScan && (
          <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--status-safe)/0.3)] bg-[hsl(var(--status-safe)/0.08)] px-3 py-2.5 mb-5">
            <p className="text-xs font-body text-[hsl(var(--status-safe))]">
              Live scan: {activeScan.target} - {activeScan.currentPhase || 'starting'}{etaText ? ` (${etaText})` : ''}
            </p>
          </div>
        )}

        <Button onClick={startSingleTargetScan} className="w-full text-sm" disabled={!targetInput.trim()}>
          Start Scan
        </Button>
      </div>
    </div>
  );
};

export default Scanner;
