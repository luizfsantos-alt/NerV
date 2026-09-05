// Leitor mínimo de .xlsx — só o necessário: ler a primeira planilha como
// matriz de células.
//
// Por que não SheetJS: são ~900 KB baixados de CDN (quebra o offline, que é o
// cenário principal deste app) e a única versão ainda publicada no npm tem
// CVEs abertas. Um .xlsx é um ZIP de XMLs, e o navegador já sabe descomprimir
// via DecompressionStream. Isso aqui tem ~200 linhas e zero dependências.

/** O ZIP guarda o índice no fim do arquivo: achamos o EOCD de trás para frente. */
function findEOCD(view, bytes) {
  const max = Math.min(bytes.length, 66000);
  for (let i = bytes.length - 22; i >= bytes.length - max && i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

/** Lê o diretório central e devolve {nome: {offset, method, compSize}}. */
function readCentralDirectory(buf) {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const eocd = findEOCD(view, bytes);
  if (eocd < 0) throw new Error('Arquivo .xlsx inválido (não é um ZIP).');

  let count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);

  // ZIP64: quando os campos de 32 bits estouram, o índice real fica no
  // registro ZIP64 logo antes do EOCD.
  if (ptr === 0xffffffff || count === 0xffff) {
    for (let i = eocd - 20; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x07064b50) {
        const z64 = Number(view.getBigUint64(i + 8, true));
        if (view.getUint32(z64, true) === 0x06064b50) {
          count = Number(view.getBigUint64(z64 + 32, true));
          ptr = Number(view.getBigUint64(z64 + 48, true));
        }
        break;
      }
    }
  }

  const entries = {};
  for (let i = 0; i < count && ptr < bytes.length; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOff = view.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    entries[name] = { method, compSize, localOff };
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return { entries, bytes, view };
}

async function inflate(raw) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Navegador sem suporte a descompressão. Exporte a planilha como .csv.');
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([raw]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Extrai um arquivo do ZIP como texto. */
async function readEntry(zip, name) {
  const e = zip.entries[name];
  if (!e) return null;
  const { view, bytes } = zip;
  // O cabeçalho local tem seus próprios tamanhos de nome/extra — precisamos
  // deles para achar onde os dados realmente começam.
  const nameLen = view.getUint16(e.localOff + 26, true);
  const extraLen = view.getUint16(e.localOff + 28, true);
  const start = e.localOff + 30 + nameLen + extraLen;
  const raw = bytes.subarray(start, start + e.compSize);
  const out = e.method === 0 ? raw : await inflate(raw);
  return new TextDecoder('utf-8').decode(out);
}

const XML_ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
function unescapeXml(s) {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, m => XML_ENT[m])
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
          .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** sharedStrings.xml: cada <si> é uma string, possivelmente partida em vários <t>. */
function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    let text = '';
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    while ((t = tRe.exec(m[1]))) text += unescapeXml(t[1]);
    out.push(text);
  }
  return out;
}

/** "BC12" -> 54 (índice de coluna, base 0). */
function colIndex(ref) {
  const letters = (ref.match(/^[A-Z]+/) || ['A'])[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let r;
  while ((r = rowRe.exec(xml))) {
    const cells = [];
    const cRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let c;
    while ((c = cRe.exec(r[1]))) {
      const attrs = c[1] || '';
      const inner = c[2] || '';
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      const type = (attrs.match(/t="([^"]+)"/) || [])[1];
      let val = '';
      if (type === 'inlineStr') {
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let t; while ((t = tRe.exec(inner))) val += unescapeXml(t[1]);
      } else {
        const v = (inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/) || [])[1];
        if (v != null) {
          val = type === 's' ? (shared[parseInt(v)] ?? '') : unescapeXml(v);
        }
      }
      const idx = ref ? colIndex(ref) : cells.length;
      while (cells.length < idx) cells.push('');
      cells[idx] = String(val).trim();
    }
    rows.push(cells);
  }
  return rows;
}

/** Caminho da primeira planilha, seguindo workbook.xml -> rels. */
async function firstSheetPath(zip) {
  const wb = await readEntry(zip, 'xl/workbook.xml');
  const rels = await readEntry(zip, 'xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const rid = (wb.match(/<sheet\b[^>]*r:id="([^"]+)"/) || [])[1];
    if (rid) {
      const re = new RegExp('<Relationship\\b[^>]*Id="' + rid + '"[^>]*Target="([^"]+)"');
      const target = (rels.match(re) || [])[1];
      if (target) {
        const clean = target.replace(/^\/?xl\//, '').replace(/^\//, '');
        if (zip.entries['xl/' + clean]) return 'xl/' + clean;
      }
    }
  }
  // Fallback: qualquer worksheet que exista no pacote.
  const found = Object.keys(zip.entries)
    .filter(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n))
    .sort();
  return found[0] || null;
}

/** Lê um ArrayBuffer de .xlsx e devolve a primeira planilha como matriz. */
export async function readXlsx(arrayBuffer) {
  const zip = readCentralDirectory(arrayBuffer);
  if (!Object.keys(zip.entries).length) throw new Error('Arquivo .xlsx vazio ou corrompido.');
  const sheetPath = await firstSheetPath(zip);
  if (!sheetPath) throw new Error('Nenhuma planilha encontrada no arquivo.');
  const shared = parseSharedStrings(await readEntry(zip, 'xl/sharedStrings.xml'));
  const xml = await readEntry(zip, sheetPath);
  return parseSheet(xml || '', shared);
}

export const xlsxSupported = typeof DecompressionStream !== 'undefined';
