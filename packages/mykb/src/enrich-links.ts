// MyKB — Wiki Link Enricher (ported from enrich_links.py)
// 5-pass enrichment pipeline for cross-linking domain/category/entity pages.
//
// Pass 1: Domain index pages — add related domain links and richer descriptions
// Pass 2: Supercategory index pages — add child category links
// Pass 3: Category index pages — add child subcategory links and entity counts
// Pass 4: Subcategory index pages — add entity listings
// Pass 5: Entity stubs — add cross-references to sibling entities

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// ── Domain Knowledge Base ──────────────────────────────────────

export interface DomainInfo {
  title: string;
  desc: string;
  related: string[];
  tags: string[];
}

export const DOMAIN_INFO: Record<string, DomainInfo> = {
  'ai-ml': {
    title: 'AI & Machine Learning',
    desc: 'LLM ecosystems, machine learning frameworks, prompt engineering, neural architectures, and AI agent capabilities.',
    related: ['agent-systems', 'software-engineering', 'web-platforms'],
    tags: ['llm', 'neural', 'ml', 'ai', 'prompt', 'embedding', 'transformer', 'training'],
  },
  'agent-systems': {
    title: 'Agent Systems',
    desc: 'Autonomous LLM-powered agent architectures, tool-use patterns, multi-agent orchestration, and session capture pipelines.',
    related: ['ai-ml', 'software-engineering', 'dev-tools'],
    tags: ['agent', 'tool', 'session', 'orchestration', 'daemon', 'hook', 'codex'],
  },
  'data-storage': {
    title: 'Data Storage',
    desc: 'Database technologies, caching systems, ORM patterns, and data persistence strategies.',
    related: ['web-platforms', 'software-engineering', 'security-auth'],
    tags: ['database', 'sql', 'cache', 'redis', 'sqlite', 'postgres', 'orm', 'alembic'],
  },
  'dev-tools': {
    title: 'Development Tools',
    desc: 'IDEs, CLI tools, debuggers, linters, formatters, and developer productivity utilities.',
    related: ['software-engineering', 'os-shell', 'devops-infra'],
    tags: ['ide', 'cli', 'debug', 'lint', 'format', 'git', 'npm', 'pip'],
  },
  'devops-infra': {
    title: 'DevOps & Infrastructure',
    desc: 'Deployment pipelines, cloud services, containerization, CI/CD, and infrastructure automation.',
    related: ['security-auth', 'web-platforms', 'data-storage'],
    tags: ['deploy', 'docker', 'aws', 'ci', 'pipeline', 'terraform', 'kubernetes'],
  },
  'mobile-platform': {
    title: 'Mobile Platform',
    desc: 'Android development, Termux environment, mobile API patterns, and platform-specific tooling.',
    related: ['os-shell', 'security-auth', 'web-platforms'],
    tags: ['android', 'termux', 'mobile', 'apk', 'gradle', 'activity', 'intent'],
  },
  'os-shell': {
    title: 'OS & Shell',
    desc: 'Operating system internals, shell scripting, terminal workflows, and system-level tooling.',
    related: ['dev-tools', 'devops-infra', 'mobile-platform'],
    tags: ['bash', 'shell', 'terminal', 'linux', 'process', 'filesystem', 'grep', 'sed'],
  },
  'security-auth': {
    title: 'Security & Authentication',
    desc: 'Authentication protocols, authorization patterns, cryptographic primitives, and security best practices.',
    related: ['data-storage', 'web-platforms', 'devops-infra'],
    tags: ['auth', 'oauth', 'jwt', 'crypto', 'tls', 'ssl', 'token', 'session'],
  },
  'software-engineering': {
    title: 'Software Engineering',
    desc: 'Programming languages, design patterns, code quality, testing strategies, and engineering practices.',
    related: ['dev-tools', 'ai-ml', 'data-storage'],
    tags: ['pattern', 'testing', 'refactor', 'design', 'architecture', 'typescript', 'python'],
  },
  'web-platforms': {
    title: 'Web Platforms',
    desc: 'HTTP protocols, API design, frontend frameworks, CSS styling, backend services, and web security.',
    related: ['data-storage', 'security-auth', 'software-engineering'],
    tags: ['http', 'rest', 'graphql', 'react', 'angular', 'css', 'html', 'spa', 'ajax'],
  },
};

