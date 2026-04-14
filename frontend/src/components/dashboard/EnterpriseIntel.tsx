const EnterpriseIntel = () => {
  const homeSummary = [
    { label: 'Domains', value: '8' },
    { label: 'IPs', value: '21' },
    { label: 'Subdomains', value: '14' },
    { label: 'Cloud Assets', value: '3' },
    { label: 'SSL Certs', value: '18' },
    { label: 'Software', value: '12' },
    { label: 'IoT Devices', value: '2' },
    { label: 'Login Forms', value: '5' },
  ];

  const intel = [
    { label: 'Enterprise Score', value: '370 / 1000' },
    { label: 'Tier', value: 'Legacy' },
    { label: 'Negotiation Policies', value: '3 detected' },
    { label: 'PQC Heatmap', value: '14% coverage' },
    { label: 'Top Policy', value: 'RSA Fallback' },
  ];

  return (
    <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-5 shadow-[0_18px_42px_-28px_hsl(var(--brand-primary)/0.45)]">
      <h3 className="font-body font-bold text-sm text-foreground mb-4">Enterprise Intelligence Dashboard</h3>

      <div className="grid grid-cols-2 gap-6">
        {/* Home Summary */}
        <div>
          <span className="font-mono text-[10px] text-muted-foreground uppercase block mb-3">Home Summary</span>
          <div className="space-y-2">
            {homeSummary.map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="font-body text-xs text-[hsl(var(--text-secondary))]">{item.label}</span>
                <span className="font-mono text-xs font-bold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Q-Score Overview + PQC Intel */}
        <div>
          <span className="font-mono text-[10px] text-muted-foreground uppercase block mb-3">Q-Score Overview &amp; PQC Intelligence</span>
          <div className="space-y-2">
            {intel.map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="font-body text-xs text-[hsl(var(--text-secondary))]">{item.label}</span>
                <span className="font-mono text-xs font-bold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseIntel;
