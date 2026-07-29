// MyKB — Wiki HTTP Server (ported from server.py)
// Serves .md files from a wiki directory with auto-discovery,
// syntax highlighting, dark mode, search, and API endpoints.

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, normalize, sep, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadSearchIndex, searchQuery, type SearchResult } from './search.js';
import { extractFrontmatter } from './markdown.js';

// ── Types ──────────────────────────────────────────────────────

export interface WikiServerOptions {
  port?: number;
  wikiDir?: string;
  searchDir?: string;
}

export interface SystemStats {
  files: {
    total: number;
    entities: number;
    sessions: number;
    domains: number;
  };
  sizes: {
    totalBytes: number;
    smallest: { path: string; size: number } | null;
    largest: { path: string; size: number } | null;
  };
  graph: {
    nodes: number;
    edges: number;
  };
  domains: Record<string, number>;
  tags: Record<string, number>;
}

// Determine the directory of the current module (ESM-compatible).
function moduleDir(metaUrl: string): string {
  return fileURLToPath(new URL('.', metaUrl).href);
}

// Default wiki dir: resolve relative to this file's location.
// In the package structure: packages/mykb/src/server.ts -> wiki/ is expected alongside.
let _defaultWikiDir: string | null = null;
export function getDefaultWikiDir(metaUrl: string): string {
  if (_defaultWikiDir) return _defaultWikiDir;
  // Walk up from src/ to find a wiki/ directory, or default to the package root
  const srcDir = moduleDir(metaUrl);
  // Try: packages/mykb/wiki/
  const candidate = join(srcDir, '..', 'wiki');
  if (existsSync(candidate)) {
    _defaultWikiDir = resolve(candidate);
  } else {
    // Fallback: the mykb package root
    _defaultWikiDir = resolve(srcDir, '..');
  }
  return _defaultWikiDir;
}

// ── WikiServer Class ──────────────────────────────────────────

export class WikiServer {
  private port: number;
  private wikiDir: string;
  private searchDir: string;
  private searchIndex: ReturnType<typeof loadSearchIndex>;

  constructor(options: WikiServerOptions = {}) {
    this.port = options.port ?? 8765;
    this.wikiDir = options.wikiDir ?? resolve(process.cwd());
    this.searchDir = options.searchDir ?? join(this.wikiDir, '.wiki-daemon');
    this.searchIndex = loadSearchIndex(this.searchDir);
  }

  /**
   * Start the HTTP server.
   */
  start(): void {
    const server = createServer((req, res) => this.handleRequest(req, res));

    // Count .md files
    const mdCount = this.countMdFiles();

    console.log(`📄 md — Self-Contained Documentation Viewer`);
    console.log(`   Serving: ${this.wikiDir}`);
    console.log(`   .md files: ${mdCount}`);
    console.log(`   URL: http://localhost:${this.port}`);
    console.log(`   Auto-discovers files recursively from all subdirectories`);

    // Check daemon buffer directory health
    this.checkBufferHealth();

    server.listen(this.port, '0.0.0.0');
  }

  // ── Request Handler ──────────────────────────────────────────

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? '/';
    const [pathname, queryString] = url.split('?');
    const params = this.parseQuery(queryString ?? '');