// ── Cross-Domain Relationship Descriptions ─────────────────────

export const CROSS_DOMAIN_LINKS: Record<string, string> = {
  'ai-ml\u2192agent-systems': 'LLM agents power the agent architecture',
  'ai-ml\u2192software-engineering': 'ML models require engineering best practices',
  'agent-systems\u2192dev-tools': 'Agents use development tools for code execution',
  'agent-systems\u2192ai-ml': 'Agents are built on LLM foundations',
  'data-storage\u2192web-platforms': 'Web apps need persistent data layers',
  'data-storage\u2192security-auth': 'Data access requires authentication',
  'dev-tools\u2192os-shell': 'CLI tools run in shell environments',
  'dev-tools\u2192software-engineering': 'Tools support engineering workflows',
  'devops-infra\u2192web-platforms': 'Infrastructure hosts web services',
  'devops-infra\u2192security-auth': 'Infrastructure requires security controls',
  'mobile-platform\u2192os-shell': 'Termux provides shell on Android',
  'mobile-platform\u2192security-auth': 'Mobile apps need auth flows',
  'security-auth\u2192web-platforms': 'Web platforms need auth layers',
  'security-auth\u2192data-storage': 'Data access requires authorization',
  'software-engineering\u2192dev-tools': 'Engineering uses dev tools',
  'web-platforms\u2192data-storage': 'Web apps store data',
  'web-platforms\u2192security-auth': 'Web apps need security',
};

// ── Types ──────────────────────────────────────────────────────

export interface EnrichStats {
  domainIndexesUpdated: number;
  supercategoryIndexes: number;
  categoryIndexes: number;
  subcategoryIndexes: number;
  entityStubsEnriched: number;
}

// ── Helper Functions (ported from Python) ─────────────────────

function countEntitiesInDir(dirpath: string): number {
  let count = 0;
  try {
    for (const item of readdirSync(dirpath)) {
      const full = join(dirpath, item);
      const st = statSync(full);
      if (st.isDirectory()) {
        count += countEntitiesInDir(full);
      } else if (item.endsWith('.md') && item !== 'index.md' && item !== 'overview.md') {
        count++;
      }
    }
  } catch { /* ignore */ }
  return count;
}

function getChildrenDirs(dirpath: string): Array<[string, string, number]> {
  const children: Array<[string, string, number]> = [];
  try {
    for (const d of readdirSync(dirpath).sort()) {
      const dp = join(dirpath, d);
      if (statSync(dp).isDirectory() && !d.startsWith('.')) {
        let mdCount = 0;
        try { mdCount = readdirSync(dp).filter((f) => f.endsWith('.md')).length; } catch { /* ignore */ }
        if (mdCount > 0) {
          children.push([d, dp, mdCount]);
        }
      }
    }
  } catch { /* ignore */ }
  return children;
}

function listEntitiesInDir(dirpath: string, limit = 10): Array<[string, string]> {
  const entities: Array<[string, string]> = [];
  try {
    for (const f of readdirSync(dirpath).sort()) {
      if (entities.length >= limit) break;
      if (f.endsWith('.md') && f !== 'index.md' && f !== 'overview.md') {
        const name = f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        entities.push([f, name]);
      }
    }
  } catch { /* ignore */ }
  return entities;
}

function frontmatterBlock(tags?: string[]): string {
  let fm = '---\n';
  fm += 'type: concept\n';
  if (tags && tags.length > 0) {
    fm += 'tags: [' + tags.join(', ') + ']\n';
  }
  fm += '---\n\n';
  return fm;
}

// ── EnrichWiki Class ──────────────────────────────────────────

