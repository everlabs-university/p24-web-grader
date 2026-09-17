const PASSED = 'passed';
const FAILED = 'failed';
const MISSING = 'missing';
const KNOWN_STATUSES = new Set([PASSED, FAILED, 'skipped']);

function scoringError(code, message) {
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

function formatValue(value) {
  return JSON.stringify(value) ?? String(value);
}

function assertRubric(rubric) {
  if (!isPlainObject(rubric)) {
    throw scoringError(
      'ERR_SCORING_RUBRIC',
      `The rubric must be an object, received ${formatValue(rubric)}.`,
    );
  }

  if (!isNonEmptyString(rubric.id) || !isNonEmptyString(rubric.title)) {
    throw scoringError(
      'ERR_SCORING_RUBRIC',
      'The rubric must contain non-empty id and title strings.',
    );
  }

  if (!Number.isInteger(rubric.maxPoints) || !Number.isInteger(rubric.passPoints)) {
    throw scoringError(
      'ERR_SCORING_RUBRIC',
      `Rubric "${rubric.id}" must contain integer maxPoints and passPoints.`,
    );
  }

  if (!Array.isArray(rubric.tests)) {
    throw scoringError(
      'ERR_SCORING_RUBRIC',
      `Rubric "${rubric.id}": tests must be an array, received ${formatValue(rubric.tests)}.`,
    );
  }

  for (const [index, test] of rubric.tests.entries()) {
    if (!isPlainObject(test) || !isNonEmptyString(test.fullName) || !Number.isInteger(test.points)) {
      throw scoringError(
        'ERR_SCORING_RUBRIC',
        `Rubric "${rubric.id}": tests[${index}] must contain a non-empty fullName and integer points.`,
      );
    }
  }
}

function collectPassedByName(assertions) {
  if (!Array.isArray(assertions)) {
    throw scoringError(
      'ERR_SCORING_ASSERTIONS',
      `Test results must be an array, received ${formatValue(assertions)}.`,
    );
  }

  const passedByName = new Map();

  for (const [index, assertion] of assertions.entries()) {
    if (!isPlainObject(assertion)) {
      throw scoringError(
        'ERR_SCORING_ASSERTIONS',
        `Test result [${index}] must be an object, received ${formatValue(assertion)}.`,
      );
    }

    if (!isNonEmptyString(assertion.fullName)) {
      throw scoringError(
        'ERR_SCORING_ASSERTIONS',
        `Test result [${index}]: fullName must be a non-empty string, received ${formatValue(assertion.fullName)}.`,
      );
    }

    if (!KNOWN_STATUSES.has(assertion.status)) {
      throw scoringError(
        'ERR_SCORING_ASSERTIONS',
        `Test result "${assertion.fullName}": status must be passed, failed or skipped, received ${formatValue(assertion.status)}.`,
      );
    }

    const passed = assertion.status === PASSED;
    const previous = passedByName.get(assertion.fullName);
    passedByName.set(assertion.fullName, previous === undefined ? passed : previous && passed);
  }

  return passedByName;
}

function behaviourStatus(outcome) {
  if (outcome === undefined) return MISSING;
  return outcome ? PASSED : FAILED;
}

/** Pure scoring for a single lab and its per-test breakdown; the inputs are never mutated. */
export function scoreLab(rubric, assertions) {
  assertRubric(rubric);

  const passedByName = collectPassedByName(assertions);

  const tests = [];
  let points = 0;
  let passedTests = 0;

  for (const test of rubric.tests) {
    const outcome = passedByName.get(test.fullName);
    const passed = outcome === true;
    const awarded = passed ? test.points : 0;
    points += awarded;
    if (passed) passedTests += 1;
    tests.push({
      fullName: test.fullName,
      points: test.points,
      awarded,
      status: behaviourStatus(outcome),
    });
  }

  return {
    id: rubric.id,
    title: rubric.title,
    points,
    maxPoints: rubric.maxPoints,
    status: points >= rubric.passPoints ? 'PASS' : 'FAIL',
    passedTests,
    totalTests: rubric.tests.length,
    tests,
  };
}
