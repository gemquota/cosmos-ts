/**
 * Self-contained Telemetry Dashboard Server.
 *
 * TypeScript port of telemetry-dashboard/server.py.
 * Serves the dashboard frontend and provides JSON API access to telemetry data.
 *
 * Usage:
 *   ts-node telemetry-server.ts
 *   ts-node telemetry-server.ts --telemetry-dir ../rack/pulses --port 8080
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

// ── Types ──

export interface PulseFileInfo {
  filename: string;
  size: number;
  modified: string;
}

export interface ServerConfig {
  telemetryDir: string;
  frontendDir: string;
  port: number;
  host: string;
  dataFile: string;
}

// ── TelemetryServer ──

export class TelemetryServer {
  private config: ServerConfig;
  private server: http.Server | null;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = {
      telemetryDir: config.telemetryDir ?? '../rack/pulses',
      frontendDir: config.frontendDir ?? './frontend',
      port: config.port ?? 8080,
      host: config.host ?? '0.0.0.0',
      dataFile: config.dataFile ?? 'dashboard-data.json',
    };
    this.server = null;
  }

  /** Resolve a path string, handling relative paths. */
  private resolvePath(p: string, relativeTo?: string): string {
    const resolved = path.resolve(p);
    if (path.isAbsolute(resolved)) return resolved;
    if (relativeTo) return path.resolve(relativeTo, p);
    return resolved;
  }

  /** Send JSON response with CORS headers. */
  private sendJson(
    res: http.ServerResponse,
    data: unknown,
    status = 200,
  ): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(JSON.stringify(data, null, 2));
  }

  /** Send error JSON response. */
  private sendError(res: http.ServerResponse, message: string, status = 404): void {
    this.sendJson(res, { error: message }, status);
  }

  /** Load dashboard-data.json from telemetry dir. */
  private loadDashboardData(): unknown | null {
    const dataPath = path.join(
      this.config.telemetryDir,
      this.config.dataFile,
    );
    try {
      if (!fs.existsSync(dataPath)) return null;
      return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch (e) {
      return { error: `Failed to parse data: ${e}` };
    }
  }

  /** List all pulse JSON files in telemetry dir. */
  private listPulseFiles(): PulseFileInfo[] {
    const telDir = this.config.telemetryDir;
    try {
      if (!fs.existsSync(telDir)) return [];
      const files = fs
        .readdirSync(telDir)
        .filter((f) => f.startsWith('pulse-') && f.endsWith('.json'))
        .sort();
      return files.map((fname) => {
        const stat = fs.statSync(path.join(telDir, fname));
        return {
          filename: fname,
          size: stat.size,
          modified: new Date(stat.mtime).toISOString(),
        };
      });
    } catch {
      return [];
    }
  }

  /** Determine MIME type for static file serving. */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };
    return mimeTypes[ext] ?? 'application/octet-stream';
  }

  /** Serve a static file from the frontend directory. */
  private serveStatic(
    res: http.ServerResponse,
    filePath: string,
  ): void {
    const feDir = this.config.frontendDir;
    // Prevent directory traversal
    const resolved = path.resolve(feDir, filePath);
    if (!resolved.startsWith(path.resolve(feDir))) {
      this.sendError(res, 'Forbidden', 403);
      return;
    }

    try {
      const content = fs.readFileSync(resolved);
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, {
        'Content-Type': this.getMimeType(ext),
        'Content-Length': content.length,
      });
      res.end(content);
    } catch {
      this.sendError(res, 'File not found', 404);
    }
  }

  /** Handle OPTIONS request (CORS preflight). */
  private handleOptions(res: http.ServerResponse): void {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
  }

  /** Handle all incoming HTTP requests. */
  handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const parsedUrl = url.parse(req.url ?? '/', true);
    const pathname = parsedUrl.pathname ?? '/';

    // CORS preflight
    if (req.method === 'OPTIONS') {
      this.handleOptions(res);
      return;
    }

    // ── API Routes ──

    if (pathname === '/api/data') {
      const data = this.loadDashboardData();
      if (data === null) {
        return this.sendError(
          res,
          `No telemetry data found at ${path.join(this.config.telemetryDir, this.config.dataFile)}`,
        );
      }
      return this.sendJson(res, data);
    }

    if (pathname === '/api/pulses') {
      const pulses = this.listPulseFiles();
      return this.sendJson(res, { count: pulses.length, files: pulses });
    }

    if (pathname.startsWith('/api/pulses/')) {
      const filename = pathname.slice('/api/pulses/'.length);
      const filepath = path.join(this.config.telemetryDir, filename);
      if (!fs.existsSync(filepath) || !filename.endsWith('.json')) {
        return this.sendError(res, `Pulse file not found: ${filename}`);
      }
      try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        return this.sendJson(res, data);
      } catch (e) {
        return this.sendError(res, `Failed to read pulse: ${e}`);
      }
    }

    if (pathname === '/api/status') {
      const data = this.loadDashboardData();
      return this.sendJson(res, {
        data_loaded: data !== null,
        telemetry_dir: this.config.telemetryDir,
        pulse_files: this.listPulseFiles().length,
      });
    }

    if (pathname === '/api/config') {
      return this.sendJson(res, {
        telemetry_dir: this.config.telemetryDir,
        frontend_dir: this.config.frontendDir,
        data_file: this.config.dataFile,
      });
    }

    // ── Serve static files (from frontend/) ──

    // If root, serve index.html
    const staticPath = pathname === '/' || pathname === '' ? '/index.html' : pathname;
    this.serveStatic(res, staticPath);
  }

  /** Log message in the style of the Python server. */
  private logMessage(
    clientAddr: string,
    method: string,
    pathname: string,
    status: number,
  ): void {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    process.stderr.write(`[${timestamp}] ${clientAddr} "${method} ${pathname}" ${status}\n`);
  }

  /** Start the HTTP server. */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const feDir = this.config.frontendDir;
      const telDir = this.config.telemetryDir;

      // Validate frontend
      if (!fs.existsSync(feDir)) {
        console.error(`Error: Frontend directory not found: ${feDir}`);
        console.error('Ensure --frontend-dir points to a directory with index.html');
        reject(new Error(`Frontend directory not found: ${feDir}`));
        return;
      }

      if (!fs.existsSync(path.join(feDir, 'index.html'))) {
        console.error(`Error: No index.html found in ${feDir}`);
        reject(new Error(`No index.html in ${feDir}`));
        return;
      }

      // Warn if telemetry dir missing
      if (!fs.existsSync(telDir)) {
        console.warn(`Warning: Telemetry directory not found: ${telDir}`);
        console.warn('The dashboard will load but show no data until telemetry exists.');
      } else {
        const dataPath = path.join(telDir, this.config.dataFile);
        if (!fs.existsSync(dataPath)) {
          console.warn(`Warning: Data file not found: ${dataPath}`);
        } else {
          const size = fs.statSync(dataPath).size;
          console.log(`  Data file: ${dataPath} (${size.toLocaleString()} bytes)`);
        }
      }

      this.server = http.createServer((req, res) => {
        // Wrap sendJson/sendError to also log
        const origEnd = res.end.bind(res);
        const self = this;
        res.end = function (this: http.ServerResponse, ...args: unknown[]): http.ServerResponse {
          self.logMessage(
            req.socket.remoteAddress ?? 'unknown',
            req.method ?? 'GET',
            req.url ?? '/',
            this.statusCode,
          );
          return origEnd(...(args as Parameters<typeof origEnd>));
        } as typeof res.end;

        this.handleRequest(req, res);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        console.log('='.repeat(60));
        console.log('  RSIS Telemetry Dashboard');
        console.log('='.repeat(60));
        console.log(`  URL:      http://localhost:${this.config.port}`);
        console.log(`  Frontend: ${feDir}`);
        console.log(`  Data:     ${path.join(telDir, this.config.dataFile)}`);
        console.log(`  API:      http://localhost:${this.config.port}/api/data`);
        console.log('='.repeat(60));
        console.log('  Press Ctrl+C to stop');
        console.log();
        resolve();
      });
    });
  }

  /** Stop the HTTP server. */
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

