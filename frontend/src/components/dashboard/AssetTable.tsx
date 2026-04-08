import { useState } from 'react';
import { getStatusLabel, getQScoreColor } from '@/data/demoData';
import AssetDetailPanel from '@/components/dashboard/AssetDetailPanel';
import type { Asset } from '@/data/demoData';

interface AssetTableProps {
  selectedAssets: Asset[];
}

const AssetTable = ({ selectedAssets }: AssetTableProps) => {
  const [selected, setSelected] = useState<Asset | null>(null);
  const [search, setSearch] = useState('');

  const filtered = selectedAssets.filter(a =>
    a.domain.toLowerCase().includes(search.toLowerCase())
  );

  const statusBgColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-status-critical/10 text-status-critical';
      case 'standard': return 'bg-accent-amber/10 text-accent-amber';
      case 'safe': return 'bg-status-safe/10 text-status-safe';
      case 'elite-pqc': return 'bg-status-safe/10 text-status-safe';
      case 'unknown': return 'bg-status-unknown/10 text-status-unknown';
      default: return 'bg-status-unknown/10 text-status-unknown';
    }
  };

  return (
    <>
      <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] overflow-hidden shadow-[0_18px_42px_-28px_hsl(var(--brand-primary)/0.45)]">
        <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border-default))]">
          <div className="flex items-center gap-3">
            <h3 className="font-body font-bold text-sm text-foreground">Asset Inventory</h3>
            <span className="font-mono text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded">
              {selectedAssets.length} ASSETS
            </span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="font-mono text-xs bg-sunken border border-[hsl(var(--border-default))] rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:border-brand-accent/50"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))] bg-sunken/50">
                {['ASSET', 'TYPE', 'TLS', 'CIPHER SUITE', 'KEY EXCHANGE', 'CERTIFICATE', 'Q-SCORE', 'STATUS'].map(h => (
                  <th key={h} className="font-mono text-[10px] text-muted-foreground uppercase px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr
                  key={a.domain}
                  onClick={() => setSelected(a)}
                  className="border-b border-[hsl(var(--border-default))] last:border-0 hover:bg-sunken/30 cursor-pointer transition-colors"
                >
                  <td className="font-mono text-xs text-foreground px-4 py-3">{a.domain}</td>
                  <td className="font-mono text-[10px] text-muted-foreground px-4 py-3 uppercase">{a.type}</td>
                  <td className="font-mono text-xs text-foreground px-4 py-3">{a.tls}</td>
                  <td className="font-mono text-[10px] text-muted-foreground px-4 py-3 max-w-[200px] truncate">{a.cipher}</td>
                  <td className="font-mono text-xs text-foreground px-4 py-3">{a.keyExchange}</td>
                  <td className="font-mono text-xs text-muted-foreground px-4 py-3">{a.certificate}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold" style={{ color: getQScoreColor(a.qScore) }}>
                      {a.qScore}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${statusBgColor(a.status)}`}>
                      {getStatusLabel(a.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AssetDetailPanel asset={selected} open={!!selected} onClose={() => setSelected(null)} />
    </>
  );
};

export default AssetTable;
