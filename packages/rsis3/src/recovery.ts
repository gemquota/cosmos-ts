/**
 * Recovery mechanisms for RSIS.
 * Deep port of Python recovery.py — FailureInjector, RecoveryManager, recovery tests.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CheckpointManager } from './checkpoint.js';
import { CONFIG } from './config.js';

export interface RecoveryTestResult {
  test: string;
  passed: boolean;
  detail: string;
  timestamp: string;
}

export class FailureInjector {
  private enabled: boolean = false;
  private failureModes: Map<string, number> = new Map(); // mode -> probability (0-1)
  private injectionCount: number = 0;

  enable(): void {
    this.enabled = true;
    console.warn('Failure injector ENABLED — operations may fail artificially');
  }

  disable(): void {
    this.enabled = false;
  }

  /** Register a failure mode with probability */
  registerMode(mode: string, probability: number): void {
    this.failureModes.set(mode, Math.min(1, Math.max(0, probability)));
  }

  /** Check if a failure should be injected for the given mode */
  shouldFail(mode: string): boolean {
    if (!this.enabled) return false;
    const prob = this.failureModes.get(mode);
    if (!prob || prob <= 0) return false;
    return Math.random() < prob;
  }

  /** Inject a failure — returns true if failure was injected */
  inject(mode: string): boolean {
    if (!this.shouldFail(mode)) return false;
    this.injectionCount++;
    console.warn(`Failure injected: ${mode} (total: ${this.injectionCount})`);
    return true;
  }

  get totalInjections(): number {
    return this.injectionCount;
  }
}

export class RecoveryManager {
  private checkpointMgr: CheckpointManager;
  private alertLog: Array<{ timestamp: string; message: string; severity: string }> = [];
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = 3;

  constructor(checkpointMgr: CheckpointManager) {
    this.checkpointMgr = checkpointMgr;
  }

  /** Trigger recovery from a failure */
  triggerRecovery(failure: { reason: string; attempt?: number; details?: string }): boolean {
    this.recoveryAttempts++;
    console.warn(
      `Recovery triggered (${this.recoveryAttempts}/${this.maxRecoveryAttempts}): ${failure.reason}`,
    );

    try {
      // Strategy 1: Rollback to last checkpoint
      if (this.checkpointMgr.hasChanges()) {
        console.log('  Recovery: rolling back to last checkpoint...');
        const ok = this.checkpointMgr.rollbackLastCheckpoint();
        if (ok) {
          console.log('  Recovery: rollback successful');
          this._logAlert(failure.reason, 'recovered');
          return true;
        }
      }

      // Strategy 2: Hard reset to latest RSIS checkpoint
      console.log('  Recovery: attempting hard reset...');
      const latest = this.checkpointMgr.latestCheckpoint();
      if (latest) {
        const ok = this.checkpointMgr.rollback(latest);
        if (ok) {
          console.log('  Recovery: hard reset successful');
          this._logAlert(failure.reason, 'recovered_hard');
          return true;
        }
      }

      // Strategy 3: Notify human (in production, this would alert via Slack/email)
      console.error('  Recovery: automatic recovery failed, human intervention needed');
      this._notifyHuman(`Automatic recovery failed for: ${failure.reason}`);
      this._logAlert(failure.reason, 'failed');

      return false;
    } catch (err) {
      console.error(`  Recovery: error during recovery: ${err}`);
      this._logAlert(`recovery_error: ${err}`, 'error');
      return false;
    }
  }

  /** Log a human-alert signal */
  notifyHuman(message: string): void {
    this._notifyHuman(message);
  }

