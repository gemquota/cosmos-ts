// MyKB — Wiki Index builder (ported from build-index.py)
// Scans .md files, extracts frontmatter, and builds a searchable index.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import type { Frontmatter } from '@cosmos/core';
import { extractFrontmatter } from './markdown.js';

// ── Types ──────────────────────────────────────────────────────

export interface WikiFileEntry {
  path: string;
  type?: string;
  title?: string;
  tags?: string[];
}

export interface WikiIndexData {
  entries: WikiFileEntry[];
  stats: {
    totalFiles: number;
    types: Record<string, number>;
  };
  builtAt: string;
}

// ── WikiIndex Class ───────────────────────────────────────────

export class WikiIndex {
  private wikiDir: string;
  private entries: WikiFileEntry[] = [];

  constructor(wikiDir: string) {
    this.wikiDir = wikiDir;
  }

  /**
   * Build the index by scanning all .md files in the wiki directory.
   */
  buildIndex(): WikiFileEntry[] {
    this.entries = [];
    this.walkDir(this.wikiDir);
    return this.entries;
  }

  /**
   * Search entries by query (simple title/path matching).
   */
  search(query: string): WikiFileEntry[] {
    const q = query.toLowerCase();
    return this.entries.filter(
      (e) =>
        (e.title && e.title.toLowerCase().includes(q)) ||
        e.path.toLowerCase().includes(q) ||
        (e.tags && e.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }

  /**
   * Get a single entry by relative path.
   */
  getFile(relPath: string): WikiFileEntry | undefined {
    return this.entries.find((e) => e.path === relPath);
  }

  /**
   * Get index statistics.
   */
  getStats(): WikiIndexData['stats'] {
    const types: Record<string, number> = {};
    for (const e of this.entries) {
      const t = e.type ?? 'unknown';
      types[t] = (types[t] ?? 0) + 1;
    }
    return {
      totalFiles: this.entries.length,
      types,
    };
  }

  /**
   * Write the index as JSON to disk.
   */
  writeJson(outPath: string): void {
    const data: WikiIndexData = {
      entries: this.entries,
      stats: this.getStats(),
      builtAt: new Date().toISOString(),
    };
    writeFileSync(outPath, JSON.stringify(data, null, 1), 'utf-8');
  }

  // ── Private ──────────────────────────────────────────────────

  private walkDir(dir: string): void {
    let items: string[];
    try {
      items = readdirSync(dir).sort();
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
        this.walkDir(full);
      } else if (item.endsWith('.md')) {
        const rel = relative(this.wikiDir, full).replace(/\\/g, '/');
        try {
          const text = readFileSync(full, 'utf-8');
          const entry: WikiFileEntry = { path: rel };
          const fm = extractFrontmatter(text);
          if (fm.type) entry.type = fm.type;
          if (fm.title) entry.title = fm.title;
          if (fm.tags && fm.tags.length > 0) entry.tags = fm.tags;
          this.entries.push(entry);
        } catch {
          // Skip unreadable files
        }
      }
    }
  }
}
