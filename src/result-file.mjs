import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

function resultFileError(message) {
  const error = new Error(message);
  error.code = 'ERR_RESULT_FILE';
  return error;
}

function renderLab(labScore) {
  return {
    id: labScore.id,
    title: labScore.title,
    points: labScore.points,
    maxPoints: labScore.maxPoints,
    status: labScore.status,
    passedTests: labScore.passedTests,
    totalTests: labScore.totalTests,
    tests: labScore.tests.map((test) => ({ ...test })),
  };
}

export function buildResult({ sha, graderVersion, labScores, generatedAt = new Date() }) {
  const labs = labScores.map(renderLab);
  return {
    schemaVersion: 1,
    graderVersion,
    sha,
    generatedAt: generatedAt.toISOString(),
    totalPoints: labs.reduce((total, lab) => total + lab.points, 0),
    totalMaxPoints: labs.reduce((total, lab) => total + lab.maxPoints, 0),
    labs,
  };
}

export async function writeResultFile(path, result) {
  const directory = dirname(path);
  const temporaryPath = join(directory, `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, path);
  } catch (cause) {
    await rm(temporaryPath, { force: true });
    throw resultFileError(`The result file could not be written (${path}): ${cause?.message ?? cause}`);
  }
}