// ── CLI (when run directly) ──

function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {
    telemetryDir: '../rack/pulses',
    frontendDir: './frontend',
    port: 8080,
    host: '0.0.0.0',
    dataFile: 'dashboard-data.json',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--telemetry-dir':
        config.telemetryDir = args[++i] ?? config.telemetryDir;
        break;
      case '--frontend-dir':
        config.frontendDir = args[++i] ?? config.frontendDir;
        break;
      case '--port':
        config.port = parseInt(args[++i] ?? '8080', 10);
        break;
      case '--host':
        config.host = args[++i] ?? config.host;
        break;
      case '--data-file':
        config.dataFile = args[++i] ?? config.dataFile;
        break;
      case '--help':
        console.log(`Usage: telemetry-server [options]
Options:
  --telemetry-dir DIR   Path to telemetry data (default: ../rack/pulses)
  --frontend-dir DIR    Path to frontend static files (default: ./frontend)
  --port PORT           Server port (default: 8080)
  --host HOST           Server host (default: 0.0.0.0)
  --data-file FILE      Telemetry data filename (default: dashboard-data.json)
  --help                Show this help`);
        process.exit(0);
    }
  }

  return config;
}

// Run directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('telemetry-server.ts');

if (isMainModule) {
  const scriptDir = import.meta.dirname;
  const config = parseArgs();
  const server = new TelemetryServer({
    telemetryDir: path.resolve(scriptDir, config.telemetryDir),
    frontendDir: path.resolve(scriptDir, config.frontendDir),
    port: config.port,
    host: config.host,
    dataFile: config.dataFile,
  });
  server.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
