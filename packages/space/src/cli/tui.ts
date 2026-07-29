import * as readline from 'readline';
import chalk from 'chalk';
import { createSpace } from '../engine/core.js';
import type { SessionState } from '../types/index.js';
import type { GitIntegration } from '../integration/git.js';

const SERIES_NAMES = [
  'Conceptual Depth',
  'Ontological Characteristics',
  'Semantic Relationships',
  'Procedural Breadth',
  'Technical Specifications',
  'Development Methodologies',
  'Operational / Functional',
];

async function runSessionLoop(
  projectName: string,
  session: SessionState,
  options: { auto?: boolean; git?: GitIntegration | null },
) {
  const space = createSpace();

  // Load session into engine
  space.loadSession(JSON.stringify(session));

  console.log(chalk.bold.cyan('\n🚀 SPACE — Superb Prompt Automatic Creation Engine'));
  console.log(chalk.dim(`Project: ${projectName} | Session: ${session.session.id}\n`));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

  let questionCount = Object.keys(session.answers).length;
  const maxQuestions = 400;

  while (questionCount < maxQuestions) {
    const q = space.getCurrentQuestion(session.session.id);
    if (!q) {
      console.log(chalk.green('\n✅ All questions answered! Session complete.'));
      break;
    }

    const seriesName = SERIES_NAMES[q.series_id - 1] || `Series ${q.series_id}`;
    const progress = space.getProgress(session.session.id);

    // Header
    console.log(chalk.bold(`\n═══ Series ${q.series_id}: ${seriesName} ═══ Round ${q.round}/${q.total_rounds} ═══`));
    if (progress) {
      const pct = progress.overall.completion_pct;
      const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
      console.log(
        chalk.dim(`Progress: [${bar}] ${pct}% (${progress.overall.answered}/${progress.overall.total_questions})`),
      );
    }

    // Question
    console.log(chalk.bold.yellow(`\nQ ${q.question.id} — ${q.round_focus}`));
    console.log(chalk.white(q.question.text));
    console.log(chalk.dim('Write your answer, then press Enter twice:'));

    // Get open-ended answer
    let answer = '';
    if (options.auto) {
      answer = `Auto-generated answer for ${q.question.id} based on project context.`;
      console.log(chalk.dim(`> ${answer}`));
    } else {
      const lines: string[] = [];
      let line;
      while ((line = await ask(chalk.cyan('> '))) !== '') {
        lines.push(line);
      }
      answer = lines.join('\n') || `[Skipped: ${q.question.id}]`;
    }

    // Show choices
    console.log(chalk.bold('\nAfter answering, select one:'));
    q.question.follow_up_choices.forEach((c, i) => {
      const letter = String.fromCharCode(97 + i);
      console.log(`  ${chalk.bold(`[${letter}]`)} ${c.text}`);
    });

    // Get choice
    let choiceId = q.question.follow_up_choices[0]?.id || '';
    if (!options.auto) {
      const choiceInput = await ask(chalk.cyan('\nSelection (a/b/c): '));
      const choiceIdx = choiceInput.charCodeAt(0) - 97;
      if (choiceIdx >= 0 && choiceIdx < q.question.follow_up_choices.length) {
        choiceId = q.question.follow_up_choices[choiceIdx].id;
      }
    } else {
      console.log(chalk.dim(`Selection: [a] ${q.question.follow_up_choices[0]?.text || 'Auto'}`));
    }

    // Submit
    const result = space.submitAnswer(session.session.id, q.question.id, answer, choiceId);
    questionCount++;

    if (result.round_completed) {
      console.log(chalk.green(`\n✓ Round ${q.round} complete!`));
      // Git auto-commit on round completion
      if (options.git) {
        try {
          const commit = options.git.autoCommit(
            'session',
            `Round ${q.round}/${q.total_rounds} of ${q.series_id}/${SERIES_NAMES.length} completed`,
          );
          if (commit) {
            console.log(chalk.dim(`[git] Committed ${commit.hash}`));
          }
        } catch (_e) {
          // Git errors are non-fatal
        }
      }
    }
    if (result.series_completed) {
      console.log(chalk.green.bold(`\n✓ Series ${q.series_id} complete!`));
      if (options.git) {
        try {
          const commit = options.git.autoCommit('session', `Series ${q.series_id}: ${seriesName} completed`);
          if (commit) {
            console.log(chalk.dim(`[git] Committed ${commit.hash}`));
          }
        } catch (_e) {}
      }
    }
    if (result.session_completed) {
      console.log(chalk.green.bold('\n🎉 SESSION COMPLETE! All 326 probes answered.'));
      if (options.git) {
        try {
          const commit = options.git.autoCommit('session', `Full session completed: ${projectName}`);
          if (commit) {
            console.log(chalk.dim(`[git] Committed ${commit.hash}`));
          }
        } catch (_e) {}
      }
    }
  }

  rl.close();

  // Summary
  const progress = space.getProgress(session.session.id);
  console.log(chalk.bold('\n═══ Session Summary ═══'));
  console.log(`Questions answered: ${questionCount}`);
  if (progress) {
    console.log(`Completion: ${progress.overall.completion_pct}%`);
  }

  // Save session
  const json = space.saveSession(session.session.id);
  const { writeFileSync, mkdirSync } = await import('fs');
  const { join } = await import('path');
  const outputDir = join(process.cwd(), 'exports');
  mkdirSync(outputDir, { recursive: true });
  const outPath = join(outputDir, `${projectName}-session.json`);
  writeFileSync(outPath, json);
  console.log(chalk.dim(`\nSession saved: ${outPath}`));

  // Final git commit on session save
  if (options.git) {
    try {
      const commit = options.git.autoCommit('export', `Session exported: ${outPath}`);
      if (commit) {
        console.log(chalk.dim(`[git] Final commit: ${commit.hash}`));
      }
    } catch (_e) {}
  }
}

export async function runTUI(
  projectName: string,
  options: { auto?: boolean; resume?: boolean; git?: GitIntegration | null },
) {
  const space = createSpace();
  const session = space.startSession(projectName);
  await runSessionLoop(projectName, session, options);
}

export async function resumeTUI(
  projectName: string,
  session: SessionState,
  options: { auto?: boolean; git?: GitIntegration | null },
) {
  await runSessionLoop(projectName, session, options);
}
