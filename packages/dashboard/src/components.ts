import { Project, cosmosProjects } from './data/projects.js';

export function renderFilterBar(): string {
  return `<div class="filter-bar">
    <a href="index.html" class="filter-btn active">🌌 COSMOS</a>
    <a href="https://gemquota.github.io/hub/" class="filter-btn" target="_blank">📊 Hub</a>
  </div>`;
}

export function renderCosmosCard(): string {
  const launchCmds: Record<string, string> = {
    space: 'cd /dev/cosmos-ts && npx tsx packages/space/src/cli/index.ts',
    mykb: 'cd /dev/cosmos-ts && npx tsx packages/mykb/src/server.ts',
    rsis3: 'cd /dev/cosmos-ts && npx tsx packages/rsis3/src/cli.ts',
  };
  const launchPorts: Record<string, string> = {
    space: 'http://localhost:3000',
    mykb: 'http://localhost:8765',
    rsis3: 'http://localhost:8080',
  };
  const comps = cosmosProjects.map(p => {
    const [r, g, b] = hexToRgb(p.color);
    const [br, bg, bb] = hexToRgb(p.badgeColor);
    const cmd = launchCmds[p.id] || '';
    const port = launchPorts[p.id] || '';
    return `<div style="background:rgba(${r},${g},${b},.08);border:1px solid rgba(${r},${g},${b},.15);border-radius:8px;padding:.4rem .5rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:.15rem">
        <span style="font-weight:700;font-size:.7rem;color:${p.color}">${p.name}</span>
        <span style="font-size:.5rem;padding:1px 8px;border-radius:8px;background:rgba(${br},${bg},${bb},.15);color:${p.badgeColor};border:1px solid rgba(${br},${bg},${bb},.25);font-weight:600">${p.badge}</span>
      </div>
      <div style="font-size:.55rem;color:#999;margin-bottom:.1rem">${p.stats ? `${p.stats.files.toLocaleString()} files · ${(p.stats.loc/1000).toFixed(0)}k LOC` : ''}</div>
      <div style="font-size:.5rem;color:#666;margin-bottom:.3rem">${p.description}</div>
      <div style="display:flex;gap:.25rem;flex-wrap:wrap">
        <a href="${p.href}" target="_blank" style="font-size:.5rem;padding:2px 10px;border-radius:6px;background:rgba(255,255,255,.06);color:#888;border:1px solid rgba(255,255,255,.1);text-decoration:none">📊 Dashboard</a>
        <a href="${port}" target="_blank" onclick="if(this.href==='${port}'){event.preventDefault();navigator.clipboard.writeText('${cmd}');this.textContent='✓ Copied!';setTimeout(()=>this.textContent='▶ Launch',1500)}" style="font-size:.5rem;padding:2px 10px;border-radius:6px;background:rgba(0,255,159,.1);color:#00ff9f;border:1px solid rgba(0,255,159,.2);text-decoration:none;font-weight:600">▶ Launch</a>
      </div>
    </div>`;
  }).join('\n');

  return `<!-- MODULE: COSMOS -->
<div class="module-label"><span class="icon">🌌</span> COSMOS Ecosystem <span class="hdr-sub">v0.1.0 · <a href="https://github.com/gemquota/cosmos" style="color:#888">gemquota/cosmos</a></span></div>
<div class="card" style="background:linear-gradient(135deg,#161822 0%,#1a1030 50%,#161822 100%);border-color:rgba(123,47,255,.15)">
  <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem;flex-wrap:wrap">
    <span style="font-size:1.5rem">🌌</span>
    <div>
      <div style="font-size:.9rem;font-weight:700;color:#e0e0e0">Comprehensive Ontological System for Meta-cognitive Orchestration &amp; Synthesis</div>
      <div style="font-size:.6rem;color:#666;margin-top:1px">
        <span style="color:#a855f7">${cosmosProjects.length} components</span>
        · <span style="color:#3b82f6">~${sum(cosmosProjects, p => p.stats?.files ?? 0).toLocaleString()} files</span>
        · <span style="color:#00ff9f">~${(sum(cosmosProjects, p => p.stats?.loc ?? 0)/1000).toFixed(0)}k LOC</span>
      </div>
    </div>
    <div style="margin-left:auto;display:flex;gap:.3rem">
      <a href="https://gemquota.github.io/cosmos/" target="_blank" style="padding:3px 12px;border-radius:8px;font-size:.6rem;font-weight:600;border:1px solid rgba(123,47,255,.3);color:#a855f7;text-decoration:none;background:rgba(123,47,255,.08)">🌌 Cosmos</a>
      <a href="https://github.com/gemquota/cosmos" target="_blank" style="padding:3px 12px;border-radius:8px;font-size:.6rem;font-weight:600;border:1px solid rgba(255,255,255,.1);color:#888;text-decoration:none">GitHub</a>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.4rem;margin-bottom:.5rem">
    ${comps}
  </div>
  <div style="display:flex;align-items:center;gap:.3rem;font-size:.6rem;color:#666;padding-top:.3rem;border-top:1px solid rgba(255,255,255,.04)">
    <span>🔗 Active Triad:</span>
    <span style="color:#ff8c00;font-weight:600">rsis3</span><span style="color:#555">+</span>
    <span style="color:#a855f7;font-weight:600">mykb</span><span style="color:#555">+</span>
    <span style="color:#22c55e;font-weight:600">myrsikb</span>
    <span style="margin-left:auto;color:#555">Updated ${new Date().toISOString().slice(0,10)}</span>
  </div>
</div>`;
}

