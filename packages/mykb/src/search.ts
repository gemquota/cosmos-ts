// MyKB — Hybrid Search Engine (ported from search_fusion.py)
// Structure-aware markdown chunking, BM25 sparse index, TF-IDF dense vector index,
// Reciprocal Rank Fusion (RRF), batch ingestion, and unified search API.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, sep, normalize } from 'path';
import { createServer, IncomingMessage, ServerResponse } from 'http';

// ── Constants ──────────────────────────────────────────────────

const RRF_K = 60; // RRF smoothing constant
const MAX_CHUNK_SIZE = 4000; // max chars per chunk (fallback for very long sections)
const INDEX_FILENAME = 'hybrid_index.json';

// ── Existing Types ────────────────────────────────────────────

export interface SearchResult {
  path: string;
  title: string;
  score: number;
}

export interface SearchChunkResult {
  rank: number;
  score: number;
  source: string;
  header: string;
  headerChain: string;
  snippet: string;
  hasCode: boolean;
  signatures: Array<{ type: string; name: string; language: string }>;
  size: number;
}

export interface SearchIndex {
  paths: string[];
  docs: string[];
  idf: Record<string, number>;
  builtAt?: string;
}

export interface HybridIndexData {
  numChunks: number;
  vocabSize?: number;
  builtAt?: string;
}

// ── New Types (from search_fusion.py) ─────────────────────────

export interface CodeBlock {
  language: string;
  code: string;
}

export interface Signature {
  type: string;
  name: string;
  language: string;
}

export interface Chunk {
  source: string;
  header: string;
  headerChain: string;
  headerLevel: number;
  body: string;
  size: number;
  hasCode: boolean;
  codeBlocks: CodeBlock[];
  signatures: Signature[];
}

export interface HybridSearchIndex {
  chunks: Chunk[];
  vocab: string[];
  bm25Params: {
    docFreq: Record<string, number>;
    avgDocLen: number;
    numDocs: number;
    idf: Record<string, number>;
  };
  vectors: number[][];
  builtAt: string;
  numChunks: number;
}

// ── Existing Search Index Loader ───────────────────────────────

let _searchIndex: SearchIndex | null = null;

export function loadSearchIndex(indexDir: string): SearchIndex | null {
  if (_searchIndex) return _searchIndex;

  const indexPath = join(indexDir, 'search_index.json');
  if (!existsSync(indexPath)) {
    console.warn(`   Search index not found: ${indexPath}`);
    return null;
  }

  try {
    const data = readFileSync(indexPath, 'utf-8');
    _searchIndex = JSON.parse(data) as SearchIndex;
    console.log(`   Search index: ${_searchIndex.paths.length} docs`);
    return _searchIndex;
  } catch (e) {
    console.error(`   Search index: failed to load (${e})`);
    return null;
  }
}

export function clearSearchIndexCache(): void {
  _searchIndex = null;
}

// ── Existing TF-IDF Search (ported from server.py) ────────────

