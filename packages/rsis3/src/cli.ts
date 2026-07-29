#!/usr/bin/env node
/**
 * RSIS CLI entry point.
 * Deep port of Python __main__.py.
 */

import { RSISApp } from './app.js';

const app = new RSISApp();

const result = await app.run(process.argv);

for (const line of result.output) {
  console.log(line);
}

process.exit(result.code);