export class EnrichWiki {
  private wikiDir: string;
  private bundleDir: string;
  private changes: string[] = [];

  constructor(bundleDir?: string) {
    this.bundleDir = bundleDir ?? process.cwd();
    this.wikiDir = join(this.bundleDir, 'wiki');
    if (!existsSync(this.wikiDir)) {
      this.bundleDir = process.cwd();
      this.wikiDir = join(this.bundleDir, 'wiki');
    }
  }

  enrichAll(): EnrichStats {
    console.log('=== Wiki Link Enricher ===');
    console.log('Bundle: ' + this.bundleDir);
    console.log('Wiki: ' + this.wikiDir + '\n');

    if (!existsSync(this.wikiDir)) {
      console.error('Wiki directory not found: ' + this.wikiDir);
      return { domainIndexesUpdated: 0, supercategoryIndexes: 0, categoryIndexes: 0, subcategoryIndexes: 0, entityStubsEnriched: 0 };
    }

    const domainDirs: Array<[string, string]> = [];
    const domainsPath = join(this.wikiDir, 'domains');
    if (existsSync(domainsPath)) {
      for (const d of readdirSync(domainsPath).sort()) {
        const dp = join(domainsPath, d);
        if (statSync(dp).isDirectory() && !d.startsWith('.')) {
          domainDirs.push([d, dp]);
        }
      }
    }

    console.log('Pass 1/5: Domain index pages...');
    const domainCount = this.enrichDomainIndexes(domainDirs);
    console.log('Pass 2/5: Supercategory index pages...');
    const scCount = this.enrichSupercategoryIndexes(domainDirs);
    console.log('Pass 3/5: Category index pages...');
    const catCount = this.enrichCategoryIndexes(domainDirs);
    console.log('Pass 4/5: Subcategory index pages...');
    const subcatCount = this.enrichSubcategoryIndexes(domainDirs);
    console.log('Pass 5/5: Entity stubs...');
    const entityCount = this.enrichEntityStubs(domainDirs);

    console.log('\n=== Summary ===');
    console.log('Domain indexes updated: ' + this.changes.filter((c) => c.startsWith('domain')).length);
    console.log('Supercategory indexes: ' + scCount);
    console.log('Category indexes: ' + catCount);
    console.log('Subcategory indexes: ' + subcatCount);
    console.log('Entity stubs enriched: ' + entityCount);

    return { domainIndexesUpdated: domainCount, supercategoryIndexes: scCount, categoryIndexes: catCount, subcategoryIndexes: subcatCount, entityStubsEnriched: entityCount };
  }

  // ── Pass 1: Domain Indexes ──────────────────────────────────

