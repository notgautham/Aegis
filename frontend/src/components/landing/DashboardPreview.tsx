import { motion } from 'framer-motion';

const DashboardPreview = () => {
  const kpis = [
    { label: 'TOTAL ASSETS', value: '21', color: 'text-brand-primary' },
    { label: 'CRITICAL', value: '3', color: 'text-status-critical' },
    { label: 'PQC READY', value: '2', color: 'text-status-safe' },
    { label: 'CYBER SCORE', value: '370', color: 'text-accent-amber' },
  ];

  const tableRows = [
    { asset: 'vpn.pnb.co.in', tls: 'TLS 1.2', qScore: 24, status: 'CRITICAL', statusColor: 'var(--status-critical)' },
    { asset: 'netbanking.pnb.co.in', tls: 'TLS 1.2', qScore: 71, status: 'VULNERABLE', statusColor: 'var(--status-vuln)' },
    { asset: 'auth.pnb.co.in', tls: 'TLS 1.3', qScore: 85, status: 'STANDARD', statusColor: 'var(--status-warn)' },
    { asset: 'pqc-api.pnb.co.in', tls: 'TLS 1.3+', qScore: 100, status: 'ELITE-PQC', statusColor: 'var(--status-safe)' },
  ];

  const sidebarItems = ['🏠 Overview', '🔍 Discovery', '📦 Inventory', '📋 CBOM', '🛡 PQC Posture', '⭐ Cyber Rating', '🔧 Remediation'];

  return (
    <section className="bg-background py-28 lg:py-32 px-6 lg:px-12">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[40%_60%] gap-12 lg:gap-20 items-center">
        {/* Left text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="font-mono text-[11px] text-muted-foreground tracking-wider uppercase">Platform</span>
          <h2 className="font-body font-bold text-3xl lg:text-[40px] text-foreground mt-3 mb-6 leading-tight">
            The dashboard tells the whole story.
          </h2>
          <p className="font-body text-base text-[hsl(var(--text-secondary))] leading-relaxed mb-8">
            Every metric live. Every chart drills down. Click any asset row to open a full profile — TLS version, cipher suite, HNDL break year, and one-click remediation.
          </p>
          <div className="space-y-4">
            {[
              { title: 'Asset Network Graph', desc: 'D3-powered visualization showing which assets are interconnected and how risk propagates.' },
              { title: 'Geographic Distribution', desc: 'World map showing where your assets are hosted, colored by quantum readiness.' },
              { title: 'One-Click Export', desc: 'Executive PDF, CycloneDX 1.7 CBOM JSON, and CDXA compliance reports in seconds.' },
            ].map((f) => (
              <div key={f.title} className="border-l-2 border-accent-amber pl-4">
                <h4 className="font-body font-bold text-sm text-foreground">{f.title}</h4>
                <p className="font-body text-sm text-[hsl(var(--text-secondary))]">{f.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: Mini dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl shadow-[0_32px_100px_rgba(0,0,0,0.12)] overflow-hidden bg-white"
        >
          {/* Top bar */}
          <div className="bg-brand-primary px-4 py-3 flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-accent-amber">AEGIS</span>
            <div className="flex items-center gap-3">
              <span className="font-body text-xs text-white/60">Export PDF · Export CBOM</span>
              <span className="font-body text-xs font-bold bg-accent-amber text-brand-primary px-3 py-1 rounded">▶ RUN SCAN</span>
            </div>
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="w-[140px] border-r border-[hsl(var(--border-default))] bg-white py-3 hidden md:block">
              {sidebarItems.map((item, i) => (
                <div
                  key={item}
                  className={`px-3 py-1.5 font-body text-xs cursor-pointer ${
                    i === 0
                      ? 'border-l-[3px] border-accent-amber bg-accent-amber-light/30 text-foreground font-medium'
                      : 'text-[hsl(var(--text-secondary))] hover:bg-sunken border-l-[3px] border-transparent'
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 bg-background p-3">
              {/* KPIs */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {kpis.map((k) => (
                  <div key={k.label} className="bg-white rounded-lg p-2 border border-[hsl(var(--border-default))]">
                    <span className="font-mono text-[9px] text-muted-foreground uppercase">{k.label}</span>
                    <div className={`font-mono text-lg font-bold ${k.color}`}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Charts placeholder */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* Risk dist */}
                <div className="bg-white rounded-lg p-2 border border-[hsl(var(--border-default))]">
                  <span className="font-mono text-[9px] text-muted-foreground uppercase mb-2 block">Risk Distribution</span>
                  <div className="flex items-end gap-1 h-12">
                    {[
                      { h: '100%', c: 'bg-status-critical' },
                      { h: '80%', c: 'bg-status-vuln' },
                      { h: '60%', c: 'bg-accent-amber' },
                      { h: '30%', c: 'bg-status-safe' },
                      { h: '10%', c: 'bg-status-unknown' },
                    ].map((bar, i) => (
                      <div key={i} className={`flex-1 ${bar.c} rounded-t`} style={{ height: bar.h }} />
                    ))}
                  </div>
                </div>
                {/* Donut */}
                <div className="bg-white rounded-lg p-2 border border-[hsl(var(--border-default))]">
                  <span className="font-mono text-[9px] text-muted-foreground uppercase mb-2 block">PQC Status</span>
                  <div className="flex items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="18" fill="none" stroke="hsl(var(--status-critical))" strokeWidth="6" strokeDasharray="30 113" transform="rotate(-90 24 24)" />
                      <circle cx="24" cy="24" r="18" fill="none" stroke="hsl(var(--accent-amber))" strokeWidth="6" strokeDasharray="60 113" strokeDashoffset="-30" transform="rotate(-90 24 24)" />
                      <circle cx="24" cy="24" r="18" fill="none" stroke="hsl(var(--status-safe))" strokeWidth="6" strokeDasharray="23 113" strokeDashoffset="-90" transform="rotate(-90 24 24)" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-lg border border-[hsl(var(--border-default))] overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border-default))]">
                      {['ASSET', 'TLS', 'Q-SCORE', 'STATUS'].map((h) => (
                        <th key={h} className="font-mono text-[9px] text-muted-foreground uppercase px-2 py-1.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr key={r.asset} className="border-b border-[hsl(var(--border-default))] last:border-0">
                        <td className="font-mono text-[10px] text-foreground px-2 py-1.5">{r.asset}</td>
                        <td className="font-mono text-[10px] text-[hsl(var(--text-secondary))] px-2 py-1.5">{r.tls}</td>
                        <td className="font-mono text-[10px] px-2 py-1.5" style={{ color: r.qScore <= 40 ? 'hsl(var(--status-critical))' : r.qScore <= 70 ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-safe))' }}>
                          {r.qScore}
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `hsl(${r.statusColor} / 0.1)`,
                              color: `hsl(${r.statusColor})`,
                            }}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DashboardPreview;
