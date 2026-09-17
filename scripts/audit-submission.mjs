#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditWorkflow } from '../src/audit-workflow.mjs';

const GRADER_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CANONICAL_WORKFLOW = join(GRADER_ROOT, 'canonical', 'student-grade.yml');
const STUDENT_WORKFLOW = join('.github', 'workflows', 'grade.yml');
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const EXIT_VALID = 0;
const EXIT_INVALID = 1;
const EXIT_INFRASTRUCTURE = 2;

const USAGE = 'Usage: node scripts/audit-submission.mjs --student-root <absolute path> --expected-sha <40 hex>';
const OPTIONS = new Map([
  ['--student-root', 'studentRoot'],
  ['--expected-sha', 'expectedSha'],
]);
const GIT_ENV_OVERRIDES = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_PAGER: 'cat',
  LC_ALL: 'C',
  NO_COLOR: '1',
  FORCE_COLOR: '0',
};
const GIT_SCOPE_VARIABLES = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CEILING_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_DIR',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_WORK_TREE',
];
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function buildGitEnv() {
  const env = { ...process.env, ...GIT_ENV_OVERRIDES };
  for (const name of GIT_SCOPE_VARIABLES) delete env[name];
  return env;
}

const GIT_ENV = buildGitEnv();

function auditError(code, exitCode, message) {
  const error = new Error(message);
  error.code = code;
  error.exitCode = exitCode;
  return error;
}

function usageError(message) {
  return auditError('ERR_AUDIT_USAGE', EXIT_INFRASTRUCTURE, message);
}

function infrastructureError(message) {
  return auditError('ERR_AUDIT_INFRASTRUCTURE', EXIT_INFRASTRUCTURE, message);
}

function submissionError(message) {
  return auditError('ERR_AUDIT_SUBMISSION', EXIT_INVALID, message);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function firstLine(text) {
  const [line] = text.split('\n');
  return line.trim();
}

function detailSuffix(stderr) {
  const detail = firstLine(stderr);
  return detail === '' ? '' : ` (${detail})`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const key = OPTIONS.get(flag);
    if (key === undefined) throw usageError(`unknown argument "${flag}". ${USAGE}`);
    if (args[key] !== undefined) throw usageError(`argument ${flag} was supplied more than once. ${USAGE}`);
    index += 1;
    if (index >= argv.length) throw usageError(`argument ${flag} requires a value. ${USAGE}`);
    args[key] = argv[index];
  }
  for (const [flag, key] of OPTIONS) {
    if (args[key] === undefined) throw usageError(`argument ${flag} is required. ${USAGE}`);
  }
  return args;
}

function parseExpectedSha(value) {
  if (!isNonEmptyString(value) || !SHA_PATTERN.test(value)) {
    throw usageError(`--expected-sha must be a commit id of exactly 40 hex characters, received "${value}". ${USAGE}`);
  }
  return value.toLowerCase();
}

async function resolveStudentRoot(value) {
  if (!isNonEmptyString(value) || !isAbsolute(value)) {
    throw usageError(`--student-root must be an absolute path, received "${value}". ${USAGE}`);
  }
  let studentRoot;
  let stats;
  try {
    studentRoot = await realpath(value);
    stats = await stat(studentRoot);
  } catch (cause) {
    throw infrastructureError(`the student repository root is not accessible (${value}): ${cause.message}`);
  }
  if (!stats.isDirectory()) throw infrastructureError(`the student repository root must be a directory: ${studentRoot}`);
  return studentRoot;
}

function spawnGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      env: GIT_ENV,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function runGit(args, cwd) {
  try {
    return await spawnGit(args, cwd);
  } catch (cause) {
    throw infrastructureError(`could not run "git ${args.join(' ')}": ${cause.message}`);
  }
}

function describeGitFailure(args, result) {
  const exitStatus = result.signal === null ? `exit code ${result.code}` : `signal ${result.signal}`;
  return `"git ${args.join(' ')}" exited with ${exitStatus}${detailSuffix(result.stderr)}`;
}

