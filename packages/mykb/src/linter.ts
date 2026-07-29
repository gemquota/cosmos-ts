// MyKB — Static Knowledge Base Linter (ported from kb_linter.py)
// Scans all .md files for broken [[wikilinks]], orphan notes, and integrity issues.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, basename, dirname, normalize } from 'path';

// ── Types ──────────────────────────────────────────────────────

export interface LintReport {
  status: 'ok' | 'issues_found';
  summary: {
    totalFiles: number;
    totalLinks: number;
    brokenLinks: number;
    orphanNotes: number;
    filesWithBrokenLinks: number;
  };
  brokenLinks: Record<string, string[]>;
  orphans: string[];
  tags: Record<string, number>;
  missingBacklinks?: Record<string, string[]>;
}

export interface LinterOptions {
  json?: boolean;
  fix?: boolean;
  watch?: boolean;
}

// ── KbLinter Class ────────────────────────────────────────────

export class KbLinter {
  private bundleDir: string;

  constructor(bundleDir?: string) {
    this.bundleDir = bundleDir ?? process.cwd();
  }

  /**
   * Find all .md files recursively, skipping hidden dirs and non-content dirs.
   */
  findMdFiles(base?: string): Set<string> {
    const baseDir = base ?? this.bundleDir;
    const files = new Set<string>();
    const skipDirs = new Set(['.git', '__pycache__', 'node_modules', '.okf-skill', '.obsidian']);

    const walk = (dir: string): void => {
      let items: string[];
      try {
        items = readdirSync(dir);
      } catch {
        return;
      }

      for (const item of items) {
        if (skipDirs.has(item) || item.startsWith('.')) continue;
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
          const rel = relative(baseDir, full).replace(/\\/g, '/');
          files.add(rel);
        }
      }
    };

