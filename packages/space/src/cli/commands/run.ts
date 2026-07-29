import { runTUI, resumeTUI } from '../tui.js';
import { FileSystemStorage } from '../../storage/filesystem.js';
import { DEFAULT_CONFIG } from '../../config/defaults.js';
import { createGitIntegration } from '../../integration/git.js';

export async function runCommand(projectName: string, options: { auto?: boolean; resume?: string; git?: boolean }) {
  const storage = new FileSystemStorage(DEFAULT_CONFIG.projects_dir);

  // Initialize git integration if --git flag
  let git = null;
  if (options.git) {
    try {
      const { join } = await import('path');
      git = createGitIntegration(join(DEFAULT_CONFIG.projects_dir, projectName));
      console.log(`[git] Auto-committing session progress to git`);
    } catch (e: any) {
      console.warn(`[git] Could not initialize git: ${e.message}`);
    }
  }

  if (options.resume) {
    const sessions = storage.listSessions(projectName);

    if (options.resume === 'latest') {
      const latest = sessions.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      if (!latest) {
        console.error(`No sessions found for project "${projectName}".`);
        process.exit(1);
      }
      options.resume = latest.session_id;
    }

    const session = storage.getSession(projectName, options.resume);
    if (!session) {
      console.error(`Session "${options.resume}" not found for project "${projectName}".`);
      process.exit(1);
    }

    // Version check on resume
    const fwVersion = session.session.framework_version;
    if (fwVersion !== '2.1.0') {
      console.warn(`[engine] Session framework v${fwVersion} may differ from current framework.`);
    }

    await resumeTUI(projectName, session, { auto: options.auto || false, git });
  } else {
    await runTUI(projectName, { auto: options.auto || false, resume: false, git });
  }
}