export function searchQuery(
  index: SearchIndex,
  wikiDir: string,
  q: string,
  limit = 20,
): SearchResult[] {
  if (!q.trim()) return [];

  const queryText = q.toLowerCase().trim();
  const queryWords = [...queryText.matchAll(/[a-z0-9]+/g)].map((m) => m[0]);
  if (queryWords.length === 0) return [];

  const scores: Array<{ score: number; idx: number }> = [];

  for (let i = 0; i < index.docs.length; i++) {
    const docWords = index.docs[i].split(/\s+/);
    const docLen = Math.max(docWords.length, 1);
    let score = 0;

    for (const w of queryWords) {
      const idf = index.idf[w];
      if (idf !== undefined) {
        const tf = docWords.filter((dw) => dw === w).length / docLen;
        score += tf * idf;
      }
    }

    if (score > 0) {
      scores.push({ score, idx: i });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  const results: SearchResult[] = [];
  for (const { score, idx } of scores.slice(0, limit)) {
    const fullPath = index.paths[idx];
    const relPath = relative(wikiDir, fullPath).replace(/\\/g, '/');
    let title = '';
    try {
      const first = readFileSync(fullPath, 'utf-8').slice(0, 300);
      const m = first.match(/title:\s*"?([^"\n]+)"?/);
      title = m ? m[1] : fullPath.split(sep).pop()?.replace('.md', '') ?? '';
    } catch {
      title = fullPath.split(sep).pop()?.replace('.md', '') ?? '';
    }

    results.push({
      path: relPath,
      title,
      score: Math.round(score * 1000) / 1000,
    });
  }

  return results;
}

// ── Existing Reciprocal Rank Fusion ────────────────────────────

export function reciprocalRankFusion(
  lists: Array<Array<{ index: number; score: number }>>,
  k = 60,
): Array<{ index: number; rrfScore: number }> {
  const fusedScores = new Map<number, number>();

  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const idx = list[rank].index;
      fusedScores.set(idx, (fusedScores.get(idx) ?? 0) + 1 / (k + rank + 1));
    }
  }

  return [...fusedScores.entries()]
    .map(([index, rrfScore]) => ({ index, rrfScore }))
    .sort((a, b) => b.rrfScore - a.rrfScore);
}

// ═══════════════════════════════════════════════════════════════
// ── New: Structure-Aware Markdown Chunking (Epic 2) ──────────
// ═══════════════════════════════════════════════════════════════

/**
 * Split markdown at #, ##, ### headers. Returns list of chunks with metadata.
 */
export function chunkMarkdown(text: string, sourcePath: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = text.split('\n');

  let currentHeader: string | null = null;
  let currentHeaderLevel = 0;
  let currentLines: string[] = [];
  const parentHeaders: string[] = [];

  function flush(): void {
    if (currentLines.length === 0) return;
    const body = currentLines.join('\n').trim();
    if (!body) return;

    // Build header chain
    const headerChain = parentHeaders.filter(Boolean).join(' > ');

    // Detect code blocks
    const codeBlocks: CodeBlock[] = [];
    let inCode = false;
    let codeLang = '';
    let codeLines: string[] = [];

    for (const line of currentLines) {
      if (line.startsWith('```')) {
        if (inCode) {
          codeBlocks.push({ language: codeLang, code: codeLines.join('\n') });
          codeLines = [];
          inCode = false;
        } else {
          codeLang = line.slice(3).trim();
          inCode = true;
        }
      } else if (inCode) {
        codeLines.push(line);
      }
    }

    const chunk: Chunk = {
      source: sourcePath,
      header: currentHeader ?? '',
      headerChain,
      headerLevel: currentHeaderLevel,
      body: body.slice(0, MAX_CHUNK_SIZE),
      size: body.length,
      hasCode: codeBlocks.length > 0,
      codeBlocks: codeBlocks.slice(0, 3), // cap at 3 blocks per chunk
      signatures: extractSignatures(codeBlocks),
    };
    chunks.push(chunk);
  }

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flush();
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      // Update parent header stack
      while (parentHeaders.length >= level) {
        parentHeaders.pop();
      }
      parentHeaders.push(title);

      currentHeader = title;
      currentHeaderLevel = level;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  flush();
  return chunks;
}

/**
 * Extract function/class signatures from code blocks.
 */
