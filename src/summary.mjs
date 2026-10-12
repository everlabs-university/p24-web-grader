const HEADING = '## P-24 automatic tests';
const TABLE_HEADER = '| Practical | Automatic tests | Status |';
const TABLE_DIVIDER = '| --- | --- | --- |';
const PROVISIONAL_NOTE =
  'This result is provisional until the canonical grader is re-run locally on the same SHA.';
const KNOWN_STATUSES = new Set(['PASS', 'FAIL']);
const KNOWN_CHECK_STATUSES = new Set(['passed', 'failed', 'missing']);

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

function renderDetails(labScore, labIndex) {
  if (!Array.isArray(labScore.tests)) {
    throw summaryError(
      `labScores[${labIndex}].tests must be an array, received ${formatValue(labScore.tests)}.`,
    );
  }

  const rows = labScore.tests.map((test, testIndex) => {
    if (!isPlainObject(test)) {
      throw summaryError(
        `labScores[${labIndex}].tests[${testIndex}] must be an object, received ${formatValue(test)}.`,
      );
    }

    if (!isNonEmptyString(test.label)) {
      throw summaryError(
        `labScores[${labIndex}].tests[${testIndex}].label must be a non-empty public label.`,
      );
    }

    if (!Number.isInteger(test.points) || !Number.isInteger(test.awarded)) {
      throw summaryError(
        `labScores[${labIndex}].tests[${testIndex}] must contain integer points and awarded values.`,
      );
    }

    if (!KNOWN_CHECK_STATUSES.has(test.status)) {
      throw summaryError(
        `labScores[${labIndex}].tests[${testIndex}].status must be passed, failed or missing, received ${formatValue(test.status)}.`,
      );
    }

    const result = test.status === 'passed' ? 'PASS' : 'FAIL';
    return `| ${escapeCell(test.label)} | ${test.awarded}/${test.points} | ${result} |`;
  });

  return [
    `### ${escapeCell(labScore.title)} — ${labScore.points}/${labScore.maxPoints} ${labScore.status}`,
    '',
    '| Check | Points | Result |',
    '| --- | --- | --- |',
    ...rows,
  ];
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

  const overviewRows = labScores.map(renderRow);
  const hasFailures = labScores.some((labScore) => labScore.status === 'FAIL');
  const outcomeNote = hasFailures
    ? '> Grading completed. A red workflow means at least one published practical is below the pass score; the grader itself did not crash.'
    : '> Grading completed. All published practicals meet the pass score.';
  const details = labScores.flatMap((labScore, index) => [
    '',
    ...renderDetails(labScore, index),
  ]);

  return [
    HEADING,
    '',
    `- Student commit: \`${sha}\``,
    `- Grader version: \`${graderVersion}\``,
    '',
    TABLE_HEADER,
    TABLE_DIVIDER,
    ...overviewRows,
    '',
    outcomeNote,
    ...details,
    '',
    PROVISIONAL_NOTE,
    '',
  ].join('\n');
}