export function renderProjectGrid(): string {
  return '';
}

export function renderCharts(): string {
  const charts = [
    { id: 'disk-usage', icon: '💾', title: 'Disk Usage', data: [
      ['SPACE', 46.5, '#3b82f6', '512MB'], ['MyKB', 19.5, '#a855f7', '215MB'], ['RSIS3', 2.8, '#ff8c00', '31MB'] ] },
    { id: 'entity-count', icon: '📦', title: 'Entity Count', data: [
      ['MyKB', 70.0, '#a855f7', '2,442'], ['SPACE', 20.0, '#3b82f6', '420'], ['RSIS3', 10.0, '#ff8c00', '180'] ] },
    { id: 'file-count', icon: '📄', title: 'File Count', data: [
      ['SPACE', 54.0, '#3b82f6', '4,704'], ['MyKB', 38.0, '#a855f7', '3,351'], ['RSIS3', 8.0, '#ff8c00', '627'] ] },
    { id: 'loc', icon: '⚡', title: 'Lines of Code', data: [
      ['SPACE', 73.0, '#3b82f6', '209k'], ['MyKB', 24.0, '#a855f7', '68k'], ['RSIS3', 3.0, '#ff8c00', '7.4k'] ] },
  ];

  return charts.map(c => {
    const stacked = c.data.map(d => `<div class="seg" style="width:${d[1]}%;background:${d[2]}" title="${d[0]}: ${d[3]}"></div>`).join('');
    const legend = c.data.map(d => `<span class="leg-item"><span class="leg-swatch" style="background:${d[2]}"></span> ${d[0]}: ${d[3]}</span>`).join('');
    const grouped = c.data.map(d => `<div class="comp-row"><span class="lbl">${d[0]}</span><div class="track"><div class="fill" style="width:${d[1]}%;background:${d[2]}"></div></div><span class="pct">${d[3]}</span></div>`).join('');
    
    return `<div class="card">
      <div class="card-header"><span class="icon">${c.icon}</span> ${c.title}<span class="chart-toggle" data-target="${c.id}">▤ Separate</span></div>
      <div id="${c.id}-stacked" class="chart-view"><div class="stacked-bar-wrap"><div class="stacked-bar">${stacked}</div><div class="stacked-legend">${legend}</div></div></div>
      <div id="${c.id}-grouped" class="chart-view hidden">${grouped}</div>
    </div>`;
  }).join('\n');
}