  private enrichDomainIndexes(domainDirs: Array<[string, string]>): number {
    let updated = 0;
    for (const [domain, dp] of domainDirs) {
      const idxPath = join(dp, 'index.md');
      const info = DOMAIN_INFO[domain];
      const title = info?.title ?? domain.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const desc = info?.desc ?? 'Technologies and patterns in the ' + domain + ' domain.';
      const entityCount = countEntitiesInDir(dp);
      const scDir = join(dp, 'supercategories');
      const children = existsSync(scDir) ? getChildrenDirs(scDir) : getChildrenDirs(dp);
      const related = info?.related ?? [];

      const lines: string[] = [];
      lines.push(frontmatterBlock(info?.tags));
      lines.push('# ' + title);
      lines.push('');
      lines.push('> ' + desc);
      lines.push('');
      lines.push('**' + entityCount + ' entities** across ' + children.length + ' sub-areas.');
      lines.push('');

      if (related.length > 0) {
        lines.push('## Related Domains');
        lines.push('');
        for (const r of related) {
          const rInfo = DOMAIN_INFO[r];
          const rTitle = rInfo?.title ?? r.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const relPath = '[[wiki/domains/' + r + '/index|' + rTitle + ']]';
          const relKey = domain + '\u2192' + r;
          const relationship = CROSS_DOMAIN_LINKS[relKey] ?? '';
          if (relationship) {
            lines.push('- ' + relPath + ' \u2014 ' + relationship);
          } else {
            lines.push('- ' + relPath);
          }
        }
        lines.push('');
      }

      if (children.length > 0) {
        lines.push('## Sub-Areas');
        lines.push('');
        for (const [childName, childPath, childCount] of children) {
          const childTitle = childName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const childIdx = join(childPath, 'index.md');
          if (existsSync(childIdx)) {
            lines.push('- [[wiki/domains/' + domain + '/supercategories/' + childName + '/index|' + childTitle + ']] \u2014 ' + childCount + ' files');
          } else {
            lines.push('- **' + childTitle + '** \u2014 ' + childCount + ' files');
          }
        }
        lines.push('');
      }

      const sampleEntities = listEntitiesInDir(dp, 8);
      if (sampleEntities.length > 0) {
        lines.push('## Key Entities');
        lines.push('');
        for (const [fname, ename] of sampleEntities) {
          const entityPath = 'wiki/domains/' + domain + '/' + fname;
          lines.push('- [[' + entityPath.replace('.md', '') + '|' + ename + ']]');
        }
        lines.push('');
      }

      const newContent = lines.join('\n');
      let oldContent = '';
      if (existsSync(idxPath)) {
        oldContent = readFileSync(idxPath, 'utf-8');
      }
      if (newContent.length > oldContent.length * 0.8 || oldContent.length < 100) {
        writeFileSync(idxPath, newContent, 'utf-8');
        this.changes.push('domain: ' + domain + ' (' + lines.length + ' lines)');
        console.log('  \u2713 ' + domain + ': ' + entityCount + ' entities, ' + children.length + ' children, ' + related.length + ' related');
        updated++;
      }
    }
    return updated;
  }

  // ── Pass 2: Supercategory Indexes ───────────────────────────

  private enrichSupercategoryIndexes(domainDirs: Array<[string, string]>): number {
    let scCount = 0;
    for (const [domain, dp] of domainDirs) {
      const scDir = join(dp, 'supercategories');
      if (!existsSync(scDir)) continue;
      for (const scName of readdirSync(scDir).sort()) {
        const scPath = join(scDir, scName);
        if (!statSync(scPath).isDirectory()) continue;
        const idxPath = join(scPath, 'index.md');
        const entityCount = countEntitiesInDir(scPath);
        const children = getChildrenDirs(join(scPath, 'categories'));
        const scTitle = scName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const domainInfo = DOMAIN_INFO[domain];
        const domainTitle = domainInfo?.title ?? domain.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        const lines: string[] = [];
        lines.push(frontmatterBlock());
        lines.push('# ' + scTitle);
        lines.push('');
        lines.push('Part of [[wiki/domains/' + domain + '/index|' + domainTitle + ']]. ' + entityCount + ' entities.');
        lines.push('');

        if (children.length > 0) {
          lines.push('## Categories');
          lines.push('');
          for (const [catName, catPath, catCount] of children) {
            const catTitle = catName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            const catIdx = join(catPath, 'index.md');
            if (existsSync(catIdx)) {
              lines.push('- [[wiki/domains/' + domain + '/supercategories/' + scName + '/categories/' + catName + '/index|' + catTitle + ']] \u2014 ' + catCount + ' files');
            } else {
              lines.push('- **' + catTitle + '** \u2014 ' + catCount + ' files');
            }
          }
          lines.push('');
        }

        const siblings: string[] = [];
        for (const s of readdirSync(scDir)) {
          if (s !== scName && statSync(join(scDir, s)).isDirectory()) siblings.push(s);
        }
        if (siblings.length > 0) {
          lines.push('## See Also');
          lines.push('');
          for (const sib of siblings.sort()) {
            const sibTitle = sib.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            lines.push('- [[wiki/domains/' + domain + '/supercategories/' + sib + '/index|' + sibTitle + ']]');
          }
          lines.push('');
        }

        const newContent = lines.join('\n');
        let oldContent = '';
        if (existsSync(idxPath)) {
          oldContent = readFileSync(idxPath, 'utf-8');
        }
        if (newContent.length > oldContent.length * 0.8 || oldContent.length < 80) {
          writeFileSync(idxPath, newContent, 'utf-8');
          scCount++;
          console.log('  \u2713 ' + domain + '/' + scName + ': ' + entityCount + ' entities, ' + children.length + ' cats');
        }
      }
    }
    console.log('  Updated ' + scCount + ' supercategory indexes');
    return scCount;
  }

