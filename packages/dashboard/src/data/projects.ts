export interface Project {
  id: string;
  name: string;
  href: string;
  color: string;
  badge: string;
  badgeColor: string;
  description: string;
  tags: string[];
  stats?: { files: number; loc: number };
}

const HUB = 'https://gemquota.github.io/hub';

export const cosmosProjects: Project[] = [
  { id: 'space', name: 'SPACE', href: `${HUB}/space.html`, color: '#3b82f6', badge: 'LIVE', badgeColor: '#00ff9f', description: 'Superb Prompt Automatic Creation Engine — 326-probe spec generation framework', tags: ['TypeScript', 'Prompt Eng'], stats: { files: 4704, loc: 209000 } },
  { id: 'mykb', name: 'MyKB', href: `${HUB}/mykb.html`, color: '#a855f7', badge: 'LIVE', badgeColor: '#00ff9f', description: 'Knowledge OS — Obsidian wiki, 48 domains, 2,358 files, TF-IDF search', tags: ['TypeScript', 'Wiki'], stats: { files: 3351, loc: 68000 } },
  { id: 'rsis3', name: 'RSIS3', href: `${HUB}/rsis3.html`, color: '#ff8c00', badge: 'LIVE', badgeColor: '#00ff9f', description: '3-loop RSI engine — L1/L2/L3, RRP protocol, knowledge graph, telemetry', tags: ['TypeScript', 'RSI'], stats: { files: 627, loc: 7412 } },
];
