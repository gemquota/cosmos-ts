#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadFrameworkFromV1, validateFramework } from '../data/framework-loader.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { configFromEnv, assertValidConfig, listEnvVars } from '../config/validation.js';
import { runCommand } from './commands/run.js';
import { exportCommand } from './commands/export.js';

// Load and validate config at startup
const envConfig = configFromEnv();
try {
  assertValidConfig(envConfig);
} catch (e: any) {
  console.error(chalk.yellow(`[config] ${e.message}`));
}

const program = new Command();
const VERSION = '2.1.0';

program.name('space').description('SPACE — Superb Prompt Automatic Creation Engine').version(VERSION);

// space init <name>
program
  .command('init <name>')
  .description('Create a new project')
  .option('-d, --description <desc>', 'Project description', '')
  .action((name: string, opts: { description: string }) => {
    const projectsDir = DEFAULT_CONFIG.projects_dir;
    const projectDir = join(projectsDir, name);
    if (existsSync(projectDir)) {
      console.error(chalk.red(`✗ Project already exists: ${projectDir}`));
      process.exit(1);
    }
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, 'sessions'), { recursive: true });
    mkdirSync(join(projectDir, 'exports'), { recursive: true });
    const project = {
      id: `proj_${Date.now().toString(36)}`,
      name,
      description: opts.description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      framework_version: '2.0.0',
      sessions: [],
      tags: [],
    };
    writeFileSync(join(projectDir, '.space.json'), JSON.stringify(project, null, 2));
    writeFileSync(join(projectDir, 'README.md'), `# ${name}\n\n${opts.description || 'A SPACE project.'}\n`);
    console.log(chalk.green(`✓ Created project: ${name}`));
    console.log(chalk.dim(`  Location: ${projectDir}`));
    console.log(chalk.dim(`  Framework: v2.0.0 (7 series, 326 probes)`));
    console.log('');
    console.log(chalk.cyan(`  Next: space run ${name}`));
  });

// space run <project>
program
  .command('run <project>')
  .description('Start an interactive elicitation session')
  .option('--auto', 'Auto-answer with generated responses (for testing)')
  .option('--resume <session-id>', 'Resume a previous session')
  .option('--git', 'Auto-commit session progress to git', false)
  .action(async (project: string, opts: { auto?: boolean; resume?: string; git?: boolean }) => {
    await runCommand(project, opts);
  });

// space export <session-file>
program
  .command('export <session-file>')
  .description('Export session data to specification documents')
  .option('-f, --format <formats>', 'Comma-separated export formats (json,markdown,yaml,prompt,html)', 'json,markdown')
  .option('-o, --output <dir>', 'Output directory', './exports')
  .option('-p, --project <name>', 'Project name', 'export')
  .option('--git', 'Auto-commit exports to git', false)
  .action((sessionFile: string, opts: { format: string; output: string; project: string; git?: boolean }) => {
    exportCommand(sessionFile, opts);
  });

// space list
program
  .command('list')
  .description('List all projects')
  .action(() => {
    const projectsDir = DEFAULT_CONFIG.projects_dir;
    if (!existsSync(projectsDir)) {
      console.log(chalk.yellow('No projects found. Create one with: space init <name>'));
      return;
    }
    const entries = readdirSync(projectsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const metaPath = join(projectsDir, e.name, '.space.json');
        if (!existsSync(metaPath)) return null;
        return JSON.parse(readFileSync(metaPath, 'utf-8'));
      })
      .filter(Boolean);
    if (entries.length === 0) {
      console.log(chalk.yellow('No projects found.'));
      return;
    }
    console.log(chalk.bold('\nProjects:\n'));
    for (const p of entries) {
      const sessions = p.sessions?.length || 0;
      const active = p.active_session_id ? chalk.green(' (active)') : '';
      console.log(
        `  ${chalk.cyan(p.name)}${active} — ${sessions} session(s) — ${chalk.dim(p.description || 'no description')}`,
      );
    }
  });

// space config
program
  .command('config')
  .description('View or set configuration')
  .option('-l, --list', 'List all configuration options')
  .option('-g, --get <key>', 'Get a specific config value')
  .option('-s, --set <key:value>', 'Set a config value (for env-based configs, use SPACE_* env vars)')
  .action((opts: { list?: boolean; get?: string; set?: string }) => {
    if (opts.list) {
      const envVars = listEnvVars();
      console.log(chalk.bold('\nConfiguration Options:\n'));
      for (const [field, info] of Object.entries(envVars)) {
        console.log(`  ${chalk.cyan(info.env)}`);
        console.log(`    Field: ${chalk.dim(field)}`);
        console.log(`    Type: ${chalk.dim(info.type)}`);
        console.log(`    ${info.description}`);
        const val = (envConfig as any)[field];
        if (val !== undefined) {
          console.log(`    Current: ${chalk.green(String(val))}`);
        }
        console.log('');
      }
    } else if (opts.get) {
      const envVars = listEnvVars();
      const info = envVars[opts.get];
      if (!info) {
        console.error(chalk.red(`Unknown config key: ${opts.get}`));
        process.exit(1);
      }
      const val = (envConfig as any)[opts.get];
      console.log(chalk.bold(`${info.env} (${opts.get}):`));
      console.log(`  ${chalk.green(val !== undefined ? String(val) : '(not set)')}`);
      console.log(chalk.dim(`  ${info.description}`));
    } else if (opts.set) {
      const [key, val] = opts.set.split(':');
      console.log(chalk.yellow(`Config values are set via SPACE_* environment variables.`));
      console.log(chalk.yellow(`Set ${chalk.cyan(`SPACE_${key.toUpperCase()}`)} to "${val}" in your shell profile.`));
    } else {
      // Show default help
      console.log(chalk.bold('\nSPACE Configuration'));
      console.log(chalk.dim('Configuration is managed via SPACE_* environment variables.'));
      console.log(chalk.dim('Use --list to see all options or --get <key> for a specific value.\n'));
      console.log(chalk.bold('Current settings:'));
      const envVars = listEnvVars();
      for (const [field, info] of Object.entries(envVars)) {
        const val = (envConfig as any)[field];
        console.log(`  ${chalk.cyan(info.env)} = ${chalk.green(val !== undefined ? String(val) : '(default)')}`);
      }
    }
  });

