/**
 * Resource monitoring and enforcement for RSIS.
 * Deep port of Python resource_monitor.py — threshold-based alerts, halt, throttle.
 */

import * as os from 'node:os';
import * as fs from 'node:fs';
import { CONFIG } from './config.js';
import { sleep } from './timeout.js';

export enum ResourceSeverity {
  OK = 'ok',
  WARNING = 'warning',
  CRITICAL = 'critical',
  THROTTLE = 'throttle',
  HALT = 'halt',
}

export interface ResourceAlert {
  resource: string;
  severity: ResourceSeverity;
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
}

export class ResourceEnforcer {
  private alerts: ResourceAlert[] = [];
  private running: boolean = false;
  private monitorTimer: ReturnType<typeof setInterval> | null = null;
  private _haltRequested: boolean = false;
  private onHaltCallback: ((msg: string) => void) | null = null;
  private onThrottleCallback: ((msg: string) => void) | null = null;

  get haltRequested(): boolean {
    return this._haltRequested;
  }

  setCallbacks(onHalt: (msg: string) => void, onThrottle: (msg: string) => void): void {
    this.onHaltCallback = onHalt;
    this.onThrottleCallback = onThrottle;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.alerts = [];

    this.monitorTimer = setInterval(() => this._check(), 5_000);
    if (this.monitorTimer && typeof this.monitorTimer === 'object' && 'unref' in this.monitorTimer) {
      this.monitorTimer.unref();
    }
  }

  stop(): void {
    this.running = false;
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  // ── Resource checks ──────────────────────────────────────────────

  private _check(): void {
    // Memory check
    const memUsage = process.memoryUsage();
    const rssMb = memUsage.rss / (1024 * 1024);
    if (rssMb > CONFIG.resources.maxMemoryRssMb) {
      this._triggerAlert({
        resource: 'memory',
        severity: ResourceSeverity.HALT,
        message: `Memory RSS ${rssMb.toFixed(0)}MB exceeds limit ${CONFIG.resources.maxMemoryRssMb}MB`,
        currentValue: rssMb,
        threshold: CONFIG.resources.maxMemoryRssMb,
        timestamp: Date.now(),
      });
    } else if (rssMb > CONFIG.resources.maxMemoryRssMb * 0.8) {
      this._triggerAlert({
        resource: 'memory',
        severity: ResourceSeverity.WARNING,
        message: `Memory RSS ${rssMb.toFixed(0)}MB approaching limit ${CONFIG.resources.maxMemoryRssMb}MB`,
        currentValue: rssMb,
        threshold: CONFIG.resources.maxMemoryRssMb * 0.8,
        timestamp: Date.now(),
      });
    }

    // CPU check
    const cpuCount = os.cpus().length;
    const loadAvg = os.loadavg()[0] / cpuCount;
    if (loadAvg > 0.9) {
      this._triggerAlert({
        resource: 'cpu',
        severity: ResourceSeverity.THROTTLE,
        message: `CPU load ${(loadAvg * 100).toFixed(0)}% — throttling recommended`,
        currentValue: loadAvg,
        threshold: 0.9,
        timestamp: Date.now(),
      });
    }

    // Disk check (approximate via statfs-like approach)
    try {
      const { execSync } = require('node:child_process');
      const df = execSync('df -P .', { encoding: 'utf-8' });
      const lines = df.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        const usagePct = parseFloat(parts[4]?.replace('%', '') || '0');
        if (usagePct > CONFIG.resources.diskUsagePct) {
          this._triggerAlert({
            resource: 'disk',
            severity: ResourceSeverity.HALT,
            message: `Disk usage ${usagePct}% exceeds limit ${CONFIG.resources.diskUsagePct}%`,
            currentValue: usagePct,
            threshold: CONFIG.resources.diskUsagePct,
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // df not available, skip disk check
    }
  }

  private _triggerAlert(alert: ResourceAlert): void {
    this.alerts.push(alert);
    const msg = `[${alert.severity}] ${alert.resource}: ${alert.message}`;

    switch (alert.severity) {
      case ResourceSeverity.HALT:
        this._haltRequested = true;
        console.error(`HALT: ${msg}`);
        this.onHaltCallback?.(msg);
        break;
      case ResourceSeverity.THROTTLE:
      case ResourceSeverity.WARNING:
        console.warn(msg);
        this.onThrottleCallback?.(msg);
        break;
      default:
        console.log(msg);
    }

    // Keep alert history bounded
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /** Check resources before an operation. Returns warning message or null. */
  checkBeforeOperation(): string | null {
    const memUsage = process.memoryUsage();
    const rssMb = memUsage.rss / (1024 * 1024);

    if (rssMb > CONFIG.resources.maxMemoryRssMb) {
      return `Memory limit exceeded: ${rssMb.toFixed(0)}MB > ${CONFIG.resources.maxMemoryRssMb}MB`;
    }
    if (rssMb > CONFIG.resources.maxMemoryRssMb * 0.85) {
      return `High memory usage: ${rssMb.toFixed(0)}MB (limit: ${CONFIG.resources.maxMemoryRssMb}MB)`;
    }
    return null;
  }

  /** Get recent alerts */
  getRecentAlerts(limit: number = 20): ResourceAlert[] {
    return this.alerts.slice(-limit);
  }

  /** Clear alert history */
  clearAlerts(): void {
    this.alerts = [];
  }
}
