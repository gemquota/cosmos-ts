/**
 * Telemetry collection for RSIS loops.
 * Deep port of Python telemetry.py — event recording, session tracking, workspace monitoring.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface TelemetryEventData {
  eventType: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  sessionId?: string;
}

export class TelemetryCollector {
  private telemetryDir: string;
  private flushIntervalMs: number;
  private buffer: TelemetryEventData[] = [];
  private sessionId: string;
  private running: boolean = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private eventCounter: number = 0;

  constructor(telemetryDir: string, flushIntervalMs: number = 5000) {
    this.telemetryDir = telemetryDir;
    this.flushIntervalMs = flushIntervalMs;
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    fs.mkdirSync(this.telemetryDir, { recursive: true });

    // Create session file
    const sessionFile = path.join(this.telemetryDir, `${this.sessionId}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify({
      session_id: this.sessionId,
      start_time: new Date().toISOString(),
      events: [],
    }, null, 2));

    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    // Allow process to exit even if timer is active
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      this.flushTimer.unref();
    }
  }

  stop(): void {
    this.running = false;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  record(event: TelemetryEventData): void {
    this.buffer.push({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      sessionId: event.sessionId || this.sessionId,
    });
    this.eventCounter++;

    // Flush immediately if buffer is getting large (matches Python heuristics)
    if (this.buffer.length >= 100) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0);
    const sessionFile = path.join(this.telemetryDir, `${this.sessionId}.json`);

    try {
      // Append events to session file
      const existing: { events: TelemetryEventData[] } = JSON.parse(
        fs.readFileSync(sessionFile, 'utf-8')
      );
      existing.events.push(...events);

      // Prune old events to keep file manageable (keep last 1000)
      if (existing.events.length > 1000) {
        existing.events = existing.events.slice(-1000);
      }

      fs.writeFileSync(sessionFile, JSON.stringify(existing, null, 2));
    } catch (err) {
      console.error('Failed to flush telemetry:', err);
      // Put events back
      this.buffer.unshift(...events);
    }
  }

  sessionReport(): Record<string, unknown> {
    return {
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      events_collected: this.eventCounter,
    };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  /** Get recent telemetry events for analysis */
  getRecentEvents(limit: number = 50): TelemetryEventData[] {
    const sessionFile = path.join(this.telemetryDir, `${this.sessionId}.json`);
    try {
      const data: { events: TelemetryEventData[] } = JSON.parse(
        fs.readFileSync(sessionFile, 'utf-8')
      );
      return data.events.slice(-limit);
    } catch {
      return [];
    }
  }
}

export class WorkspaceMonitor {
  private hasPsutil: boolean = false;

  constructor() {
    // In Node.js, we use process.memoryUsage() and os modules instead of psutil
    try {
      // Verify os module works
      require('node:os');
      this.hasPsutil = true; // effectively, we have os module
    } catch {
      this.hasPsutil = false;
    }
  }

  cpuUsage(): number | null {
    try {
      const os = require('node:os') as typeof import('node:os');
      const cpus = os.cpus();
      const idle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0);
      const total = cpus.reduce((sum, cpu) => {
        return sum + cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
      }, 0);
      // This gives a cumulative measure; for instantaneous we'd need two samples
      return Math.round((1 - idle / total) * 100);
    } catch {
      return null;
    }
  }

  memoryUsageMb(): number | null {
    try {
      const usage = process.memoryUsage();
      return Math.round(usage.rss / (1024 * 1024));
    } catch {
      return null;
    }
  }

  diskUsagePct(diskPath: string = '.'): number | null {
    try {
      const { statfs } = require('node:fs') as typeof import('node:fs');
      // Node.js doesn't have a portable statfs, approximate with available free space
      // This is a simplified version
      return null; // Would need fs.statfs (Node 22+) or platform-specific
    } catch {
      return null;
    }
  }
}
