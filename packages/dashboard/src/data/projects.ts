export interface Project {
  id: string;
  name: string;
  href: string;
  color: string;
  badge: 'LIVE' | 'BETA' | 'STABLE' | 'DEV';
  badgeColor: string;
  description: string;
  tags: string[];
  cosmos?: boolean;
  stats?: { files: number; loc: number; entities: number; disk: string };
}

export const projects: Project[] = [
  { id: 'space', name: 'SPACE', href: 'space.html', color: '#3b82f6', badge: 'LIVE', badgeColor: '#00ff9f',
    description: 'Superb Prompt Automatic Creation Engine — 326-probe spec generation framework',
    tags: ['TypeScript', 'Prompt Eng'], cosmos: true,
    stats: { files: 4704, loc: 209000, entities: 420, disk: '512MB' } },
  { id: 'mykb', name: 'MyKB', href: 'mykb.html', color: '#a855f7', badge: 'LIVE', badgeColor: '#00ff9f',
    description: 'Knowledge OS — Obsidian wiki with entity extraction, 27 domains',
    tags: ['Markdown', 'Python'], cosmos: true,
    stats: { files: 3351, loc: 68000, entities: 2442, disk: '215MB' } },
  { id: 'myrsikb', name: 'myRSIKB', href: 'myrsikb.html', color: '#22c55e', badge: 'DEV', badgeColor: '#60a5fa',
    description: 'Memory Bridge — RSI audit reports, integration pipelines between RSIS3 and MyKB',
    tags: ['Python', 'Bridge'], cosmos: true,
    stats: { files: 44, loc: 42500, entities: 15, disk: '8MB' } },
  { id: 'rsis3', name: 'RSIS3', href: 'rsis3.html', color: '#ff8c00', badge: 'DEV', badgeColor: '#60a5fa',
    description: '3-loop RSI cognitive engine — FastAPI dashboard, SQLite, 9 cognitive layers',
    tags: ['Python', 'RSI'], cosmos: true,
    stats: { files: 627, loc: 42000, entities: 180, disk: '31MB' } },
  { id: 'vepa2', name: 'VEPA2', href: 'vepa.html', color: '#ef4444', badge: 'BETA', badgeColor: '#ffa500',
    description: 'Vector Emergent Physics Automata — GPU-accelerated emergent particle simulation',
    tags: ['TypeScript', 'Physics'],
    stats: { files: 4685, loc: 841000, entities: 680, disk: '348MB' } },
  { id: 'hmxot', name: 'HMXOT', href: 'hmxot.html', color: '#00d4ff', badge: 'STABLE', badgeColor: '#a855f7',
    description: 'Real-time techno synthesizer — WebGL visualization, React 19, Web Audio API',
    tags: ['TypeScript', 'Audio'],
    stats: { files: 192, loc: 12590, entities: 320, disk: '160MB' } },
  { id: 'golf', name: 'GOLF', href: 'golf.html', color: '#eab308', badge: 'BETA', badgeColor: '#ffa500',
    description: 'Web scraper for bonus data — SQLite, proxy rotation, FTS search, React viewers',
    tags: ['Python', 'Scraper'] },
  { id: 'gog', name: 'GOG', href: 'gog.html', color: '#84cc16', badge: 'BETA', badgeColor: '#ffa500',
    description: 'Gemini on Gemini — self-documentation of Gemini CLI by Gemini CLI',
    tags: ['Python', 'Docs'] },
  { id: 'ww', name: 'WW', href: 'ww.html', color: '#ec4899', badge: 'DEV', badgeColor: '#60a5fa',
    description: 'Web wrapper — agentic bridge with filesystem access, context management, telemetry',
    tags: ['Python', 'Bridge'] },
];

export const cosmosComponents = projects.filter(p => p.cosmos);
export const otherProjects = projects.filter(p => !p.cosmos);
