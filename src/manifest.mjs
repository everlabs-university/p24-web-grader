import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SCHEMA_VERSION = 1;
const MAX_POINTS = 80;

function graderError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPointValue(value) {
  return Number.isInteger(value) && value >= 0;
}

function formatValue(value) {
  return JSON.stringify(value) ?? String(value);
}

function assertRoot(root) {
  if (!isNonEmptyString(root)) {
    throw graderError(
      'ERR_GRADER_ROOT',
      `The grader root must be a non-empty path, received ${formatValue(root)}.`,
    );
  }
}

async function readJson(path, codes) {
  let raw;

  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    if (cause?.code === 'ENOENT') {
      throw graderError(codes.missing, `${codes.subject} is missing: ${path}`);
    }

    throw graderError(
      codes.unreadable,
      `${codes.subject} cannot be read (${path}): ${cause?.message ?? cause}`,
    );
  }

  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw graderError(
      codes.malformed,
      `${codes.subject} contains malformed JSON (${path}): ${cause.message}`,
    );
  }
}

/** Reads and validates published.json in the grader root. */
export async function loadPublished(root) {
  assertRoot(root);

  const path = join(root, 'published.json');
  const subject = 'The published.json file';
  const manifest = await readJson(path, {
    subject,
    missing: 'ERR_MANIFEST_MISSING',
    unreadable: 'ERR_MANIFEST_UNREADABLE',
    malformed: 'ERR_MANIFEST_MALFORMED_JSON',
  });

  if (!isPlainObject(manifest)) {
    throw graderError('ERR_MANIFEST_SHAPE', `${subject} (${path}) must be a JSON object.`);
  }

  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw graderError(
      'ERR_MANIFEST_SCHEMA_VERSION',
      `${subject}: schemaVersion must be ${SCHEMA_VERSION}, received ${formatValue(manifest.schemaVersion)}.`,
    );
  }

  if (!isNonEmptyString(manifest.graderVersion)) {
    throw graderError(
      'ERR_MANIFEST_SHAPE',
      `${subject}: graderVersion must be a non-empty string, received ${formatValue(manifest.graderVersion)}.`,
    );
  }

  if (!Array.isArray(manifest.labs)) {
    throw graderError(
      'ERR_MANIFEST_SHAPE',
      `${subject}: labs must be an array of lab ids, received ${formatValue(manifest.labs)}.`,
    );
  }

  const labs = [];
  const seenLabs = new Set();

  for (const [index, labId] of manifest.labs.entries()) {
    if (!isNonEmptyString(labId)) {
      throw graderError(
        'ERR_MANIFEST_SHAPE',
        `${subject}: labs[${index}] must be a non-empty string, received ${formatValue(labId)}.`,
      );
    }

    if (seenLabs.has(labId)) {
      throw graderError(
        'ERR_MANIFEST_DUPLICATE_LAB',
        `${subject}: lab "${labId}" is listed in labs more than once.`,
      );
    }

    seenLabs.add(labId);
    labs.push(labId);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    graderVersion: manifest.graderVersion,
    labs,
  };
}

/** Reads and validates labs/<labId>/rubric.json in the grader root. */
export async function loadRubric(root, labId) {
  assertRoot(root);

  if (!isNonEmptyString(labId)) {
    throw graderError(
      'ERR_RUBRIC_LAB_ID',
      `The lab id must be a non-empty string, received ${formatValue(labId)}.`,
    );
  }

  const path = join(root, 'labs', labId, 'rubric.json');
  const subject = `The rubric file for lab "${labId}"`;
  const rubric = await readJson(path, {
    subject,
    missing: 'ERR_RUBRIC_MISSING',
    unreadable: 'ERR_RUBRIC_UNREADABLE',
    malformed: 'ERR_RUBRIC_MALFORMED_JSON',
  });

  if (!isPlainObject(rubric)) {
    throw graderError('ERR_RUBRIC_SHAPE', `${subject} (${path}) must be a JSON object.`);
  }

  if (rubric.id !== labId) {
    throw graderError(
      'ERR_RUBRIC_ID_MISMATCH',
      `${subject}: id must equal "${labId}", received ${formatValue(rubric.id)}.`,
    );
  }

  if (!isNonEmptyString(rubric.title)) {
    throw graderError(
      'ERR_RUBRIC_SHAPE',
      `${subject}: title must be a non-empty string, received ${formatValue(rubric.title)}.`,
    );
  }

  if (rubric.maxPoints !== MAX_POINTS) {
    throw graderError(
      'ERR_RUBRIC_MAX_POINTS',
      `${subject}: maxPoints must be exactly ${MAX_POINTS}, received ${formatValue(rubric.maxPoints)}.`,
    );
  }

  if (!Array.isArray(rubric.tests) || rubric.tests.length === 0) {
    throw graderError(
      'ERR_RUBRIC_SHAPE',
      `${subject}: tests must be a non-empty array of checks, received ${formatValue(rubric.tests)}.`,
    );
  }

  const tests = [];
  const seenTests = new Set();
  let weightsTotal = 0;

  for (const [index, test] of rubric.tests.entries()) {
    if (!isPlainObject(test)) {
      throw graderError(
        'ERR_RUBRIC_SHAPE',
        `${subject}: tests[${index}] must be a JSON object, received ${formatValue(test)}.`,
      );
    }

    if (!isNonEmptyString(test.fullName)) {
      throw graderError(
        'ERR_RUBRIC_SHAPE',
        `${subject}: tests[${index}].fullName must be a non-empty string, received ${formatValue(test.fullName)}.`,
      );
    }

    if (!isPointValue(test.points)) {
      throw graderError(
        'ERR_RUBRIC_SHAPE',
        `${subject}: tests[${index}].points must be a non-negative integer, received ${formatValue(test.points)}.`,
      );
    }

    if (seenTests.has(test.fullName)) {
      throw graderError(
        'ERR_RUBRIC_DUPLICATE_TEST',
        `${subject}: check "${test.fullName}" is listed more than once.`,
      );
    }

    seenTests.add(test.fullName);
    weightsTotal += test.points;
    tests.push({ fullName: test.fullName, points: test.points });
  }

  if (weightsTotal !== MAX_POINTS) {
    throw graderError(
      'ERR_RUBRIC_WEIGHTS',
      `${subject}: the test weights total ${weightsTotal} but must be exactly ${MAX_POINTS}.`,
    );
  }

  if (
    !Number.isInteger(rubric.passPoints) ||
    rubric.passPoints < 0 ||
    rubric.passPoints > MAX_POINTS
  ) {
    throw graderError(
      'ERR_RUBRIC_PASS_THRESHOLD',
      `${subject}: passPoints must be an integer within 0..${MAX_POINTS}, received ${formatValue(rubric.passPoints)}.`,
    );
  }

  return {
    id: rubric.id,
    title: rubric.title,
    maxPoints: MAX_POINTS,
    passPoints: rubric.passPoints,
    tests,
  };
}
