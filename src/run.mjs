#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublished, loadRubric } from './manifest.mjs';
import { parseVitestJson } from './parse-vitest.mjs';
import { buildResult, writeResultFile } from './result-file.mjs';
import { scoreLab } from './scoring.mjs';
import { renderSummary } from './summary.mjs';

const GRADER_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SUITE_DIRNAME = '.p24-web-grader';
const CONFIG_FILENAME = 'vitest.student.config.mjs';
const REPORT_FILENAME = 'vitest-report.json';
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const PASS = 'PASS';
const EXIT_PASS = 0;
const EXIT_FAIL = 1;
const EXIT_INFRASTRUCTURE = 2;

const OPTIONS = new Map([
  ['--student-root', 'studentRoot'],
  ['--sha', 'sha'],
  ['--summary-file', 'summaryFile'],
  ['--result-file', 'resultFile'],
  ['--grader-version', 'graderVersion'],
]);

const USAGE = 'Usage: node src/run.mjs --student-root <absolute path> --sha <40 hex> --summary-file <path> [--result-file <path>] [--grader-version <version>]';

function runnerError(message) {
  const error = new Error(message);
  error.code = 'ERR_GRADER_RUN';
  return error;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const separator = token.indexOf('=');
    const flag = separator === -1 ? token : token.slice(0, separator);
    const key = OPTIONS.get(flag);
    if (key === undefined) throw runnerError(`Unknown argument "${token}". ${USAGE}`);
    if (separator !== -1) {
      args[key] = token.slice(separator + 1);
      continue;
    }
    index += 1;
    if (index >= argv.length) throw runnerError(`Argument ${flag} requires a value. ${USAGE}`);
    args[key] = argv[index];
  }
  return args;
}

async function assertDirectory(path, subject) {
  let stats;
  try {
    stats = await stat(path);
  } catch (cause) {
    throw runnerError(`${subject} is not accessible (${path}): ${cause.message}`);
  }
  if (!stats.isDirectory()) throw runnerError(`${subject} must be a directory: ${path}`);
}

async function validateArgs(args) {
  if (!isNonEmptyString(args.studentRoot) || !isAbsolute(args.studentRoot)) {
    throw runnerError(`--student-root must be an absolute path, received "${args.studentRoot ?? ''}". ${USAGE}`);
  }
  await assertDirectory(args.studentRoot, 'The student repository root');
  if (!isNonEmptyString(args.sha) || !SHA_PATTERN.test(args.sha)) {
    throw runnerError(`--sha must be a commit id of exactly 40 hex characters, received "${args.sha ?? ''}".`);
  }
  if (!isNonEmptyString(args.summaryFile)) throw runnerError(`--summary-file must be a non-empty path to the summary file. ${USAGE}`);
  if (args.resultFile !== undefined && !isNonEmptyString(args.resultFile)) {
    throw runnerError(`--result-file, when supplied, must be a non-empty path to the result file. ${USAGE}`);
  }
  if (args.graderVersion !== undefined && !isNonEmptyString(args.graderVersion)) {
    throw runnerError('--grader-version, when supplied, must be a non-empty string.');
  }
}

async function findVitest(studentRoot) {
  const candidates = [join(studentRoot, 'node_modules', '.bin', 'vitest'), join(GRADER_ROOT, 'node_modules', '.bin', 'vitest')];
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  throw runnerError(`No Vitest executable was found: ${candidates.join(', ')}.`);
}

async function prepareSuite(studentRoot, labs) {
  const suiteRoot = join(studentRoot, SUITE_DIRNAME);
  await rm(suiteRoot, { recursive: true, force: true });
  await mkdir(suiteRoot, { recursive: true });
  for (const labId of labs) {
    const source = join(GRADER_ROOT, 'labs', labId);
    await assertDirectory(source, `The test directory for lab "${labId}"`);
    await cp(source, join(suiteRoot, 'labs', labId), { recursive: true });
  }
  await cp(join(GRADER_ROOT, CONFIG_FILENAME), join(suiteRoot, CONFIG_FILENAME));
}

function runVitest({ vitestBin, studentRoot, configPath, reportPath }) {
  return new Promise((resolve, reject) => {
    const child = spawn(vitestBin, ['run', '--config', configPath, '--reporter=json', `--outputFile=${reportPath}`], {
      cwd: studentRoot,
      env: { ...process.env, CI: 'true', FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, output }));
  });
}

async function readReport(reportPath, run) {
  try {
    return parseVitestJson(await readFile(reportPath, 'utf8'));
  } catch (cause) {
    const exitStatus = run.signal === null ? `exit code ${run.code}` : `signal ${run.signal}`;
    throw runnerError(`Could not read the Vitest JSON report (${reportPath}); ${exitStatus}: ${cause.message}\n${run.output.trim()}`);
  }
}

async function collectAssertions(studentRoot, labs) {
  if (labs.length === 0) return [];
  const vitestBin = await findVitest(studentRoot);
  const suiteRoot = join(studentRoot, SUITE_DIRNAME);
  const reportPath = join(suiteRoot, REPORT_FILENAME);
  try {
    await prepareSuite(studentRoot, labs);
    const run = await runVitest({ vitestBin, studentRoot, configPath: join(suiteRoot, CONFIG_FILENAME), reportPath });
    return await readReport(reportPath, run);
  } finally {
    await rm(suiteRoot, { recursive: true, force: true });
  }
}

async function grade(args) {
  const published = await loadPublished(GRADER_ROOT);
  const graderVersion = args.graderVersion ?? published.graderVersion;
  const rubrics = [];
  for (const labId of published.labs) rubrics.push(await loadRubric(GRADER_ROOT, labId));
  const assertions = await collectAssertions(args.studentRoot, published.labs);
  const labScores = rubrics.map((rubric) => scoreLab(rubric, assertions));
  const summary = renderSummary({ sha: args.sha, graderVersion, labScores });
  await writeFile(args.summaryFile, summary, 'utf8');
  if (args.resultFile !== undefined) {
    await writeResultFile(args.resultFile, buildResult({ sha: args.sha, graderVersion, labScores }));
  }
  process.stdout.write(summary);
  return labScores.every((labScore) => labScore.status === PASS) ? EXIT_PASS : EXIT_FAIL;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await validateArgs(args);
  return grade(args);
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`P-24 web grader: ${error?.message ?? error}\n`);
  process.exitCode = EXIT_INFRASTRUCTURE;
}
