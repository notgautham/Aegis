import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Asset } from '@/data/demoData';
import type { AssetResultResponse, ScanResultsResponse } from '@/lib/api';

type CbomDoc = {
  assetId: string;
  hostname: string;
  serialNumber: string | null;
  createdAt: string | null;
  cbomJson: Record<string, unknown>;
};

export type ExportFormat = 'json' | 'xml' | 'csv' | 'pdf' | 'html' | 'cdxa';

export type ExportContext = {
  selectedScanId: string;
  selectedScanResults: ScanResultsResponse | null;
  selectedAssets: Asset[];
  selectedAssetResults: AssetResultResponse[];
};

type ExportArtifact = {
  filename: string;
  content: string | Uint8Array;
  mimeType: string;
};

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

function toXmlNode(tag: string, value: unknown): string {
  if (value === null || value === undefined) {
    return `<${tag}/>`;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => toXmlNode('item', item)).join('');
    return `<${tag}>${items}</${tag}>`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const inner = entries.map(([key, nested]) => toXmlNode(key, nested)).join('');
    return `<${tag}>${inner}</${tag}>`;
  }

  return `<${tag}>${escapeXml(String(value))}</${tag}>`;
}

function downloadArtifact(artifact: ExportArtifact) {
  const blobPart: BlobPart = typeof artifact.content === 'string'
    ? artifact.content
    : Uint8Array.from(artifact.content);
  const blob = new Blob([blobPart], { type: artifact.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = artifact.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractCbomDocuments(assetResults: AssetResultResponse[]): CbomDoc[] {
  return assetResults
    .map((assetResult) => {
      if (!isRecord(assetResult.cbom)) return null;
      const cbomJson = isRecord(assetResult.cbom.cbom_json) ? assetResult.cbom.cbom_json : null;
      if (!cbomJson) return null;

      return {
        assetId: assetResult.asset_id,
        hostname: assetResult.hostname ?? assetResult.ip_address ?? assetResult.asset_id,
        serialNumber: typeof assetResult.cbom.serial_number === 'string' ? assetResult.cbom.serial_number : null,
        createdAt: typeof assetResult.cbom.created_at === 'string' ? assetResult.cbom.created_at : null,
        cbomJson,
      };
    })
    .filter((document): document is CbomDoc => document !== null);
}

function toCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header] ?? '')).join(',')),
  ].join('\n');
}

function buildCycloneDxFallback(context: ExportContext) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    serialNumber: `urn:uuid:${context.selectedScanId}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      component: {
        type: 'application',
        name: 'Aegis Scan',
        version: context.selectedScanId,
      },
      properties: [
        { name: 'aegis:target', value: context.selectedScanResults?.target ?? 'unknown' },
      ],
    },
    components: context.selectedAssets.map((asset) => ({
      type: 'service',
      name: asset.domain,
      version: `${asset.tls} | ${asset.cipher}`,
      purl: `pkg:generic/${asset.domain}@${asset.port}`,
      properties: [
        { name: 'aegis:ip', value: asset.ip || 'unknown' },
        { name: 'aegis:key_exchange', value: asset.keyExchange },
        { name: 'aegis:certificate_authority', value: asset.certInfo.certificate_authority },
        { name: 'aegis:q_score', value: String(asset.qScore) },
      ],
    })),
  };
}

function buildJsonArtifact(context: ExportContext): ExportArtifact {
  const cbomDocuments = extractCbomDocuments(context.selectedAssetResults);
  const fallback = buildCycloneDxFallback(context);

  const payload = cbomDocuments.length > 0
    ? {
        scan_id: context.selectedScanId,
        target: context.selectedScanResults?.target ?? null,
        exported_at: new Date().toISOString(),
        documents: cbomDocuments.map((document) => ({
          asset_id: document.assetId,
          hostname: document.hostname,
          serial_number: document.serialNumber,
          created_at: document.createdAt,
          cbom_json: document.cbomJson,
        })),
      }
    : fallback;

  return {
    filename: `aegis-cbom-${context.selectedScanId}.json`,
    content: JSON.stringify(payload, null, 2),
    mimeType: 'application/json',
  };
}

function buildXmlArtifact(context: ExportContext): ExportArtifact {
  const jsonPayload = JSON.parse(String(buildJsonArtifact(context).content));
  const xmlBody = toXmlNode('cbomExport', jsonPayload);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}`;

  return {
    filename: `aegis-cbom-${context.selectedScanId}.xml`,
    content: xml,
    mimeType: 'application/xml',
  };
}

function buildCsvArtifact(context: ExportContext): ExportArtifact {
  const rows = context.selectedAssets.map((asset) => ({
    asset: asset.domain,
    port: asset.port,
    ip_address: asset.ip,
    tls: asset.tls,
    cipher_suite: asset.cipher,
    key_exchange: asset.keyExchange,
    certificate_algorithm: asset.certInfo.signature_algorithm,
    certificate_authority: asset.certInfo.certificate_authority,
    q_score: asset.qScore,
    status: asset.status,
  }));

  return {
    filename: `aegis-cbom-inventory-${context.selectedScanId}.csv`,
    content: toCsv(rows),
    mimeType: 'text/csv;charset=utf-8',
  };
}