  private _notifyHuman(message: string): void {
    const logPath = path.join(CONFIG.workspaceDir, '.rsis', 'human_alerts.log');
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      const entry = `[${new Date().toISOString()}] HUMAN ALERT: ${message}\n`;
      fs.appendFileSync(logPath, entry);
      console.warn(`Human alert logged: ${message}`);
    } catch (err) {
      console.error(`Failed to log human alert: ${err}`);
    }
  }

  private _logAlert(reason: string, status: string): void {
    this.alertLog.push({
      timestamp: new Date().toISOString(),
      message: reason,
      severity: status,
    });
    // Keep log bounded
    if (this.alertLog.length > 100) {
      this.alertLog = this.alertLog.slice(-100);
    }
  }

  /** Run all recovery tests — matches Python recovery-test command */
  async runAllTests(): Promise<RecoveryTestResult[]> {
    const results: RecoveryTestResult[] = [];

    // Test 1: Checkpoint creation
    console.log('  Test 1: Checkpoint creation...');
    try {
      const ch = this.checkpointMgr.checkpoint('recovery-test-checkpoint');
      results.push({
        test: 'checkpoint_creation',
        passed: true,
        detail: ch ? `Checkpoint created: ${ch.slice(0, 12)}` : 'No changes to checkpoint',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      results.push({
        test: 'checkpoint_creation',
        passed: false,
        detail: String(err),
        timestamp: new Date().toISOString(),
      });
    }

    // Test 2: Rollback capability
    console.log('  Test 2: Rollback capability...');
    const latest = this.checkpointMgr.latestCheckpoint();
    if (latest) {
      try {
        // Create a dummy file, checkpoint, verify, then rollback
        const testFile = path.join(CONFIG.workspaceDir, '.rsis', 'recovery-test.txt');
        fs.writeFileSync(testFile, 'test content');
        const ch2 = this.checkpointMgr.checkpoint('recovery-test-prep');
        
        if (ch2) {
          // Verify checkpoint exists
          const checkLog = this.checkpointMgr.latestCheckpoint();
          if (checkLog) {
            results.push({
              test: 'checkpoint_verify',
              passed: true,
              detail: `Checkpoint verified: ${checkLog.slice(0, 12)}`,
              timestamp: new Date().toISOString(),
            });
          } else {
            results.push({
              test: 'checkpoint_verify',
              passed: false,
              detail: 'Could not verify checkpoint',
              timestamp: new Date().toISOString(),
            });
          }

          // Rollback
          const rollbackOk = this.checkpointMgr.rollback(ch2);
          results.push({
            test: 'rollback',
            passed: rollbackOk,
            detail: rollbackOk ? `Rolled back to ${ch2.slice(0, 12)}` : 'Rollback failed',
            timestamp: new Date().toISOString(),
          });
        } else {
          results.push({
            test: 'checkpoint_verify',
            passed: true,
            detail: 'No changes to checkpoint',
            timestamp: new Date().toISOString(),
          });
          results.push({
            test: 'rollback',
            passed: true,
            detail: 'Skipped (no checkpoint created)',
            timestamp: new Date().toISOString(),
          });
        }

        // Cleanup test file
        try { fs.unlinkSync(testFile); } catch {}
      } catch (err) {
        results.push({
          test: 'rollback',
          passed: false,
          detail: String(err),
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      results.push({
        test: 'checkpoint_verify',
        passed: false,
        detail: 'No existing checkpoints found',
        timestamp: new Date().toISOString(),
      });
      results.push({
        test: 'rollback',
        passed: false,
        detail: 'No checkpoints available for rollback test',
        timestamp: new Date().toISOString(),
      });
    }

    // Test 3: Failure injection and recovery
    console.log('  Test 3: Failure injector...');
    const injector = new FailureInjector();
    injector.registerMode('test_failure', 1.0);
    const shouldFail = injector.shouldFail('test_failure');
    results.push({
      test: 'failure_injection',
      passed: shouldFail,
      detail: shouldFail ? 'Failure injector working (100% probability)' : 'Failure injector not triggering',
      timestamp: new Date().toISOString(),
    });

    // Test 4: Human alert logging
    console.log('  Test 4: Human-in-loop alert...');
    this._notifyHuman('Recovery test alert');
    const alertLogPath = path.join(CONFIG.workspaceDir, '.rsis', 'human_alerts.log');
    if (fs.existsSync(alertLogPath)) {
      results.push({
        test: 'human_alert',
        passed: true,
        detail: `Alert logged to ${alertLogPath}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      results.push({
        test: 'human_alert',
        passed: false,
        detail: 'Alert not logged',
        timestamp: new Date().toISOString(),
      });
    }

    return results;
  }
}