    // CORS headers for all responses
    const setCors = () => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    };
    setCors();

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // ── API: File content ──
      if (pathname === '/api/file') {
        this.handleApiFile(params, res);
        return;
      }

      // ── API: Search ──
      if (pathname === '/api/search') {
        this.handleApiSearch(params, res);
        return;
      }

      // ── API: Stats ──
      if (pathname === '/api/stats') {
        this.handleApiStats(res);
        return;
      }

      // ── API: Graph ──
      if (pathname === '/api/v2/graph') {
        this.handleApiGraph(res);
        return;
      }

      // ── API: Temporal History Snapshot ──
      if (pathname === '/api/v2/history/snapshot') {
        this.sendJson(res, { error: 'Temporal engine not available in TypeScript port' });
        return;
      }

      // ── API: Build search index ──
      if (pathname === '/api/v2/search/build') {
        this.sendJson(res, { error: 'Search build not available in TypeScript port (use Python daemon)' });
        return;
      }

      // ── Files list ──
      if (pathname === '/files.json') {
        this.handleFilesJson(res);
        return;
      }

      // ── Static file serving ──
      this.serveStatic(pathname, res);
    } catch (err) {
      this.sendJson(res, { error: String(err) }, 500);
    }
  }

  // ── /api/file?path= ─────────────────────────────────────────

  private handleApiFile(params: Record<string, string>, res: ServerResponse): void {
    const filepath = params['path'];
    if (!filepath) {
      this.sendJson(res, { error: 'Missing path parameter' });
      return;
    }

    const safe = this.safePath(filepath);
    if (!safe) {
      this.sendJson(res, { error: 'Path traversal blocked' });
      return;
    }

    if (!existsSync(safe) || !statSync(safe).isFile()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found: ' + filepath }));
      return;
    }

    try {
      const md = readFileSync(safe, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(md, 'utf-8');
    } catch (err) {
      this.sendJson(res, { error: String(err) });
    }
  }

  // ── /api/search?q= ──────────────────────────────────────────

  private handleApiSearch(params: Record<string, string>, res: ServerResponse): void {
    const q = params['q'] ?? '';
    if (!q.trim() || !this.searchIndex) {
      this.sendJson(res, { results: [] });
      return;
    }

    const results = searchQuery(this.searchIndex, this.wikiDir, q);
    this.sendJson(res, { query: q, results });
  }

  // ── /api/stats ──────────────────────────────────────────────

  private handleApiStats(res: ServerResponse): void {
    const stats = this.gatherSystemStats();
    this.sendJson(res, stats);
  }

  // ── /api/v2/graph ───────────────────────────────────────────

  private handleApiGraph(res: ServerResponse): void {
    const graphPath = join(this.searchDir, 'graph.json');
    if (!existsSync(graphPath)) {
      this.sendJson(res, { nodes: [], edges: [] });
      return;
    }
    try {
      const data = JSON.parse(readFileSync(graphPath, 'utf-8'));
      this.sendJson(res, data);
    } catch {
      this.sendJson(res, { error: 'Failed to parse graph.json' });
    }
  }

  // ── /files.json ─────────────────────────────────────────────

  private handleFilesJson(res: ServerResponse): void {
    const mdFiles: string[] = [];
    this.walkMdFiles(this.wikiDir, mdFiles);
    mdFiles.sort();
    this.sendJson(res, mdFiles);
  }

  // ── Static File Serving ─────────────────────────────────────

  private serveStatic(pathname: string, res: ServerResponse): void {
    // Default to index.html for directory roots
    let filePath = pathname === '/' ? '/index.html' : pathname;
    const fullPath = this.safePath(filePath);

    if (!fullPath) {
      this.sendJson(res, { error: 'Path traversal blocked' }, 403);
      return;
    }

    // Try exact file first
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      this.sendFile(fullPath, res);
      return;
    }

    // Try index.html for directories
    const indexPath = join(fullPath, 'index.html');
    if (existsSync(indexPath)) {
      this.sendFile(indexPath, res);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  // ── Utilities ───────────────────────────────────────────────

  private sendJson(res: ServerResponse, data: unknown, status = 200): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify(data));
  }

  private sendFile(filePath: string, res: ServerResponse): void {
    const ext = extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.ico': 'image/x-icon',
      '.md': 'text/markdown; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.map': 'application/json',
    };

    const contentType = mimeTypes[ext] ?? 'application/octet-stream';
    try {
      const content = readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=3600',
      });
      res.end(content);
    } catch {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }

  private safePath(requestedPath: string): string | null {
    const decoded = decodeURIComponent(requestedPath);
    // Remove query string if present
    const clean = decoded.split('?')[0];
    const resolved = resolve(normalize(join(this.wikiDir, clean)));
    if (!resolved.startsWith(this.wikiDir)) {
      return null;
    }
    return resolved;
  }

  private parseQuery(queryString: string): Record<string, string> {
    const params: Record<string, string> = {};
    if (!queryString) return params;
    for (const part of queryString.split('&')) {
      const [key, value] = part.split('=').map((s) => decodeURIComponent(s.replace(/\+/g, ' ')));
      if (key) params[key] = value ?? '';
    }
    return params;
  }

  private countMdFiles(): number {
    let count = 0;
    try {
      const walk = (dir: string): void => {
        const items = readdirSync(dir);
        for (const item of items) {
          if (item.startsWith('.')) continue;
          const full = join(dir, item);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            walk(full);
          } else if (item.endsWith('.md')) {
            count++;
          }
        }
      };
      walk(this.wikiDir);
    } catch {
      // ignore
    }
    return count;
  }

  private walkMdFiles(dir: string, results: string[]): void {
    let items: string[];
    try {
      items = readdirSync(dir);
    } catch {
      return;
    }

    for (const item of items) {
      if (item.startsWith('.') || item === '__pycache__') continue;
      const full = join(dir, item);
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        this.walkMdFiles(full, results);
      } else if (item.endsWith('.md')) {
        const rel = relative(this.wikiDir, full).replace(/\\/g, '/');
        results.push(rel);
      }
    }
  }

  private checkBufferHealth(): void {
    const bufferDir = join(this.searchDir, 'buffers');
    if (!existsSync(bufferDir)) {
      console.log(`   ⚠ Buffer dir missing: ${bufferDir}`);
      return;
    }

    try {
      const bufferCount = readdirSync(bufferDir).length;
      console.log(`   Daemon buffers: ${bufferDir} (${bufferCount} files)`);

      const signalsDir = join(bufferDir, 'signals');
      if (existsSync(signalsDir)) {
        const sigCount = readdirSync(signalsDir).length;
        console.log(`   Pending signals: ${sigCount}`);
      }
    } catch {
      // ignore
    }
  }

  private gatherSystemStats(): SystemStats {
    const stats: SystemStats = {
      files: { total: 0, entities: 0, sessions: 0, domains: 0 },
      sizes: { totalBytes: 0, smallest: null, largest: null },
      graph: { nodes: 0, edges: 0 },
      domains: {},
      tags: {},
    };

    let entityCount = 0;
    const domainCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};

    const walk = (dir: string): void => {
      let items: string[];
      try {
        items = readdirSync(dir);
      } catch {
        return;
      }

      for (const item of items) {
        if (item.startsWith('.') || item === '__pycache__' || item === 'node_modules') continue;
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
          const sz = stat.size;
          stats.files.total++;
          stats.sizes.totalBytes += sz;

          // Check for entities (files under supercategories)
          if (dir.includes('supercategories')) {
            entityCount++;
            if (item !== 'index.md' && item !== 'overview.md') {
              const parts = dir.split(sep);
              const domainIdx = parts.indexOf('domains');
              if (domainIdx !== -1 && domainIdx + 1 < parts.length) {
                const domainName = parts[domainIdx + 1];
                domainCounts[domainName] = (domainCounts[domainName] ?? 0) + 1;
              }
            }

            // Read tags
            try {
              const first = readFileSync(full, 'utf-8').slice(0, 300);
              const fm = extractFrontmatter(first);
              if (fm.tags) {
                for (const t of fm.tags) {
                  if (t !== 'entity' && t !== 'ast' && t !== 'acronym') {
                    tagCounts[t] = (tagCounts[t] ?? 0) + 1;
                  }
                }
              }
            } catch {
              // ignore
            }
          }

          const relPath = relative(this.wikiDir, full).replace(/\\/g, '/');
          if (!stats.sizes.smallest || sz < stats.sizes.smallest.size) {
            stats.sizes.smallest = { path: relPath, size: sz };
          }
          if (!stats.sizes.largest || sz > stats.sizes.largest.size) {
            stats.sizes.largest = { path: relPath, size: sz };
          }
        }
      }
    };

    walk(this.wikiDir);

    // Session count
    const sessionDir = join(this.wikiDir, 'wiki', 'sessions');
    if (existsSync(sessionDir)) {
      try {
        const sessions = readdirSync(sessionDir).filter((f) => f.endsWith('.md'));
        stats.files.sessions = sessions.length;
      } catch {
        // ignore
      }
    }

    stats.files.entities = entityCount;
    stats.domains = domainCounts;
    stats.tags = Object.fromEntries(
      Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20),
    );

    // Graph stats
    const graphPath = join(this.searchDir, 'graph.json');
    if (existsSync(graphPath)) {
      try {
        const g = JSON.parse(readFileSync(graphPath, 'utf-8'));
        stats.graph.nodes = (g.nodes ?? []).length;
        stats.graph.edges = (g.edges ?? []).length;
      } catch {
        // ignore
      }
    }

    return stats;
  }
}
