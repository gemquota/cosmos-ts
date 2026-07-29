export interface Project {
  id: string;
  name: string;
  href: string;
  color: string;
  badge: string;
  badgeColor: string;
  description: string;
  tags: string[];
  cosmos?: boolean;
  stats?: { files: number; loc: number; entities?: number; disk?: string };
}

export const projects: Project[] = [
  { id: 'space', name: 'SPACE', href: 'https://github.com/gemquota/cosmos-ts/tree/main/packages/space', color: '#3b82f6', badge: 'LIVE', badgeColor: '#00ff9f', description: 'Superb Prompt Automatic Creation Engine — 326-probe spec generation framework', tags: ['TypeScript', 'Prompt Eng'], cosmos: true, stats: { files: 4704, loc: 209000 } },
  { id: 'mykb', name: 'MyKB', href: 'https://github.com/gemquota/cosmos-ts/tree/main/packages/mykb', color: '#a855f7', badge: 'LIVE', badgeColor: '#00ff9f', description: 'Knowledge OS — Obsidian wiki with entity extraction, 48 domains, 2,358 files', tags: ['TypeScript', 'Wiki'], cosmos: true, stats: { files: 3351, loc: 68000 } },
  { id: 'rsis3', name: 'RSIS3', href: 'https://github.com/gemquota/cosmos-ts/tree/main/packages/rsis3', color: '#ff8c00', badge: 'LIVE', badgeColor: '#00ff9f', description: '3-loop RSI cognitive engine — L1/L2/L3 loops, full RRP protocol, knowledge graph', tags: ['TypeScript', 'RSI'], cosmos: true, stats: { files: 627, loc: 7412 } },
  { id: 'vepa2', name: 'VEPA2', href: 'https://github.com/gemquota/vepa2', color: '#ef4444', badge: 'BETA', badgeColor: '#ffa500', description: 'Vector Emergent Physics Automata — GPU-accelerated emergent particle simulation', tags: ['TypeScript', 'Physics'], stats: { files: 4685, loc: 841000 } },
  { id: 'hmxot', name: 'HMXOT', href: 'https://github.com/gemquota/hmxot', color: '#00d4ff', badge: 'STABLE', badgeColor: '#a855f7', description: 'Real-time techno synthesizer — WebGL visualization, React 19, Web Audio API', tags: ['TypeScript', 'Audio'], stats: { files: 192, loc: 12590 } },
  { id: 'golf', name: 'GOLF', href: 'https://github.com/gemquota/golf', color: '#eab308', badge: 'BETA', badgeColor: '#ffa500', description: 'Web scraper for bonus data — SQLite, proxy rotation, FTS search', tags: ['Python', 'Scraper'] },
  { id: 'gog', name: 'GOG', href: '#', color: '#84cc16', badge: 'BETA', badgeColor: '#ffa500', description: 'Gemini on Gemini — self-documentation of Gemini CLI by Gemini CLI', tags: ['Python', 'Docs'] },
  { id: 'ww', name: 'WW', href: '#', color: '#ec4899', badge: 'DEV', badgeColor: '#60a5fa', description: 'Web wrapper — agentic bridge with filesystem access, context management', tags: ['Python', 'Bridge'] },
];

export const cosmosComponents = projects.filter((p: Project) => p.cosmos);
export const otherProjects = projects.filter((p: Project) => !p.cosmos);