function buildHtmlArtifact(context: ExportContext): ExportArtifact {
  const rows = context.selectedAssets
    .map((asset) => `
      <tr>
        <td>${escapeXml(asset.domain)}</td>
        <td>${asset.port}</td>
        <td>${escapeXml(asset.tls)}</td>
        <td>${escapeXml(asset.cipher)}</td>
        <td>${escapeXml(asset.certInfo.certificate_authority)}</td>
        <td>${asset.qScore}</td>
      </tr>
    `)
    .join('');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Aegis CBOM Report</title>
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 24px; color: #111827; }
      h1 { margin-bottom: 4px; }
      p { color: #4b5563; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
      th { background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>Aegis CBOM Export</h1>
    <p>Scan: ${escapeXml(context.selectedScanId)} | Target: ${escapeXml(context.selectedScanResults?.target ?? 'unknown')}</p>
    <p>Generated at: ${new Date().toISOString()}</p>
    <table>
      <thead>
        <tr>
          <th>Asset</th>
          <th>Port</th>
          <th>TLS</th>
          <th>Cipher</th>
          <th>CA</th>
          <th>Q-Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;

  return {
    filename: `aegis-cbom-${context.selectedScanId}.html`,
    content: html,
    mimeType: 'text/html;charset=utf-8',
  };
}

async function buildPdfArtifact(context: ExportContext): Promise<ExportArtifact> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 560;
  page.drawText('Aegis CBOM Export Report', { x: 40, y, size: 16, font: bold, color: rgb(0.1, 0.15, 0.25) });
  y -= 22;
  page.drawText(`Scan: ${context.selectedScanId}`, { x: 40, y, size: 10, font });
  y -= 14;
  page.drawText(`Target: ${context.selectedScanResults?.target ?? 'unknown'}`, { x: 40, y, size: 10, font });
  y -= 14;
  page.drawText(`Generated: ${new Date().toISOString()}`, { x: 40, y, size: 10, font });
  y -= 24;

  const headers = ['Asset', 'Port', 'TLS', 'CA', 'Q'];
  const x = [40, 360, 420, 520, 760];
  headers.forEach((header, index) => {
    page.drawText(header, { x: x[index], y, size: 10, font: bold });
  });
  y -= 12;

  const rows = context.selectedAssets.slice(0, 28);
  rows.forEach((asset) => {
    page.drawText(asset.domain.slice(0, 45), { x: 40, y, size: 9, font });
    page.drawText(String(asset.port), { x: 360, y, size: 9, font });
    page.drawText(asset.tls, { x: 420, y, size: 9, font });
    page.drawText(asset.certInfo.certificate_authority.slice(0, 22), { x: 520, y, size: 9, font });
    page.drawText(String(asset.qScore), { x: 760, y, size: 9, font });
    y -= 14;
  });

  if (context.selectedAssets.length > rows.length) {
    page.drawText(`... ${context.selectedAssets.length - rows.length} additional assets omitted in this PDF summary.`, {
      x: 40,
      y: Math.max(40, y - 6),
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  const bytes = await pdf.save();
  return {
    filename: `aegis-cbom-${context.selectedScanId}.pdf`,
    content: bytes,
    mimeType: 'application/pdf',
  };
}

function buildCdxaArtifact(context: ExportContext): ExportArtifact {
  const digestSource = context.selectedAssets
    .map((asset) => `${asset.domain}:${asset.port}:${asset.qScore}:${asset.cipher}:${asset.keyExchange}`)
    .sort()
    .join('|');

  let checksum = 0;
  for (let index = 0; index < digestSource.length; index += 1) {
    checksum = (checksum + digestSource.charCodeAt(index) * (index + 1)) % 0xffffffff;
  }

  const payload = {
    schema: 'aegis-cdxa-1.0',
    scan_id: context.selectedScanId,
    target: context.selectedScanResults?.target ?? null,
    exported_at: new Date().toISOString(),
    attestation: {
      asset_count: context.selectedAssets.length,
      checksum_hex: checksum.toString(16).padStart(8, '0'),
      statement: 'This attestation package was generated deterministically from the selected scan payload.',
    },
  };

  return {
    filename: `aegis-attestation-${context.selectedScanId}.cdxa`,
    content: JSON.stringify(payload, null, 2),
    mimeType: 'application/json',
  };
}

export async function exportCbomFormat(format: ExportFormat, context: ExportContext): Promise<void> {
  let artifact: ExportArtifact;

  switch (format) {
    case 'json':
      artifact = buildJsonArtifact(context);
      break;
    case 'xml':
      artifact = buildXmlArtifact(context);
      break;
    case 'csv':
      artifact = buildCsvArtifact(context);
      break;
    case 'pdf':
      artifact = await buildPdfArtifact(context);
      break;
    case 'html':
      artifact = buildHtmlArtifact(context);
      break;
    case 'cdxa':
      artifact = buildCdxaArtifact(context);
      break;
    default:
      return;
  }

  downloadArtifact(artifact);
}