export function extractSignatures(codeBlocks: CodeBlock[]): Signature[] {
  const sigs: Signature[] = [];

  for (const block of codeBlocks) {
    const code = block.code;

    // Python functions
    const pyFuncRegex = /^\s*(?:async\s+)?def\s+(\w+)\s*\(/gm;
    let m: RegExpExecArray | null;
    while ((m = pyFuncRegex.exec(code)) !== null) {
      sigs.push({ type: 'function', name: m[1], language: 'python' });
    }

    // Python classes
    const pyClassRegex = /^\s*class\s+(\w+)/gm;
    while ((m = pyClassRegex.exec(code)) !== null) {
      sigs.push({ type: 'class', name: m[1], language: 'python' });
    }

    // JS/TS functions (function name, const name =)
    const jsFuncRegex = /(?:function|const)\s+(\w+)\s*(?:=|\(|\s*:\s*(?:async\s+)?\()/gm;
    while ((m = jsFuncRegex.exec(code)) !== null) {
      sigs.push({ type: 'function', name: m[1], language: 'javascript' });
    }

    // JS/TS classes
    const jsClassRegex = /^\s*class\s+(\w+)/gm;
    while ((m = jsClassRegex.exec(code)) !== null) {
      sigs.push({ type: 'class', name: m[1], language: 'javascript' });
    }
  }

  return sigs;
}

/**
 * Walk wiki directory and chunk all markdown files.
 */
export function buildChunksFromWiki(bundleDir?: string): { chunks: Chunk[]; fileCount: number } {
  const baseDir = bundleDir ?? process.cwd();
  const allChunks: Chunk[] = [];
  let fileCount = 0;

  const skipDirs = new Set(['.git', '__pycache__', 'node_modules', '.okf-skill', '.obsidian', '.wiki-daemon', 'hooks']);

  const walk = (dir: string): void => {
    let items: string[];
    try {
      items = readdirSync(dir);
    } catch {
      return;
    }

    for (const item of items) {
      if (item.startsWith('.') || skipDirs.has(item)) continue;
      const full = join(dir, item);
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(full);
      } else if (item.endsWith('.md')) {
        // Skip export files
        if (item === 'mykb-code.md' || item === 'mykb-docs.md') continue;
        fileCount++;
        try {
          const text = readFileSync(full, 'utf-8');
          const sourcePath = relative(baseDir, full).replace(/\\/g, '/');
          const chunks = chunkMarkdown(text, sourcePath);
          allChunks.push(...chunks);
        } catch {
          // Skip unreadable files
        }
      }
    }
  };

  walk(baseDir);
  return { chunks: allChunks, fileCount };
}

// ═══════════════════════════════════════════════════════════════
// ── New: BM25 + TF-IDF Index Building ────────────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * Tokenize text into lowercase word tokens.
 */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Compute BM25 scores for a query against a set of document term frequencies.
 */
function computeBM25Scores(
  queryTokens: string[],
  docTermFreqs: string[][],
  docFreq: Record<string, number>,
  avgDocLen: number,
  numDocs: number,
  k1 = 1.5,
  b = 0.75,
): number[] {
  const scores: number[] = [];

  for (let i = 0; i < docTermFreqs.length; i++) {
    const terms = docTermFreqs[i];
    const docLen = terms.length;
    let score = 0;

    for (const qt of queryTokens) {
      const df = docFreq[qt] ?? 0;
      if (df === 0) continue;
      const idf = Math.log(1 + (numDocs - df + 0.5) / (df + 0.5));
      const tf = terms.filter((t) => t === qt).length;
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen))));
    }

    scores.push(score);
  }

  return scores;
}

/**
 * Compute TF-IDF vector for a document.
 */
