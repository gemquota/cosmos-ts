import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { loadFrameworkFromV1 } from '../../data/framework-loader.js';
import { exportSession } from '../../export/index.js';
import type { SessionState, ExportFormat } from '../../types/index.js';

export function exportCommand(sessionFile: string, options: { format: string; output: string; project: string }) {
  if (!existsSync(sessionFile)) {
    console.error(chalk.red(`✗ Session file not found: ${sessionFile}`));
    process.exit(1);
  }

  const session: SessionState = JSON.parse(readFileSync(sessionFile, 'utf-8'));

  // Find framework
  const fwDirs = [
    join(process.cwd(), 'prompt-framework'),
    join(process.env.HOME || '', 'dev', 'space', 'prompt-framework'),
  ];
  const fwDir = fwDirs.find((d) => existsSync(join(d, 'framework.json')));
  if (!fwDir) {
    console.error(chalk.red('✗ Framework files not found.'));
    process.exit(1);
  }
  const framework = loadFrameworkFromV1(fwDir);

  const formats = (options.format || 'json,markdown').split(',') as ExportFormat[];
  const projectName = options.project || session.session.project_id;
  const outputDir = options.output || './exports';

  mkdirSync(outputDir, { recursive: true });

  for (const format of formats) {
    try {
      const result = exportSession(session, session.artifacts || {}, framework, format, projectName);
      const filePath = join(outputDir, result.filename);
      writeFileSync(filePath, result.content);
      console.log(chalk.green(`✓ ${format}: ${filePath} (${result.content.length} bytes)`));
    } catch (e: any) {
      console.error(chalk.red(`✗ ${format}: ${e.message}`));
    }
  }
}
