/**
 * PostToolUse hook — captures every agent turn and buffers it for the wiki daemon.
 * Deep port of Python hooks/post-tool-use.py.
 * Must complete in < 2 seconds. Never throws.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface TurnCapture {
  ts: number;
  turnId: string;
  tool: string;
  content: string;
  response: string;
  hasContent: boolean;
  hasResponse: boolean;
  toolInputKeys: string[];
}

export function captureToolUse(input: Record<string, unknown>): void {
  try {
    const bufferDir = path.resolve(
      process.cwd(),
      '.wiki-daemon', 'buffers',
    );
    const sessionId = 
      (input.thread_id as string) || 
      (input.session_id as string) || 
      (input.threadId as string) || 
      'default';
    const turnId = 
      (input.turn_id as string) || 
      (input.turnId as string) || 
      String(Date.now());

    const toolInput = (input.tool_input as Record<string, unknown>) || {};
    const toolResponse = (input.tool_response as Record<string, unknown>) || {};

    const content = (
      (toolInput.content as string) ||
      (toolInput.new_string as string) ||
      (toolInput.file_content as string) ||
      (input.content as string) ||
      (input.file_content as string) ||
      (input.diff as string) ||
      ''
    ).slice(0, 10000);

    const response = (
      (toolResponse.content as string) ||
      (toolResponse.text as string) ||
      (toolResponse.result as string) ||
      (input.response as string) ||
      (input.result as string) ||
      ''
    ).slice(0, 10000);

    const turn: TurnCapture = {
      ts: Date.now(),
      turnId,
      tool: (input.tool_name as string) || (input.tool as string) || 'unknown',
      content,
      response,
      hasContent: content.length > 0,
      hasResponse: response.length > 0,
      toolInputKeys: Object.keys(toolInput).slice(0, 10),
    };

    fs.mkdirSync(bufferDir, { recursive: true });
    const bufferPath = path.join(bufferDir, `${sessionId}.ndjson`);
    fs.appendFileSync(bufferPath, JSON.stringify(turn) + '\n');
  } catch {
    // Must never block — silently ignore all errors
  }
}
