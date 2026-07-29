import { Project, projects, cosmosComponents, otherProjects } from './data/projects.js';

export function renderFilterBar(): string {
  return `<div class="filter-bar">
    <a href="index.html" class="filter-btn active">All</a>
    <a href="ai.html" class="filter-btn">☯ AI / RSI</a>
    <a href="non-ai.html" class="filter-btn">🔧 Non-AI</a>
  </div>`;
}

export function renderCosmosCard(): string {
  const comps = cosmosComponents.map(p => {
    const [r, g, b] = hexToRgb(p.color);
    const [br, bg, bb] = hexToRgb(p.badgeColor);
    return `<a href="${p.href}" style="display:block;background:rgba(${r},${g},${b},.08);border:1px solid rgba(${r},${g},${b},.15);border-radius:8px;padding:.4rem .5rem;text-decoration:none">
      <div style="display:flex;justify-content:space-between;margin-bottom:.15rem">
        <span style="font-weight:700;font-size:.7rem;color:${p.color}">${p.name}</span>
        <span style="font-size:.5rem;padding:1px 8px;border-radius:8px;background:rgba(${br},${bg},${bb},.15);color:${p.badgeColor};border:1px solid rgba(${br},${bg},${bb},.25);font-weight:600">${p.badge}</span>
      </div>
      <div style="font-size:.55rem;color:#999;margin-bottom:.1rem">${p.stats ? `${p.stats.files.toLocaleString()} files · ${(p.stats.loc/1000).toFixed(0)}k LOC` : ''}</div>
      <div style="font-size:.5rem;color:#666">${p.description}</div>
    </a>`;
  }).join('\n');

  return `<!-- MODULE: COSMOS -->
<div class="module-label"><span class="icon">🌌</span> COSMOS Ecosystem <span class="hdr-sub">v0.1.0 · <a href="https://github.com/gemquota/cosmos" style="color:#888">gemquota/cosmos</a></span></div>
<div class="card" style="background:linear-gradient(135deg,#161822 0%,#1a1030 50%,#161822 100%);border-color:rgba(123,47,255,.15)">
  <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem;flex-wrap:wrap">
    <span style="font-size:1.5rem">🌌</span>
    <div>
      <div style="font-size:.9rem;font-weight:700;color:#e0e0e0">Comprehensive Ontological System for Meta-cognitive Orchestration &amp; Synthesis</div>
      <div style="font-size:.6rem;color:#666;margin-top:1px">
        <span style="color:#a855f7">${cosmosComponents.length} components</span>
        · <span style="color:#3b82f6">~${sum(cosmosComponents, p => p.stats?.files ?? 0).toLocaleString()} files</span>
        · <span style="color:#00ff9f">~${(sum(cosmosComponents, p => p.stats?.loc ?? 0)/1000).toFixed(0)}k LOC</span>
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
  const cards = otherProjects.map(p => {
    const [br, bg, bb] = hexToRgb(p.badgeColor);
    const pills = p.tags.map(t => `<span style="font-size:.5rem;padding:1px 6px;border-radius:8px;background:rgba(255,255,255,.06);color:#999;border:1px solid rgba(255,255,255,.04)">${t}</span>`).join('');
    return `<a href="${p.href}" class="proj-card" style="border-left:3px solid ${p.color}">
      <div class="p-row"><span style="font-weight:700;font-size:.8rem;color:${p.color}">${p.name}</span>
      <span class="p-badge ${p.badge.toLowerCase()}" style="font-size:.5rem;padding:1px 8px;border-radius:8px;background:rgba(${br},${bg},${bb},.15);color:${p.badgeColor};border:1px solid rgba(${br},${bg},${bb},.25);font-weight:600;letter-spacing:.3px">${p.badge}</span></div>
      <div style="font-size:.6rem;color:#777;margin:.1rem 0 .2rem">${p.description}</div>
      <div style="display:flex;flex-wrap:wrap;gap:.2rem">${pills}</div>
    </a>`;
  }).join('\n');
  
  return `<!-- MODULE: Other Projects -->
<div class="module-label"><span class="icon">🗂️</span> Other Projects</div>
<div class="card"><div class="proj-grid">${cards}</div></div>`;
}

export function renderCharts(): string {
  const charts = [
    { id: 'disk-usage', icon: '💾', title: 'Disk Usage', data: [
      ['SPACE', 46.5, '#3b82f6', '512MB'], ['VEPA2', 31.6, '#ef4444', '348MB'], ['MyKB', 19.5, '#a855f7', '215MB'],
      ['HMXOT', 14.5, '#00d4ff', '160MB'], ['GOLF', 8.4, '#eab308', '92MB'], ['RSIS3', 2.8, '#ff8c00', '31MB'] ] },
    { id: 'entity-count', icon: '📦', title: 'Entity Count', data: [
      ['VEPA2', 39.9, '#ef4444', '680'], ['SPACE', 24.6, '#3b82f6', '420'], ['HMXOT', 18.8, '#00d4ff', '320'], ['RSIS3', 10.6, '#ff8c00', '180'] ] },
    { id: 'file-count', icon: '📄', title: 'File Count', data: [
      ['SPACE', 37.0, '#3b82f6', '9,901'], ['VEPA2', 33.6, '#ef4444', '8,982'], ['MyKB', 12.5, '#a855f7', '3,351'],
      ['HMXOT', 4.7, '#00d4ff', '1,269'], ['RSIS3', 2.3, '#ff8c00', '627'] ] },
    { id: 'loc', icon: '⚡', title: 'Lines of Code', data: [
      ['HMXOT', 45.1, '#00d4ff', '952k'], ['VEPA2', 25.2, '#ef4444', '532k'], ['SPACE', 9.9, '#3b82f6', '209k'],
      ['MyKB', 3.2, '#a855f7', '68k'], ['RSIS3', 2.0, '#ff8c00', '42k'] ] },
  ];

  return charts.map(c => {
    const stacked = c.data.map(d => `<div class="seg" style="width:${d[1]}%;background:${d[2]}" title="${d[0]}: ${d[3]}"></div>`).join('');
    const legend = c.data.map(d => `<span class="leg-item"><span class="leg-swatch" style="background:${d[2]}"></span> ${d[0]}: ${d[3]}</span>`).join('');
    const grouped = c.data.map(d => `<div class="comp-row"><span class="lbl">${d[0]}</span><div class="track"><div class="fill" style="width:${d[1]}%;background:${d[2]}"></div></div><span class="pct">${d[3]}</span></div>`).join('');
    
    return `<div class="card">
      <div class="card-header"><span class="icon">${c.icon}</span> ${c.title}<span class="chart-toggle" data-target="${c.id}" onclick="toggleChart('${c.id}')">▤ Separate</span></div>
      <div id="${c.id}-stacked" class="chart-view"><div class="stacked-bar-wrap"><div class="stacked-bar">${stacked}</div><div class="stacked-legend">${legend}</div></div></div>
      <div id="${c.id}-grouped" class="chart-view hidden">${grouped}</div>
    </div>`;
  }).join('\n');
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function sum(arr: Project[], fn: (p: Project) => number): number {
  return arr.reduce((a, p) => a + fn(p), 0);
}
