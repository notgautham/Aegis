import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export function triggerDownload(content: BlobPart | BlobPart[], fileName: string, mimeType = 'text/plain;charset=utf-8'): void {
  const parts = Array.isArray(content) ? content : [content];
  const blob = new Blob(parts, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function safeFileSlug(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.replace(/[^a-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '') || 'report';
}

export function toIsoStamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const esc = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => esc(row[header])).join(','));
  });
  return `${lines.join('\n')}\n`;
}

interface PdfSection {
  heading: string;
  lines: string[];
}

interface PdfReportSpec {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
}

function wrapLine(line: string, maxWidth: number, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number): string[] {
  if (!line) return [''];
  const words = line.split(' ');
  const chunks: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      return;
    }

    if (current) chunks.push(current);
    current = word;

    while (font.widthOfTextAtSize(current, size) > maxWidth && current.length > 1) {
      let splitAt = current.length - 1;
      while (splitAt > 1 && font.widthOfTextAtSize(current.slice(0, splitAt), size) > maxWidth) {
        splitAt -= 1;
      }
      chunks.push(current.slice(0, splitAt));
      current = current.slice(splitAt);
    }
  });

  if (current) chunks.push(current);
  return chunks;
}

export async function buildPdfReport(spec: PdfReportSpec): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  const titleSize = 16;
  const subtitleSize = 10;
  const headingSize = 12;
  const bodySize = 9;
  const lineHeight = 12;

  let page = pdf.addPage();
  let { width, height } = page.getSize();
  let y = height - margin;

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight >= margin) return;
    page = pdf.addPage();
    ({ width, height } = page.getSize());
    y = height - margin;
  };

  page.drawText(spec.title, {
    x: margin,
    y,
    size: titleSize,
    font: bold,
    color: rgb(0.06, 0.13, 0.25),
  });
  y -= titleSize + 8;

  if (spec.subtitle) {
    const subtitleLines = wrapLine(spec.subtitle, width - margin * 2, regular, subtitleSize);
    subtitleLines.forEach((line) => {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x: margin,
        y,
        size: subtitleSize,
        font: regular,
        color: rgb(0.35, 0.39, 0.45),
      });
      y -= lineHeight;
    });
    y -= 4;
  }

  spec.sections.forEach((section) => {
    ensureSpace(headingSize + lineHeight + 4);
    page.drawText(section.heading, {
      x: margin,
      y,
      size: headingSize,
      font: bold,
      color: rgb(0.1, 0.16, 0.28),
    });
    y -= headingSize + 4;

    section.lines.forEach((rawLine) => {
      const lines = wrapLine(rawLine, width - margin * 2, regular, bodySize);
      lines.forEach((line) => {
        ensureSpace(lineHeight);
        page.drawText(line, {
          x: margin,
          y,
          size: bodySize,
          font: regular,
          color: rgb(0.16, 0.18, 0.22),
        });
        y -= lineHeight;
      });
    });

    y -= 6;
  });

  return pdf.save();
}