  // ── Pass 3: Category Indexes ────────────────────────────────

  private enrichCategoryIndexes(domainDirs: Array<[string, string]>): number {
    let catCount = 0;
    for (const [domain, dp] of domainDirs) {
      const scDir = join(dp, 'supercategories');
      if (!existsSync(scDir)) continue;
      for (const scName of readdirSync(scDir).sort()) {
        const scPath = join(scDir, scName);
        if (!statSync(scPath).isDirectory()) continue;
        const catDir = join(scPath, 'categories');
        if (!existsSync(catDir)) continue;
        for (const catName of readdirSync(catDir).sort()) {
          const catPath = join(catDir, catName);
          if (!statSync(catPath).isDirectory()) continue;
          const idxPath = join(catPath, 'index.md');
          const entityCount = countEntitiesInDir(catPath);
          const children = getChildrenDirs(join(catPath, 'subcategories'));
          const catTitle = catName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const scTitle = scName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const domainInfo = DOMAIN_INFO[domain];
          const domainTitle = domainInfo?.title ?? domain.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

          const lines: string[] = [];
          lines.push(frontmatterBlock());
          lines.push('# ' + catTitle);
          lines.push('');
          lines.push('Part of [[wiki/domains/' + domain + '/supercategories/' + scName + '/index|' + scTitle + ']] \u203a ' + catTitle + '. ' + entityCount + ' entities.');
          lines.push('');

          if (children.length > 0) {
            lines.push('## Sub-Categories');
            lines.push('');
            for (const [subcatName, subcatPath, subcatCount] of children) {
              const subcatTitle = subcatName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              const subcatIdx = join(subcatPath, 'index.md');
              if (existsSync(subcatIdx)) {
                lines.push('- [[wiki/domains/' + domain + '/supercategories/' + scName + '/categories/' + catName + '/subcategories/' + subcatName + '/index|' + subcatTitle + ']] \u2014 ' + subcatCount + ' files');
              } else {
                lines.push('- **' + subcatTitle + '** \u2014 ' + subcatCount + ' files');
              }
            }
            lines.push('');
          }

          const directEntities = listEntitiesInDir(catPath, 15);
          if (directEntities.length > 0) {
            lines.push('## Entities');
            lines.push('');
            for (const [fname, ename] of directEntities) {
              const entityPath = 'wiki/domains/' + domain + '/supercategories/' + scName + '/categories/' + catName + '/' + fname;
              lines.push('- [[' + entityPath.replace('.md', '') + '|' + ename + ']]');
            }
            lines.push('');
          }

          const newContent = lines.join('\n');
          let oldContent = '';
          if (existsSync(idxPath)) {
            oldContent = readFileSync(idxPath, 'utf-8');
          }
          if (newContent.length > oldContent.length * 0.8 || oldContent.length < 80) {
            writeFileSync(idxPath, newContent, 'utf-8');
            catCount++;
          }
        }
      }
    }
    console.log('  Updated ' + catCount + ' category indexes');
    return catCount;
  }

  // ── Pass 4: Subcategory Indexes ─────────────────────────────

