import { darkRuns, escapeHtml, qrMatrix, qrSvg, tableTentHtml, type TableTent } from './table-tent';

const tent: TableTent = {
  url: 'https://weddingapp.example/v/royal-orchard-banquet-hall',
  name: 'Royal Orchard <Banquet> & Hall',
  founding: 'Founding vendor #1',
  scan: 'Scan to see our photos',
  findUs: 'Find us on the app',
};

describe('qrMatrix', () => {
  it('makes a square code with the three finder squares', () => {
    const matrix = qrMatrix(tent.url);
    const size = matrix.length;
    expect(matrix.every((row) => row.length === size)).toBe(true);
    // Each finder pattern has a dark top-left corner and a 7-module dark top edge.
    for (const [x, y] of [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ]) {
      expect(matrix[y].slice(x, x + 7).every(Boolean)).toBe(true);
    }
  });
});

describe('darkRuns', () => {
  it('finds each stretch of dark modules, including one at the end', () => {
    expect(darkRuns([true, true, false, true, false, false, true])).toEqual([
      { start: 0, length: 2 },
      { start: 3, length: 1 },
      { start: 6, length: 1 },
    ]);
    expect(darkRuns([false, false])).toEqual([]);
  });
});

describe('qrSvg', () => {
  it('includes the quiet zone in the view box', () => {
    const matrix = qrMatrix(tent.url);
    const size = matrix.length + 8;
    expect(qrSvg(matrix, 'code')).toContain(`viewBox="0 0 ${size} ${size}"`);
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('tableTentHtml', () => {
  const html = tableTentHtml(tent);

  it('prints both sides, one upside down', () => {
    expect(html.match(/<section class="panel/g)).toHaveLength(2);
    expect(html.match(/class="panel flipped"/g)).toHaveLength(1);
  });

  it('escapes the vendor name and shows the founding number', () => {
    expect(html).toContain('Royal Orchard &lt;Banquet&gt; &amp; Hall');
    expect(html).not.toContain('<Banquet>');
    expect(html).toContain('Founding vendor #1');
  });

  it('shows the link without https://', () => {
    expect(html).toContain('>weddingapp.example/v/royal-orchard-banquet-hall<');
  });

  it('leaves out the founding line when there is no number', () => {
    const plain = tableTentHtml({ ...tent, founding: null });
    expect(plain).not.toContain('class="founding"');
  });
});
