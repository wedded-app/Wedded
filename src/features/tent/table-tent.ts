import QRCode from 'qrcode';

import { Palettes } from '@/constants/theme';

// A printed page is white paper whatever the phone's appearance.
const Colors = Palettes.light;

/** Light squares around the code; scanners need 4 modules of it. */
export const QR_QUIET_ZONE = 4;

/** The QR code as rows of dark (true) and light (false) modules. */
export function qrMatrix(text: string): boolean[][] {
  // Level M still scans with a smudge or a crease through it.
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const rows: boolean[][] = [];
  for (let y = 0; y < modules.size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < modules.size; x++) row.push(Boolean(modules.get(x, y)));
    rows.push(row);
  }
  return rows;
}

/** Each unbroken stretch of dark modules in a row, so it draws as one shape. */
export function darkRuns(row: boolean[]): { start: number; length: number }[] {
  const runs: { start: number; length: number }[] = [];
  let start = -1;
  row.forEach((dark, x) => {
    if (dark && start < 0) start = x;
    if (!dark && start >= 0) {
      runs.push({ start, length: x - start });
      start = -1;
    }
  });
  if (start >= 0) runs.push({ start, length: row.length - start });
  return runs;
}

/** The code as an SVG with its quiet zone, for the printed page. */
export function qrSvg(matrix: boolean[][], label: string): string {
  const size = matrix.length + QR_QUIET_ZONE * 2;
  const path = matrix
    .flatMap((row, y) =>
      darkRuns(row).map(
        ({ start, length }) =>
          `M${start + QR_QUIET_ZONE} ${y + QR_QUIET_ZONE}h${length}v1h-${length}z`,
      ),
    )
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="${escapeHtml(label)}">` +
    `<rect width="${size}" height="${size}" fill="${Colors.qrLight}"/>` +
    `<path d="${path}" fill="${Colors.qrDark}"/></svg>`
  );
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Everything printed on the tent. */
export type TableTent = {
  url: string;
  name: string;
  /** "Founding vendor #1", or null for a vendor without a number. */
  founding: string | null;
  scan: string;
  findUs: string;
};

function panel(tent: TableTent, svg: string, flipped: boolean): string {
  const display = tent.url.replace(/^https?:\/\//, '');
  return `
  <section class="panel${flipped ? ' flipped' : ''}">
    <p class="find">${escapeHtml(tent.findUs)}</p>
    ${tent.founding ? `<p class="founding">${escapeHtml(tent.founding)}</p>` : ''}
    <h1>${escapeHtml(tent.name)}</h1>
    <div class="qr">${svg}</div>
    <p class="scan">${escapeHtml(tent.scan)}</p>
    <p class="url">${escapeHtml(display)}</p>
  </section>`;
}

/**
 * A US Letter page that folds in half into a tent for a front desk or
 * counter: the top half is upside down, so both sides read the right way up
 * once it stands. Each side has the name, the founding number and the QR code.
 */
export function tableTentHtml(tent: TableTent): string {
  const svg = qrSvg(qrMatrix(tent.url), tent.url);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(tent.name)}</title>
<style>
  @page { size: letter portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 8.5in; height: 11in; background: ${Colors.qrLight}; }
  body {
    color: ${Colors.text};
    font-family: -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .panel {
    height: 5.5in;
    padding: 0.35in 0.6in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.06in;
  }
  /* Rotated, so its top border lands on the fold. */
  .flipped { transform: rotate(180deg); border-top: 1px dashed ${Colors.text2}; }
  .find { font-size: 12pt; color: ${Colors.text2}; line-height: 1.35; }
  .founding { font-size: 14pt; font-weight: 700; color: ${Colors.kesari}; }
  h1 { font-size: 24pt; line-height: 1.15; color: ${Colors.primary}; }
  .qr { width: 2in; height: 2in; margin: 0.08in 0; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .scan { font-size: 13pt; font-weight: 600; line-height: 1.4; }
  .url { font-size: 10pt; color: ${Colors.text2}; }
</style>
</head>
<body>${panel(tent, svg, true)}${panel(tent, svg, false)}
</body>
</html>`;
}