export function renderDonutChart(
  id: string,
  title: string,
  data: Array<{ label: string; value: number; color: string }>,
): string {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const circumference = 2 * Math.PI * 40; // r=40
  let offset = 0;
  const slices = data.map(d => {
    const dash = (d.value / total) * circumference;
    const slice = `<circle cx="50" cy="50" r="40" fill="none" stroke="${d.color}" stroke-width="16"
      stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}"
      transform="rotate(-90 50 50)"/>`;
    offset += dash;
    return slice;
  }).join('\n');

  const legend = data.map(d =>
    `<div class="row"><span class="swatch" style="background:${d.color}"></span><span class="lbl">${d.label}</span><span class="cnt">${d.value.toLocaleString()}</span></div>`
  ).join('\n');

  return `<div class="donut-card"><div class="card-header"><span class="icon">🥧</span> ${title}</div>
    <div class="donut-wrap">
      <svg class="donut" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.04)" stroke-width="16"/>
        ${slices}
      </svg>
      <div class="donut-legend">${legend}</div>
    </div></div>`;
}

export function renderStatsGrid(): string {
  return `<div class="stat-flex">
    <div class="stat-card"><div class="card-header"><span class="icon">📊</span> Git Activity</div>
      <div class="stat-grid">
        <div class="stat-cell"><span class="stat-big" style="color:#00d4ff">17</span><span class="stat-sm">HMXOT</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#a855f7">10</span><span class="stat-sm">MyKB</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#3b82f6">6</span><span class="stat-sm">SPACE</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#ff8c00">5</span><span class="stat-sm">RSIS3</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#ef4444">3</span><span class="stat-sm">VEPA2</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#555">0</span><span class="stat-sm">GOLF</span></div>
      </div></div>
    <div class="stat-card"><div class="card-header"><span class="icon">📈</span> Stats Snapshot</div>
      <div class="stat-grid">
        <div class="stat-cell"><span class="stat-big" style="color:#a855f7">${allEntities().toLocaleString()}</span><span class="stat-sm">Total Entities</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#00ff9f">${allFiles().toLocaleString()}</span><span class="stat-sm">Total Files</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#3b82f6">8</span><span class="stat-sm">Active Projects</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#eab308">${allLoc().toLocaleString()}</span><span class="stat-sm">Total LOC</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#00d4ff">3</span><span class="stat-sm">COSMOS Core</span></div>
        <div class="stat-cell"><span class="stat-big" style="color:#ff8c00">4</span><span class="stat-sm">TS Packages</span></div>
      </div></div>
  </div>`;
}

export function renderDonutRow(): string {
  const entityData = [
    { label: 'MyKB', value: 2442, color: '#a855f7' },
    { label: 'SPACE', value: 420, color: '#3b82f6' },
    { label: 'RSIS3', value: 180, color: '#ff8c00' },
  ];
  const locData = [
    { label: 'SPACE', value: 209000, color: '#3b82f6' },
    { label: 'MyKB', value: 68000, color: '#a855f7' },
    { label: 'RSIS3', value: 7412, color: '#ff8c00' },
  ];
  return `<div class="donut-row">
    ${renderDonutChart('entity-dist', 'Entity Distribution', entityData)}
    ${renderDonutChart('loc-dist', 'LOC Distribution', locData)}
  </div>`;
}

// Helper: compute totals from project data
function allEntities(): number {
  let sum = 0;
  for (const p of cosmosProjects) sum += 0; // entities not in Project type
  return sum;
}
function allFiles(): number {
  let sum = 0;
  for (const p of cosmosProjects) if (p.stats?.files) sum += p.stats.files;
  return sum;
}
function allLoc(): number {
  let sum = 0;
  for (const p of cosmosProjects) if (p.stats?.loc) sum += p.stats.loc;
  return sum;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function sum(arr: Project[], fn: (p: Project) => number): number {
  return arr.reduce((a, p) => a + fn(p), 0);
}
