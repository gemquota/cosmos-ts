/**
 * SessionStop hook — signals the daemon that a session ended.
 * Deep port of Python hooks/session-stop.py.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SessionEndSignal {
  ts: number;
  sessionId: string;
  event: 'session_end';
  threadName: string;
}

export function signalSessionEnd(input: Record<string, unknown>): void {
  try {
    const signalDir = path.resolve(
      process.cwd(),
      '.wiki-daemon', 'buffers', 'signals',
    );

    const sessionId = 
      (input.thread_id as string) || 
      (input.session_id as string) || 
      (input.sessionId as string) ||
      'default';

    const signal: SessionEndSignal = {
      ts: Date.now(),
      sessionId,
      event: 'session_end',
      threadName: (input.thread_name as string) || (input.threadName as string) || '',
    };

    fs.mkdirSync(signalDir, { recursive: true });
    fs.writeFileSync(
      path.join(signalDir, `${sessionId}.end`),
      JSON.stringify(signal),
    );
  } catch {
    // Must never block
  }
}