// space framework
program
  .command('framework')
  .description('Inspect the framework definition')
  .action(() => {
    const fwDir = DEFAULT_CONFIG.framework_dir;
    const altDir = join(homedir(), 'dev', 'space', 'prompt-framework');
    const dir = existsSync(join(fwDir, 'framework.json')) ? fwDir : altDir;
    if (!existsSync(join(dir, 'framework.json'))) {
      console.error(chalk.red('✗ Framework files not found.'));
      process.exit(1);
    }
    try {
      const fw = loadFrameworkFromV1(dir);
      const validation = validateFramework(fw);
      console.log(chalk.bold('\nFramework: ') + fw.meta.name);
      console.log(chalk.dim(`Version: ${fw.meta.version}`));
      console.log(chalk.dim(`Description: ${fw.meta.description}`));
      console.log('');
      console.log(chalk.bold('Statistics:'));
      console.log(`  Series: ${fw.meta.total_series}`);
      console.log(`  Rounds: ${fw.meta.total_rounds}`);
      console.log(`  Open-Ended Questions: ${fw.meta.total_open_ended}`);
      console.log(`  Multi-Choice Follow-ups: ${fw.meta.total_multi_choice}`);
      console.log(`  Total Probes: ${fw.meta.total_open_ended + fw.meta.total_multi_choice}`);
      console.log('');
      console.log(chalk.bold('Series:'));
      for (const s of fw.series) {
        const depStr = s.depends_on.length > 0 ? chalk.dim(` (depends on: ${s.depends_on.join(', ')})`) : '';
        console.log(`  ${chalk.cyan(s.id)}. ${s.name}${depStr}`);
        console.log(`     ${chalk.dim(s.rounds.length)} rounds, ${s.total_open_ended} OE, ${s.total_multi_choice} MC`);
      }
      console.log('');
      if (validation.valid) {
        console.log(chalk.green('✓ Framework validation passed (R1-R8)'));
      } else {
        console.log(chalk.red(`✗ Framework validation failed (${validation.errors.length} errors):`));
        for (const err of validation.errors) console.log(chalk.red(`  - ${err}`));
      }
    } catch (err: any) {
      console.error(chalk.red(`✗ Error: ${err.message}`));
      process.exit(1);
    }
  });

// space status
program
  .command('status [project]')
  .description('Show project/session status')
  .action((project?: string) => {
    const projectsDir = DEFAULT_CONFIG.projects_dir;
    if (!existsSync(projectsDir)) {
      console.log(chalk.yellow('No projects directory found.'));
      return;
    }
    const dirs = readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    const toShow = project ? dirs.filter((d) => d.name === project) : dirs;

    for (const d of toShow) {
      const metaPath = join(projectsDir, d.name, '.space.json');
      if (!existsSync(metaPath)) continue;
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      console.log(chalk.bold(`\n${meta.name}`));
      console.log(chalk.dim(`  ID: ${meta.id}`));
      console.log(chalk.dim(`  Created: ${meta.created_at}`));
      console.log(chalk.dim(`  Sessions: ${meta.sessions?.length || 0}`));

      const sessionsDir = join(projectsDir, d.name, 'sessions');
      if (existsSync(sessionsDir)) {
        const sessions = readdirSync(sessionsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
        for (const s of sessions) {
          const statePath = join(sessionsDir, s.name, 'state.json');
          if (!existsSync(statePath)) continue;
          const state = JSON.parse(readFileSync(statePath, 'utf-8'));
          const pct = state.session?.estimated_completion_pct || 0;
          const status = state.session?.status || 'unknown';
          const answered = Object.keys(state.answers || {}).length;
          console.log(chalk.cyan(`    Session ${s.name}: ${status} (${pct}% — ${answered} answers)`));
        }
      }
    }
  });

// space serve
program
  .command('serve')
  .description('Start the web UI server')
  .option('-p, --port <port>', 'Port to serve on', '8888')
  .action(async (opts: { port: string }) => {
    const port = parseInt(opts.port, 10);
    const uiDir = join(homedir(), 'dev', 'space', 'ui', 'dist');

    if (!existsSync(uiDir)) {
      console.log(chalk.yellow('UI not built. Building...'));
      const { execSync } = await import('child_process');
      try {
        execSync('npm run build', { cwd: join(homedir(), 'dev', 'space', 'ui'), stdio: 'inherit' });
      } catch {
        console.error(chalk.red('✗ Failed to build UI.'));
        process.exit(1);
      }
    }

    console.log(chalk.green(`✓ Starting web UI server on http://localhost:${port}`));
    console.log(chalk.dim(`  Serving: ${uiDir}`));

    const http = await import('http');
    const fs = await import('fs');
    const path = await import('path');

    const MIME: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.svg': 'image/svg+xml',
    };

    const server = http.createServer((req, res) => {
      let filePath = path.join(uiDir, req.url === '/' ? 'index.html' : req.url || 'index.html');
      const ext = path.extname(filePath);
      const contentType = MIME[ext] || 'application/octet-stream';

      if (!fs.existsSync(filePath)) {
        filePath = path.join(uiDir, 'index.html');
      }

      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      console.log(chalk.cyan(`\n  Open: http://localhost:${port}`));
    });
  });

program.parse();
