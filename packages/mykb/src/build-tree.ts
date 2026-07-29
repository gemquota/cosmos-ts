// MyKB — Wiki tree builder (ported from build-tree.py)
// Walks a wiki directory and produces a hierarchical WikiTreeNode[] with previews.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import type { WikiTreeNode, WikiTree } from '@cosmos/core';
import { extractFrontmatter, stripFrontmatter } from './markdown.js';

/**
 * Count total files in a list of tree nodes (recursive).
 */
export function countFilesInEntries(entries: WikiTreeNode[]): number {
  let count = 0;
  for (const e of entries) {
    if (e.type === 'file') {
      count++;
    } else if (e.type === 'dir' && e.children) {
      count += countFilesInEntries(e.children);
    }
  }
  return count;
}

/**
 * Walk a directory and build a nested tree of WikiTreeNode entries.
 * Skips hidden dirs and __pycache__/node_modules.
 */
export function walkTree(dirPath: string, wikiRoot?: string): WikiTreeNode[] {
  const root = wikiRoot ?? dirPath;
  const entries: WikiTreeNode[] = [];

  let items: string[];
  try {
    items = readdirSync(dirPath).sort();
  } catch {
    return entries;
  }

  for (const item of items) {
    if (item.startsWith('.') || item === '__pycache__' || item === 'node_modules') continue;

    const full = join(dirPath, item);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      const children = walkTree(full, root);
      const fc = countFilesInEntries(children);
      if (children.length > 0) {
        entries.push({
          type: 'dir',
          name: item,
          children,
          count: fc,
        });
      }
    } else if (item.endsWith('.md')) {
      const rel = relative(root, full).replace(/\\/g, '/');
      let text = '';
      try {
        text = readFileSync(full, 'utf-8');
      } catch {
        // unreadable
      }

      const fm = extractFrontmatter(text);
      const body = text ? stripFrontmatter(text) : '';
      const preview = body.slice(0, 300).trim();

      entries.push({
        type: 'file',
        name: item,
        path: rel,
        title: fm.title ?? item.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        docType: fm.type ?? 'doc',
        tags: fm.tags,
        preview,
        size: stat.size,
      });
    }
  }

  return entries;
}

/**
 * Build a full WikiTree with stats from a wiki directory.
 */
export function buildWikiTree(wikiDir: string): WikiTree {
  const tree = walkTree(wikiDir);

  const domains: string[] = [];
  for (const entry of tree) {
    if (entry.type === 'dir') {
      domains.push(entry.name);
    }
  }

  const totalFiles = countFilesInEntries(tree);

  return {
    name: 'wiki',
    type: 'dir',
    children: tree,
    stats: {
      totalFiles,
      totalDomains: domains.length,
      domains: domains.sort(),
    },
  };
}