    walk(baseDir);
    return files;
  }

  /**
   * Extract all [[wikilink]] targets from text. Returns set of filenames.
   */
  extractWikilinks(text: string): Set<string> {
    const links = new Set<string>();
    // [[target|label]] or [[target]]
    const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      let target = match[1].trim();
      // Normalize: remove leading ./ or /
      if (target.startsWith('./')) target = target.slice(2);
      if (target.startsWith('/')) target = target.slice(1);
      // Add .md if missing
      if (!target.endsWith('.md')) target += '.md';
      links.add(target);
    }
    return links;
  }

  /**
   * Extract all #tags from text (but not ## headings or ###).
   */
  extractTags(text: string): Set<string> {
    const tags = new Set<string>();
    const regex = /(?<!\w)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      tags.add(match[1]);
    }
    return tags;
  }

  /**
   * Run linter and return report.
   */
  lint(returnJson = false): LintReport {
    const mdFiles = this.findMdFiles();

    // Build: file -> wikilinks, file -> tags, file -> backlinks
    const fileLinks = new Map<string, Set<string>>();
    const fileTags = new Map<string, Set<string>>();
    const backlinks = new Map<string, Set<string>>();

    for (const f of mdFiles) {
      const path = join(this.bundleDir, f);
      let text: string;
      try {
        text = readFileSync(path, 'utf-8');
      } catch {
        continue;
      }

      const links = this.extractWikilinks(text);
      fileLinks.set(f, links);
      fileTags.set(f, this.extractTags(text));

      for (const target of links) {
        if (!backlinks.has(target)) {
          backlinks.set(target, new Set());
        }
        backlinks.get(target)!.add(f);
      }
    }

    // ── Broken links ──
    const broken = new Map<string, string[]>();

    for (const [f, links] of fileLinks) {
      const bad: string[] = [];
      for (const target of links) {
        // If the target contains a /, try relative to the linking file's dir
        if (target.includes('/')) {
          // Try as-is first (relative to root)
          if (mdFiles.has(target)) continue;
          // Try relative to the linking file's directory
          const linkDir = dirname(f);
          const resolved = normalize(join(linkDir, target)).replace(/\\/g, '/');
          if (mdFiles.has(resolved)) continue;
          bad.push(target);
        } else {
          // Simple name — could be anywhere
          let found = false;
          for (const mf of mdFiles) {
            if (basename(mf) === target || mf === target) {
              found = true;
              break;
            }
          }
          if (!found) bad.push(target);
        }
      }

      if (bad.length > 0) {
        broken.set(f, bad);
      }
    }

    // ── Orphan detection ──
    const skipOrphans = new Set(['index.md', 'README.md', 'Home.md', 'AGENTS.md', 'log.md']);
    const orphans: string[] = [];

    for (const f of mdFiles) {
      const base = basename(f);
      if (skipOrphans.has(base)) continue;

      // Check if any other file links to this one
      const linkedFrom = backlinks.get(f);
      if (!linkedFrom || linkedFrom.size === 0) {
        orphans.push(f);
      }
    }

    // ── Missing backlinks ──
    // For each file, check which files link to it
    const missingBacklinks = new Map<string, string[]>();
    for (const f of mdFiles) {
      const hasLinks = fileLinks.get(f);
      // Find files that could link to this one but don't
      const possibleLinkers: string[] = [];
      for (const [otherFile, otherLinks] of fileLinks) {
        if (otherFile === f) continue;
        // Check if otherFile's name or title appears in f
        const otherBase = basename(otherFile, '.md');
        if (f.toLowerCase().includes(otherBase.toLowerCase())) {
          possibleLinkers.push(otherFile);
        }
      }
      // Exclude those that already link
      const linkedFrom = backlinks.get(f);
      const actual: string[] = [];
      if (linkedFrom) {
        for (const p of possibleLinkers) {
          if (!linkedFrom.has(p)) {
            actual.push(p);
          }
        }
      } else {
        actual.push(...possibleLinkers);
      }
      if (actual.length > 0) {
        missingBacklinks.set(f, actual);
      }
    }

    // ── Stats ──
    let totalLinks = 0;
    for (const v of fileLinks.values()) {
      totalLinks += v.size;
    }

    let totalBroken = 0;
    for (const v of broken.values()) {
      totalBroken += v.length;
    }

    // ── Top tags ──
    const allTags = new Map<string, number>();
    for (const tags of fileTags.values()) {
      for (const t of tags) {
        allTags.set(t, (allTags.get(t) ?? 0) + 1);
      }
    }
    const topTags: Record<string, number> = {};
    const sortedTags = [...allTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
    for (const [tag, count] of sortedTags) {
      topTags[tag] = count;
    }

    // Build broken links record
    const brokenRecord: Record<string, string[]> = {};
    const sortedBroken = [...broken.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [f, links] of sortedBroken) {
      brokenRecord[f] = [...links].sort();
    }

    // Build missing backlinks record
    const missingRecord: Record<string, string[]> = {};
    const sortedMissing = [...missingBacklinks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [f, linkers] of sortedMissing) {
      missingRecord[f] = [...linkers].sort();
    }

    const report: LintReport = {
      status: broken.size > 0 ? 'issues_found' : 'ok',
      summary: {
        totalFiles: mdFiles.size,
        totalLinks,
        brokenLinks: totalBroken,
        orphanNotes: orphans.length,
        filesWithBrokenLinks: broken.size,
      },
      brokenLinks: brokenRecord,
      orphans: [...orphans].sort(),
      tags: topTags,
      missingBacklinks: missingRecord,
    };

    if (returnJson) {
      return report;
    }

    // Pretty print
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  KB Linter Report — ${mdFiles.size} files scanned`);
    console.log(`${'='.repeat(50)}`);
    console.log(`  Total [[wikilinks]]: ${totalLinks}`);
    console.log(`  Broken links:       ${totalBroken}`);
    console.log(`  Orphan notes:       ${orphans.length}`);
    console.log(`  Files with issues:  ${broken.size}\n`);

    if (broken.size > 0) {
      console.log(`  ── Broken [[wikilinks]] ──`);
      let count = 0;
      for (const [f, links] of sortedBroken) {
        if (count >= 10) break;
        console.log(`    ${f}:`);
        for (const l of links.slice(0, 5)) {
          console.log(`      → ${l}`);
        }
        count++;
      }
      if (sortedBroken.length > 10) {
        console.log(`    ... and ${sortedBroken.length - 10} more files`);
      }
      console.log('');
    }

    if (orphans.length > 0) {
      console.log(`  ── Orphan Notes (0 inbound links) ──`);
      const sortedOrphans = [...orphans].sort();
      for (const f of sortedOrphans.slice(0, 15)) {
        console.log(`    ${f}`);
      }
      if (sortedOrphans.length > 15) {
        console.log(`    ... and ${sortedOrphans.length - 15} more`);
      }
      console.log('');
    }

    if (broken.size === 0 && orphans.length === 0) {
      console.log('  ✓ No issues found — all links valid, no orphans.');
    }

    return report;
  }

  /**
   * Auto-fix: add orphan status frontmatter to orphan files.
   */
  fixOrphans(limit = 5): number {
    const report = this.lint(true);
    let fixed = 0;

    for (const f of report.orphans.slice(0, limit)) {
      const path = join(this.bundleDir, f);
      let content = readFileSync(path, 'utf-8');
      if (!content.startsWith('---')) {
        // Add orphan marker in frontmatter
        content = `---\nstatus: orphan\n---\n\n${content}`;
        writeFileSync(path, content, 'utf-8');
        console.log(`  Marked orphan: ${f}`);
        fixed++;
      }
    }

    console.log(`  Fixed ${fixed} orphans`);
    return fixed;
  }

  /**
   * Watch mode: one-shot scan for pre-commit hook style usage.
   */
  watch(): LintReport {
    const report = this.lint(true);
    if (report.summary.brokenLinks > 0) {
      console.error(`Linter found ${report.summary.brokenLinks} broken links.`);
    }
    return report;
  }
}

// ── CLI Entry Point ────────────────────────────────────────────

export function runLinterCli(options: LinterOptions = {}): LintReport {
  const linter = new KbLinter();

  if (options.json) {
    const report = linter.lint(true);
    console.log(JSON.stringify(report, null, 2));
    return report;
  }

  if (options.fix) {
    const report = linter.lint(true);
    linter.fixOrphans(5);
    return report;
  }

  if (options.watch) {
    return linter.watch();
  }

  return linter.lint(false);
}

// If run directly
const isMain = process.argv[1]?.endsWith('linter.ts') || process.argv[1]?.endsWith('linter.js');
if (isMain) {
  const args = process.argv.slice(2);
  const options: LinterOptions = {
    json: args.includes('--json'),
    fix: args.includes('--fix'),
    watch: args.includes('--watch'),
  };
  runLinterCli(options);
}
