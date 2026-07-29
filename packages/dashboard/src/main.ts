import { renderFilterBar, renderCosmosCard, renderProjectGrid, renderCharts, renderStatsGrid, renderDonutRow } from './components.js';
import { cosmosProjects } from './data/projects.js';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

app.innerHTML = `
  ${renderFilterBar()}
  <h1>✦ COSMOS Dashboard</h1>
  <div class="subtitle">${cosmosProjects.length} components · TypeScript monorepo</div>
  ${renderCosmosCard()}
  
  <div class="module-label"><span class="icon">📈</span> Stats &amp; Activity</div>
  ${renderStatsGrid()}
  
  <div class="module-label"><span class="icon">🥧</span> Distribution</div>
  ${renderDonutRow()}
  
  <div class="module-label"><span class="icon">📊</span> Charts <span class="hdr-sub">stacked · toggle separate bars</span></div>
  ${renderCharts()}
  
  <div class="footer">COSMOS v0.1.0 · <a href="https://github.com/gemquota/cosmos-ts">cosmos-ts</a> · <a href="https://gemquota.github.io/hub/">Hub</a></div>
`;
