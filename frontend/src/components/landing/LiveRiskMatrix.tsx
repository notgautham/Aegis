const LiveRiskMatrix = () => {
  const miniAssets = [
    { domain: 'vpn.aegis.com', status: 'CRITICAL', color: 'var(--status-critical)' },
    { domain: 'portal.aegis.com', status: 'VULNERABLE', color: 'var(--status-vuln)' },
    { domain: 'auth.aegis.com', status: 'PQC TRANSITION', color: 'var(--status-warn)' },
    { domain: 'pqc-api.aegis.com', status: 'QUANTUM SAFE', color: 'var(--status-safe)' },
  ];

  return (
    <div className="animate-float">
      <div className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.12)] p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-body text-sm font-semibold text-foreground">Live Risk Matrix</h3>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--accent-amber)/0.1)] text-accent-amber border border-[hsl(var(--accent-amber)/0.2)]">
            SIMULATED DATA <span className="animate-pulse-dot inline-block">●</span>
          </span>
        </div>

        {/* 2x2 grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Algorithm Health */}
          <div className="bg-[hsl(var(--bg-sunken))] rounded-xl p-3">
            <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">Algorithm Health</span>
            <div className="font-mono text-xl font-medium text-foreground mt-1">RSA-2048</div>
            <span className="font-mono text-[10px] text-status-critical">Critical Vulnerability Detected</span>
          </div>
          {/* Risk Index Gauge */}
          <div className="bg-[hsl(var(--bg-sunken))] rounded-xl p-3 flex flex-col items-center justify-center">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--border-default))" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="hsl(var(--status-critical))"
                strokeWidth="4"
                strokeDasharray={`${(84 / 100) * 175.9} 175.9`}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="36" textAnchor="middle" className="font-mono text-lg font-bold" fill="hsl(var(--status-critical))">84</text>
            </svg>
            <span className="font-mono text-[9px] text-muted-foreground mt-1 tracking-wider uppercase">Risk Index</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">Migration Progress</span>
            <span className="font-mono text-[10px] text-muted-foreground">PQC Transition Tier 1</span>
          </div>
          <div className="w-full h-2 bg-[hsl(var(--bg-sunken))] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full animate-fill-progress"
              style={{ background: 'linear-gradient(90deg, hsl(var(--status-critical)), hsl(var(--accent-amber)))' }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground mt-0.5 block">38%</span>
        </div>

        {/* Mini asset list */}
        <div className="space-y-2">
          {miniAssets.map((a) => (
            <div key={a.domain} className="flex items-center justify-between py-1.5 border-t border-[hsl(var(--border-default))]">
              <span className="font-mono text-xs text-foreground">{a.domain}</span>
              <span
                className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `hsl(${a.color} / 0.1)`,
                  color: `hsl(${a.color})`,
                }}
              >
                {a.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating attestation card */}
      <div className="mt-[-20px] ml-[-20px] animate-float" style={{ animationDelay: '1s' }}>
        <div className="bg-white rounded-xl shadow-lg px-4 py-2.5 inline-flex items-center gap-2">
          <span className="text-base">🛡</span>
          <span className="font-mono text-[11px] text-foreground">Ed25519-Signed Attestation · CycloneDX 1.7</span>
        </div>
      </div>
    </div>
  );
};

export default LiveRiskMatrix;
