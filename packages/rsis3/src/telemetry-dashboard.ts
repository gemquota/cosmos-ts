/**
 * Telemetry Dashboard server with pulse data API.
 *
 * TypeScript port of telemetry-dashboard/backend/app.py (FastAPI → Node.js http).
 * Serves aggregate stats, score history, constraint tracking endpoints.
 */

import * as http from 'node:http';
import * as url from 'node:url';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { CONFIG } from './config.js';
import { TelemetryExtrapolator } from './extrapolation.js';
import { MemoryManager } from './memory.js';

// ── Types ──

export interface TelemetryDashboardStatus {
  kg_nodes: number;
  kg_edges: number;
  vector_docs: number;
  strategies: number;
  sessions: number;
  optimal_l2_budget: number;
}

// ── getData (port of _get_data helper) ──

function getData(): { memory: MemoryManager; extrap: TelemetryExtrapolator } {
  const memory = new MemoryManager(CONFIG.workspaceDir);
  const extrap = new TelemetryExtrapolator();
  return { memory, extrap };
}

// ── TelemetryDashboard ──

export class TelemetryDashboard {
  private server: http.Server | null;
  private port: number;
  private host: string;
  private templatesDir: string;

  constructor(
    options: { port?: number; host?: string; templatesDir?: string } = {},
  ) {
    this.port = options.port ?? 3001;
    this.host = options.host ?? '0.0.0.0';
    this.templatesDir =
      options.templatesDir ?? path.resolve(import.meta.dirname, '..', 'templates');
    this.server = null;
  }

  /** Render a simple HTML template string with variable substitution. */
  private renderTemplate(
    templateName: string,
    vars: Record<string, unknown>,
  ): string {
    const tmplPath = path.join(this.templatesDir, templateName);
    try {
      let html = fs.readFileSync(tmplPath, 'utf-8');
      for (const [key, val] of Object.entries(vars)) {
        html = html.replaceAll(`{{ ${key} }}`, String(val));
      }
      return html;
    } catch {
      return this.fallbackHtml(vars);
    }
  }

  private fallbackHtml(vars: Record<string, unknown>): string {
    return `<!DOCTYPE html>
<html><head><title>Telemetry Dashboard</title></head>
<body>
  <h1>RSIS Telemetry Dashboard</h1>
  <pre>${JSON.stringify(vars, null, 2)}</pre>
</body></html>`;
  }

  private sendJson(
    res: http.ServerResponse,
    data: unknown,
    status = 200,
  ): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
  }

  private sendHtml(res: http.ServerResponse, html: string, status = 200): void {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  /** Handle incoming HTTP request, matching routes from the Python FastAPI app. */
  handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const parsedUrl = url.parse(req.url ?? '/', true);
    const pathname = parsedUrl.pathname ?? '/';

    try {
      switch (pathname) {
        case '/': {
          const { memory, extrap } = getData();
          const graph = memory.knowledgeGraph.getGraph();
          const recent = memory.getRecent(10);
          const velocity = extrap.fitLinear(
            [{ timestamp: Date.now(), value: graph.nodes.length, label: 'kg' }],
            10,
          );
          const trends = extrap.detectPlateaus(
            graph.nodes.map((n, i) => ({
              timestamp: i,
              value: 1,
              label: n.label,
            })),
          );
          const sessions = memory.getRecent(20);

          const html = this.renderTemplate('index.html', {
            velocity: JSON.stringify(velocity),
            trends: JSON.stringify(trends),
            sessions: JSON.stringify(sessions),
            kg_nodes: graph.nodes.length,
            kg_edges: graph.edges.length,
            vec_docs: graph.nodes.length,
            strategies: JSON.stringify(graph.nodes.filter(n => n.type === 'strategy')),
            recent_insights: JSON.stringify(recent),
            optimal_iters: velocity.forecast,
          });
          this.sendHtml(res, html);
          break;
        }

        case '/api/status': {
          const { memory, extrap } = getData();
          const graph = memory.knowledgeGraph.getGraph();
          const velocity = extrap.fitLinear(
            [{ timestamp: Date.now(), value: graph.nodes.length, label: 'kg' }],
            10,
          );
          const status: TelemetryDashboardStatus = {
            kg_nodes: graph.nodes.length,
            kg_edges: graph.edges.length,
            vector_docs: graph.nodes.length,
            strategies: graph.nodes.filter(n => n.type === 'strategy').length,
            sessions: memory.getRecent(100).length,
            optimal_l2_budget: Math.round(velocity.forecast),
          };
          this.sendJson(res, status);
          break;
        }

        case '/api/trends': {
          const { memory, extrap } = getData();
          const graph = memory.knowledgeGraph.getGraph();
          const trends = extrap.detectPlateaus(
            graph.nodes.map((n, i) => ({
              timestamp: i,
              value: 1,
              label: n.label,
            })),
          );
          this.sendJson(res, { trends });
          break;
        }

        case '/api/velocity': {
          const { memory, extrap } = getData();
          const graph = memory.knowledgeGraph.getGraph();
          const report = extrap.fitLinear(
            [{ timestamp: Date.now(), value: graph.nodes.length, label: 'kg' }],
            10,
          );
          this.sendJson(res, report);
          break;
        }

        case '/api/search': {
          const q = (parsedUrl.query.q as string) ?? '';
          const { memory } = getData();
          const results = q ? memory.searchSimilar(q, 10) : [];
          const html = this.renderTemplate('_search_results.html', {
            results: JSON.stringify(results),
          });
          this.sendHtml(res, html);
          break;
        }

        case '/health': {
          this.sendJson(res, { status: 'ok' });
          break;
        }

        default:
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (err) {
      console.error('TelemetryDashboard error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) =>
        this.handleRequest(req, res),
      );
      this.server.listen(this.port, this.host, () => {
        console.log(
          `Telemetry Dashboard listening on http://${this.host}:${this.port}`,
        );
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => (err ? reject(err) : resolve()));
      } else {
        resolve();
      }
    });
  }
}