  private enrichSubcategoryIndexes(domainDirs: Array<[string, string]>): number {
    let subcatCount = 0;
    for (const [domain, dp] of domainDirs) {
      const scDir = join(dp, 'supercategories');
      if (!existsSync(scDir)) continue;
      for (const scName of readdirSync(scDir).sort()) {
        const scPath = join(scDir, scName);
        if (!statSync(scPath).isDirectory()) continue;
        const catDir = join(scPath, 'categories');
        if (!existsSync(catDir)) continue;
        for (const catName of readdirSync(catDir).sort()) {
          const catPath = join(catDir, catName);
          if (!statSync(catPath).isDirectory()) continue;
          const subcatDir = join(catPath, 'subcategories');
          if (!existsSync(subcatDir)) continue;
          for (const subcatName of readdirSync(subcatDir).sort()) {
            const subcatPath = join(subcatDir, subcatName);
            if (!statSync(subcatPath).isDirectory()) continue;
            const idxPath = join(subcatPath, 'index.md');
            const entities = listEntitiesInDir(subcatPath, 20);
            const entityCount = entities.length + countEntitiesInDir(subcatPath);
            const subcatTitle = subcatName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            const catTitle = catName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            const scTitle = scName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            const domainInfo = DOMAIN_INFO[domain];
            const domainTitle = domainInfo?.title ?? domain.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

            const lines: string[] = [];
            lines.push(frontmatterBlock());
            lines.push('# ' + subcatTitle);
            lines.push('');
            lines.push('Part of [[wiki/domains/' + domain + '/supercategories/' + scName + '/categories/' + catName + '/index|' + catTitle + ']] \u203a ' + subcatTitle + '. **' + entityCount + ' entities.**');
            lines.push('');

            if (entities.length > 0) {
              lines.push('## Entities');
              lines.push('');
              for (const [fname, ename] of entities) {
                const entityPath = 'wiki/domains/' + domain + '/supercategories/' + scName + '/categories/' + catName + '/subcategories/' + subcatName + '/' + fname;
                lines.push('- [[' + entityPath.replace('.md', '') + '|' + ename + ']]');
              }
              if (entityCount > 20) {
                lines.push('- *...and ' + (entityCount - 20) + ' more*');
              }
              lines.push('');
            }

            const siblings: string[] = [];
            for (const s of readdirSync(subcatDir)) {
              if (s !== subcatName && statSync(join(subcatDir, s)).isDirectory()) siblings.push(s);
            }
            if (siblings.length > 0) {
              lines.push('## See Also');
              lines.push('');
              for (const sib of siblings.sort()) {
                const sibTitle = sib.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                lines.push('- [[wiki/domains/' + domain + '/supercategories/' + scName + '/categories/' + catName + '/subcategories/' + sib + '/index|' + sibTitle + ']]');
              }
              lines.push('');
            }

            const newContent = lines.join('\n');
            let oldContent = '';
            if (existsSync(idxPath)) {
              oldContent = readFileSync(idxPath, 'utf-8');
            }
            if (newContent.length > oldContent.length * 0.8 || oldContent.length < 80) {
              writeFileSync(idxPath, newContent, 'utf-8');
              subcatCount++;
            }
          }
        }
      }
    }
    console.log('  Updated ' + subcatCount + ' subcategory indexes');
    return subcatCount;
  }

  // ── Pass 5: Entity Stubs ────────────────────────────────────

