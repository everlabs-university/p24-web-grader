import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const GRADER_ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUNNER = join('src', 'run.mjs');
const PASS_FIXTURE = join(GRADER_ROOT, 'fixtures', 'pass');
const STARTER_FIXTURE = join(GRADER_ROOT, 'fixtures', 'starter');
const TEMP_SUITE_DIRNAME = '.p24-web-grader';
const STUDENT_SHA = '0123456789abcdef0123456789abcdef01234567';
const RUN_TIMEOUT_MS = 180_000;
const UNCOPIED_SEGMENTS = new Set(['node_modules', '.git', 'fixtures']);

async function readResult(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function runGrader({ graderRoot = GRADER_ROOT, studentRoot, sha = STUDENT_SHA, summaryFile, resultFile }) {
  const args = [
    join(graderRoot, RUNNER),
    '--student-root', studentRoot,
    '--sha', sha,
    '--summary-file', summaryFile,
  ];
  if (resultFile !== undefined) args.push('--result-file', resultFile);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: graderRoot,
      env: { ...process.env, CI: 'true', FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function copyGraderRoot(destination) {
  await cp(GRADER_ROOT, destination, {
    recursive: true,
    filter: (source) => !relative(GRADER_ROOT, source)
      .split(sep)
      .some((segment) => UNCOPIED_SEGMENTS.has(segment)),
  });
  await symlink(join(GRADER_ROOT, 'node_modules'), join(destination, 'node_modules'), 'junction');
}

function assertTemporarySuiteRemoved(studentRoot) {
  assert.equal(existsSync(join(studentRoot, TEMP_SUITE_DIRNAME)), false);
}

describe('node src/run.mjs', () => {
  let workspace;
  let summaryFile;
  let resultFile;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'p24-web-run-'));
    summaryFile = join(workspace, 'summary.md');
    resultFile = join(workspace, 'result.json');
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
    await rm(join(PASS_FIXTURE, TEMP_SUITE_DIRNAME), { recursive: true, force: true });
    await rm(join(STARTER_FIXTURE, TEMP_SUITE_DIRNAME), { recursive: true, force: true });
  });

  it('scores the active known-good practical 80/80 and exits 0', { timeout: RUN_TIMEOUT_MS }, async () => {
    const result = await runGrader({ studentRoot: PASS_FIXTURE, summaryFile, resultFile });
    assert.equal(result.code, 0, `stderr:\n${result.stderr}`);

    const summary = await readFile(summaryFile, 'utf8');
    assert.match(summary, /Personal Card \| 80\/80 \| PASS/);
    assert.ok(summary.includes(STUDENT_SHA));

    const report = await readResult(resultFile);
    assert.equal(report.totalPoints, 80);
    assert.equal(report.totalMaxPoints, 80);
    assert.deepStrictEqual(report.labs.map(({ points }) => points), [80]);
    assertTemporarySuiteRemoved(PASS_FIXTURE);
  });

  it('scores the starter fixture partially and exits 1', { timeout: RUN_TIMEOUT_MS }, async () => {
    const result = await runGrader({ studentRoot: STARTER_FIXTURE, summaryFile, resultFile });
    assert.equal(result.code, 1, `stderr:\n${result.stderr}`);

    const report = await readResult(resultFile);
    assert.equal(report.totalPoints, 20);
    assert.equal(report.totalMaxPoints, 80);
    assert.deepStrictEqual(report.labs.map(({ points }) => points), [20]);
    assert.deepStrictEqual(report.labs.map(({ status }) => status), ['FAIL']);
    assertTemporarySuiteRemoved(STARTER_FIXTURE);
  });

  it('exits 2 when published.json is malformed', { timeout: RUN_TIMEOUT_MS }, async () => {
    const graderCopy = join(workspace, 'grader');
    await copyGraderRoot(graderCopy);
    await writeFile(join(graderCopy, 'published.json'), '{ "schemaVersion": 1,', 'utf8');

    const result = await runGrader({ graderRoot: graderCopy, studentRoot: PASS_FIXTURE, summaryFile });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /published\.json/);
    assertTemporarySuiteRemoved(PASS_FIXTURE);
  });

  it('exits 2 for a missing student root or malformed SHA', { timeout: RUN_TIMEOUT_MS }, async () => {
    const missing = await runGrader({
      studentRoot: join(workspace, 'missing'),
      summaryFile,
    });
    assert.equal(missing.code, 2);
    assert.notEqual(missing.stderr.trim(), '');

    const malformed = await runGrader({
      studentRoot: PASS_FIXTURE,
      sha: 'not-a-sha',
      summaryFile,
    });
    assert.equal(malformed.code, 2);
    assert.notEqual(malformed.stderr.trim(), '');
    assertTemporarySuiteRemoved(PASS_FIXTURE);
  });
});
