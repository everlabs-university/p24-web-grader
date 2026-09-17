const HEADING = '## P-24 automatic tests';
const TABLE_HEADER = '| Practical | Automatic tests | Status |';
const TABLE_DIVIDER = '| --- | --- | --- |';
const PROVISIONAL_NOTE =
  'This result is provisional until the canonical grader is re-run locally on the same SHA.';
const KNOWN_STATUSES = new Set(['PASS', 'FAIL']);

function summaryError(message) {
  const error = new Error(message);
  error.code = 'ERR_SUMMARY_INPUT';
  return error;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(value) {
  return JSON.stringify(value) ?? String(value);
}

function escapeCell(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replace(/\r\n|\r|\n/g, ' ');
}

function renderRow(labScore, index) {
  if (!isPlainObject(labScore)) {
    throw summaryError(
      `labScores[${index}] must be an object, received ${formatValue(labScore)}.`,
    );
  }

  if (!isNonEmptyString(labScore.title)) {
    throw summaryError(
      `labScores[${index}].title must be a non-empty string, received ${formatValue(labScore.title)}.`,
    );
  }

  if (!Number.isInteger(labScore.points) || !Number.isInteger(labScore.maxPoints)) {
    throw summaryError(
      `labScores[${index}] must contain integer points and maxPoints.`,
    );
  }

  if (!KNOWN_STATUSES.has(labScore.status)) {
    throw summaryError(
      `labScores[${index}].status must be PASS or FAIL, received ${formatValue(labScore.status)}.`,
    );
  }

  return `| ${escapeCell(labScore.title)} | ${labScore.points}/${labScore.maxPoints} | ${labScore.status} |`;
}

/** Builds the deterministic Markdown for the GitHub step summary. */
export function renderSummary(input) {
  if (!isPlainObject(input)) {
    throw summaryError(
      `The renderSummary argument must be an object, received ${formatValue(input)}.`,
    );
  }

  const { sha, graderVersion, labScores } = input;

  if (!isNonEmptyString(sha)) {
    throw summaryError(`sha must be a non-empty string, received ${formatValue(sha)}.`);
  }

  if (!isNonEmptyString(graderVersion)) {
    throw summaryError(
      `graderVersion must be a non-empty string, received ${formatValue(graderVersion)}.`,
    );
  }

  if (!Array.isArray(labScores)) {
    throw summaryError(`labScores must be an array, received ${formatValue(labScores)}.`);
  }

  return [
    HEADING,
    '',
    `- Student commit: \`${sha}\``,
    `- Grader version: \`${graderVersion}\``,
    '',
    TABLE_HEADER,
    TABLE_DIVIDER,
    ...labScores.map(renderRow),
    '',
    PROVISIONAL_NOTE,
    '',
  ].join('\n');
}