async function gitStdout(args, cwd) {
  const result = await runGit(args, cwd);
  if (result.code !== 0) throw infrastructureError(describeGitFailure(args, result));
  return result.stdout;
}

async function assertGitWorkTree(studentRoot) {
  const inside = await runGit(['rev-parse', '--is-inside-work-tree'], studentRoot);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
    throw infrastructureError(`${studentRoot} is not a Git work tree${detailSuffix(inside.stderr)}.`);
  }
  const toplevel = firstLine(await gitStdout(['rev-parse', '--show-toplevel'], studentRoot));
  let resolvedToplevel;
  try {
    resolvedToplevel = await realpath(toplevel);
  } catch (cause) {
    throw infrastructureError(`the Git repository root is not accessible (${toplevel}): ${cause.message}`);
  }
  if (resolvedToplevel !== studentRoot) {
    throw infrastructureError(`--student-root must be the Git repository root: git reports ${resolvedToplevel}, not ${studentRoot}.`);
  }
}

async function assertCleanWorkTree(studentRoot) {
  const stdout = await gitStdout(['status', '--porcelain', '--untracked-files=all'], studentRoot);
  const entries = stdout.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  if (entries.length > 0) {
    throw submissionError(`the working tree is not clean: ${entries.length} uncommitted entries, including ${entries.slice(0, 3).join('; ')}.`);
  }
}

async function readHead(studentRoot) {
  const result = await runGit(['rev-parse', '--verify', 'HEAD'], studentRoot);
  if (result.code !== 0) throw submissionError(`could not resolve HEAD of the student repository${detailSuffix(result.stderr)}.`);
  const head = firstLine(result.stdout);
  if (!SHA_PATTERN.test(head)) throw infrastructureError(`git returned a malformed HEAD "${head}".`);
  return head.toLowerCase();
}

async function readUtf8Text(path) {
  return UTF8_DECODER.decode(await readFile(path));
}

async function readCanonicalWorkflow() {
  try {
    return await readUtf8Text(CANONICAL_WORKFLOW);
  } catch (cause) {
    throw infrastructureError(`the canonical workflow cannot be read (${CANONICAL_WORKFLOW}): ${cause.message}`);
  }
}

async function readCandidateWorkflow(studentRoot) {
  const path = join(studentRoot, STUDENT_WORKFLOW);
  try {
    return await readUtf8Text(path);
  } catch (cause) {
    if (cause?.code === 'ENOENT') throw submissionError(`the student workflow is missing: ${path}`);
    throw submissionError(`the student workflow cannot be read (${path}): ${cause.message}`);
  }
}

function reportValid(head, audit) {
  process.stdout.write([
    'P-24 Web audit: VALID',
    `- HEAD: ${head}`,
    `- SHA-256 student workflow: ${audit.candidateSha256}`,
    `- SHA-256 canonical workflow: ${audit.canonicalSha256}`,
    '',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const expectedSha = parseExpectedSha(args.expectedSha);
  const studentRoot = await resolveStudentRoot(args.studentRoot);
  await assertGitWorkTree(studentRoot);
  await assertCleanWorkTree(studentRoot);
  const head = await readHead(studentRoot);
  if (head !== expectedSha) throw submissionError(`HEAD ${head} does not match the expected commit ${expectedSha}.`);
  const canonicalText = await readCanonicalWorkflow();
  const candidateText = await readCandidateWorkflow(studentRoot);
  const audit = auditWorkflow({ candidateText, canonicalText });
  if (!audit.valid) {
    throw submissionError(`the student workflow differs from the canonical workflow byte for byte: SHA-256 ${audit.candidateSha256} instead of ${audit.canonicalSha256}.`);
  }
  reportValid(head, audit);
  return EXIT_VALID;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`P-24 Web audit: INVALID — ${error?.message ?? error}\n`);
  process.exitCode = error?.exitCode ?? EXIT_INFRASTRUCTURE;
}
