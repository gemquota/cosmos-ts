import { renderFilterBar, renderCosmosCard, renderProjectGrid, renderCharts } from './components.js';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

const styles = getComputedStyle(document.documentElement);
const isDark = styles.getPropertyValue('--bg')?.trim() || true;

app.innerHTML = `
  ${renderFilterBar()}
  <h1>✦ COSMOS Dashboard</h1>
  <div class="subtitle">All projects · real data · TypeScript</div>
  ${renderCosmosCard()}
  ${renderProjectGrid()}
  
  <!-- MODULE: Charts -->
  <div class="module-label"><span class="icon">📊</span> Charts <span class="hdr-sub">stacked · toggle for separate bars</span></div>
  ${renderCharts()}
  
  <div class="footer">Generated ${new Date().toISOString().slice(0,10)} · <a href="https://github.com/gemquota/cosmos">COSMOS</a> · TypeScript Dashboard</div>
`;

// Re-attach toggle handlers (they get cloned with innerHTML)
document.querySelectorAll('.chart-toggle').forEach(el => {
  el.addEventListener('click', () => {
    const target = el.getAttribute('data-target');
    if (!target) return;
    const stacked = document.getElementById(target + '-stacked');
    const grouped = document.getElementById(target + '-grouped');
    if (!stacked || !grouped) return;
    const isStacked = !stacked.classList.contains('hidden');
    if (isStacked) {
      stacked.classList.add('hidden');
      grouped.classList.remove('hidden');
      el.textContent = '▦ Stacked';
      el.classList.add('active');
    } else {
      grouped.classList.add('hidden');
      stacked.classList.remove('hidden');
      el.textContent = '▤ Separate';
      el.classList.remove('active');
    }
  });
});