  private enrichEntityStubs(domainDirs: Array<[string, string]>): number {
    let entityCount = 0;
    for (const [domain, dp] of domainDirs) {
      const scDir = join(dp, 'supercategories');
      if (!existsSync(scDir)) continue;
      for (const scName of readdirSync(scDir).sort()) {
        const scPath = join(scDir, scName);
        if (!statSync(scPath).isDirectory()) continue;
        const catDir = join(scPath, 'categories');
        if (!existsSync(catDir)) continue;
        for (const catName of readdirSync(catDir).sort()) {
          const catPath = join(catDir, catName);
          if (!statSync(catPath).isDirectory()) continue;
          const subcatDir = join(catPath, 'subcategories');
          const dirsToScan: Array<{ entDir: string; domain: string; sc: string; cat: string; subcat: string | null }> = [];
          if (existsSync(subcatDir)) {
            for (const subcatName of readdirSync(subcatDir).sort()) {
              const subcatPath = join(subcatDir, subcatName);
              if (statSync(subcatPath).isDirectory()) {
                dirsToScan.push({ entDir: subcatPath, domain, sc: scName, cat: catName, subcat: subcatName });
              }
            }
          }
          dirsToScan.push({ entDir: catPath, domain, sc: scName, cat: catName, subcat: null });

          for (const { entDir, domain: dom, sc: scName2, cat: catName2, subcat: subcatName } of dirsToScan) {
            for (const fname of readdirSync(entDir).sort()) {
              if (!fname.endsWith('.md') || fname === 'index.md' || fname === 'overview.md') continue;
              const fpath = join(entDir, fname);
              const content = readFileSync(fpath, 'utf-8');
              const existingLinks = (content.match(/\[\[/g) ?? []).length;
              if (content.length > 300 && existingLinks > 0) continue;

              const entityName = fname.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              const catTitle = catName2.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              const scTitle = scName2.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              const domainInfo = DOMAIN_INFO[dom];
              const domainTitle = domainInfo?.title ?? dom.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

              const fmMatch = content.match(/^(---\s*\n.*?\n---\s*\n)/s);
              const fm = fmMatch ? fmMatch[1] : '';
              const overviewMatch = content.match(/## Overview\s*\n(.*?)(?=\n##|\Z)/s);
              const existingOverview = overviewMatch ? overviewMatch[1].trim() : '';

              let breadcrumb: string;
              if (subcatName) {
                breadcrumb = domainTitle + ' \u203a [[wiki/domains/' + dom + '/supercategories/' + scName2 + '/index|' + scTitle + ']] \u203a [[wiki/domains/' + dom + '/supercategories/' + scName2 + '/categories/' + catName2 + '/index|' + catTitle + ']] \u203a ' + entityName;
              } else if (catName2) {
                breadcrumb = domainTitle + ' \u203a [[wiki/domains/' + dom + '/supercategories/' + scName2 + '/index|' + scTitle + ']] \u203a [[wiki/domains/' + dom + '/supercategories/' + scName2 + '/categories/' + catName2 + '/index|' + catTitle + ']]';
              } else {
                breadcrumb = domainTitle + ' \u203a [[wiki/domains/' + dom + '/supercategories/' + scName2 + '/index|' + scTitle + ']]';
              }

              const lines: string[] = [];
              if (fm) lines.push(fm);
              lines.push('## ' + entityName);
              lines.push('');
              if (existingOverview) {
                lines.push(existingOverview);
                lines.push('');
              }
              lines.push('**Domain:** ' + breadcrumb);
              lines.push('');

              const siblings = readdirSync(entDir)
                .filter((s) => s.endsWith('.md') && s !== fname && s !== 'index.md' && s !== 'overview.md')
                .slice(0, 8);
              if (siblings.length > 0) {
                lines.push('## Related Entities');
                lines.push('');
                for (const sib of siblings) {
                  const sibName = sib.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                  const sibRel = relative(this.bundleDir, join(entDir, sib)).replace(/\.md$/, '');
                  lines.push('- [[' + sibRel + '|' + sibName + ']]');
                }
                lines.push('');
              }

              const newContent = lines.join('\n');
              if (newContent.length > content.length + 50) {
                writeFileSync(fpath, newContent, 'utf-8');
                entityCount++;
              }
            }
          }
        }
      }
    }
    console.log('  Enriched ' + entityCount + ' entity stubs');
    return entityCount;
  }

  getAllChanges(): string[] {
    return [...this.changes];
  }
}

// ── CLI Entry Point ────────────────────────────────────────────

export function runEnrichCli(): EnrichStats {
  const enricher = new EnrichWiki();
  return enricher.enrichAll();
}

const isMain = process.argv[1]?.endsWith('enrich-links.ts') || process.argv[1]?.endsWith('enrich-links.js');
if (isMain) {
  runEnrichCli();
}