function computeTfidfVector(terms: string[], vocab: string[], idf: Record<string, number>): number[] {
  const vector = new Array(vocab.length).fill(0);
  const termCounts = new Map<string, number>();
  for (const t of terms) {
    termCounts.set(t, (termCounts.get(t) ?? 0) + 1);
  }
  const docLen = Math.max(terms.length, 1);

  for (let i = 0; i < vocab.length; i++) {
    const term = vocab[i];
    const count = termCounts.get(term) ?? 0;
    if (count > 0) {
      const tf = count / docLen;
      const idfVal = idf[term] ?? 0;
      vector[i] = tf * idfVal;
    }
  }

  return vector;
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Build BM25 + TF-IDF hybrid indices from chunks.
 */
export function buildIndices(chunks: Chunk[]): HybridSearchIndex {
  // Tokenize all chunk bodies
  const tokenizedDocs: string[][] = chunks.map((c) => tokenize(c.body));

  // Build vocabulary from all tokens
  const vocabSet = new Set<string>();
  for (const doc of tokenizedDocs) {
    for (const t of doc) {
      vocabSet.add(t);
    }
  }
  const vocab = [...vocabSet].sort();

  // Compute document frequency for BM25
  const docFreq: Record<string, number> = {};
  for (const doc of tokenizedDocs) {
    const seen = new Set(doc);
    for (const t of seen) {
      docFreq[t] = (docFreq[t] ?? 0) + 1;
    }
  }

  // Compute average document length
  const docLengths = tokenizedDocs.map((d) => d.length);
  const avgDocLen = docLengths.reduce((a, b) => a + b, 0) / Math.max(docLengths.length, 1);

  // Compute IDF for TF-IDF
  const numDocs = tokenizedDocs.length;
  const idf: Record<string, number> = {};
  for (const t of vocab) {
    const df = docFreq[t] ?? 0;
    idf[t] = Math.log((numDocs + 1) / (df + 1)) + 1;
  }

  // Build TF-IDF vectors
  const vectors: number[][] = tokenizedDocs.map((doc) => computeTfidfVector(doc, vocab, idf));

  return {
    chunks,
    vocab,
    bm25Params: {
      docFreq,
      avgDocLen,
      numDocs,
      idf,
    },
    vectors,
    builtAt: new Date().toISOString(),
    numChunks: chunks.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// ── New: Save / Load Hybrid Index ────────────────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * Save hybrid search index to disk.
 */
export function saveHybridIndex(indexData: HybridSearchIndex, indexDir?: string): void {
  const dir = indexDir ?? process.cwd();
  const indexPath = join(dir, INDEX_FILENAME);

  // Convert vectors to a compact JSON-friendly format (arrays of numbers)
  // and store as a plain object
  const data = {
    chunks: indexData.chunks,
    vocab: indexData.vocab,
    bm25Params: indexData.bm25Params,
    vectors: indexData.vectors,
    builtAt: indexData.builtAt,
    numChunks: indexData.numChunks,
  };

  writeFileSync(indexPath, JSON.stringify(data), 'utf-8');
  console.log(`   Hybrid index saved: ${indexPath} (${indexData.numChunks} chunks, ${indexData.vocab.length} terms)`);
}

/**
 * Load hybrid search index from disk.
 */
export function loadHybridIndex(indexDir?: string): HybridSearchIndex | null {
  const dir = indexDir ?? process.cwd();
  const indexPath = join(dir, INDEX_FILENAME);

  if (!existsSync(indexPath)) {
    console.warn(`   Hybrid index not found: ${indexPath}`);
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(indexPath, 'utf-8')) as HybridSearchIndex;
    console.log(`   Hybrid index loaded: ${data.numChunks} chunks, ${data.vocab.length} terms`);
    return data;
  } catch (e) {
    console.error(`   Hybrid index: failed to load (${e})`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// ── New: Hybrid Search Query ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * Run a hybrid search query using BM25 + TF-IDF with RRF fusion.
 */
export function searchHybridQuery(
  indexData: HybridSearchIndex,
  queryText: string,
  topN = 30,
): SearchChunkResult[] {
  if (!queryText.trim()) return [];

  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) return [];

  // ── BM25 scoring ──
  const tokenizedDocs: string[][] = indexData.chunks.map((c) => tokenize(c.body));
  const bm25Scores = computeBM25Scores(
    queryTokens,
    tokenizedDocs,
    indexData.bm25Params.docFreq,
    indexData.bm25Params.avgDocLen,
    indexData.bm25Params.numDocs,
  );

  // Rank BM25 results
  const bm25Results: Array<{ index: number; score: number }> = bm25Scores
    .map((score, idx) => ({ index: idx, score }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  // ── TF-IDF vector scoring (cosine similarity) ──
  const queryVector = computeTfidfVector(queryTokens, indexData.vocab, indexData.bm25Params.idf);
  const tfidfScores = indexData.vectors.map((vec) => cosineSimilarity(queryVector, vec));

  // Rank TF-IDF results
  const tfidfResults: Array<{ index: number; score: number }> = tfidfScores
    .map((score, idx) => ({ index: idx, score }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  // ── RRF fusion ──
  const fused = reciprocalRankFusion([bm25Results, tfidfResults], RRF_K);

  // Build results
  const results: SearchChunkResult[] = [];
  for (const { index: idx, rrfScore } of fused.slice(0, topN)) {
    const chunk = indexData.chunks[idx];
    if (!chunk) continue;

    results.push({
      rank: results.length + 1,
      score: Math.round(rrfScore * 10000) / 10000,
      source: chunk.source,
      header: chunk.header,
      headerChain: chunk.headerChain,
      snippet: chunk.body.slice(0, 300),
      hasCode: chunk.hasCode,
      signatures: chunk.signatures,
      size: chunk.size,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// ── New: CLI Commands ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

/**
 * Build index from wiki files.
 */
export function cmdBuildIndex(bundleDir?: string, indexDir?: string): HybridSearchIndex {
  const baseDir = bundleDir ?? process.cwd();
  const outDir = indexDir ?? baseDir;

  console.log('Building structure-aware chunks from wiki...');
  const { chunks, fileCount } = buildChunksFromWiki(baseDir);
  console.log(`  ${fileCount} files → ${chunks.length} chunks`);

  console.log('Building hybrid search indices...');
  const indexData = buildIndices(chunks);

  console.log('Saving to disk...');
  saveHybridIndex(indexData, outDir);

  console.log('Done!');
  return indexData;
}

/**
 * Query the hybrid search index.
 */
export function cmdQuery(queryText: string, indexDir?: string): SearchChunkResult[] {
  const indexData = loadHybridIndex(indexDir);
  if (!indexData) {
    console.log('No index found. Run build-index first.');
    return [];
  }

  const results = searchHybridQuery(indexData, queryText, 30);
  console.log(`\nQuery: '${queryText}'`);
  console.log(`Results: ${results.length}\n`);
  for (const r of results.slice(0, 10)) {
    const sigs = r.signatures.slice(0, 2).map((s) => s.name).join(', ');
    const sigStr = sigs ? ` [${sigs}]` : '';
    console.log(`  #${r.rank} (score=${r.score}) ${r.source} → ${r.header}${sigStr}`);
    console.log(`    ${r.snippet.slice(0, 120)}...`);
    console.log('');
  }

  return results;
}

/**
 * Start a lightweight API server for hybrid search.
 */
export function cmdServe(indexDir?: string, port = 8850): void {
  const indexData = loadHybridIndex(indexDir);
  if (!indexData) {
    console.log('No index found. Run build-index first.');
    return;
  }

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'POST' && pathname === '/api/search') {
      let body = '';
      req.on('data', (chunk: string) => { body += chunk; });
      req.on('end', () => {
        try {
          const params = JSON.parse(body || '{}');
          const q = params.q ?? params.query ?? '';
          const topN = parseInt(params.top_n ?? '30', 10);
          const results = q ? searchHybridQuery(indexData, q, topN) : [];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ query: q, results, total: results.length }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad request' }));
        }
      });
      return;
    }

    if (req.method === 'GET') {
      if (pathname === '/api/v2/search/hybrid') {
        const q = url.searchParams.get('q') ?? '';
        const topN = parseInt(url.searchParams.get('top_n') ?? '30', 10);
        const results = q ? searchHybridQuery(indexData, q, topN) : [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ query: q, results, total: results.length }));
        return;
      }

      if (pathname === '/api/v2/search/stats') {
        const stats = {
          chunks: indexData.numChunks,
          vocabSize: indexData.vocab.length,
          indexBuilt: indexData.builtAt,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  console.log(`Search API server on http://localhost:${port}`);
  server.listen(port, '0.0.0.0');
}
