const PASSED = 'passed';
const FAILED = 'failed';
const SKIPPED = 'skipped';

function parseError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function formatValue(value) {
  return JSON.stringify(value) ?? String(value);
}

function normaliseStatus(status) {
  if (status === PASSED) return PASSED;
  if (status === FAILED) return FAILED;
  return SKIPPED;
}

function describeFile(file, index) {
  return isNonEmptyString(file.name) ? file.name : `testResults[${index}]`;
}

export function parseVitestJson(raw) {
  if (typeof raw !== 'string') {
    throw parseError('ERR_VITEST_JSON_MALFORMED', `The Vitest report must be a JSON string, received ${formatValue(raw)}.`);
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch (cause) {
    throw parseError('ERR_VITEST_JSON_MALFORMED', `The Vitest report contains malformed JSON: ${cause.message}`);
  }

  if (!isPlainObject(report)) {
    throw parseError('ERR_VITEST_JSON_SHAPE', `The Vitest report must be a JSON object, received ${formatValue(report)}.`);
  }
  if (!Array.isArray(report.testResults)) {
    throw parseError('ERR_VITEST_JSON_SHAPE', `Vitest report: testResults must be an array, received ${formatValue(report.testResults)}.`);
  }

  const assertions = [];
  for (const [fileIndex, file] of report.testResults.entries()) {
    if (!isPlainObject(file)) {
      throw parseError('ERR_VITEST_JSON_SHAPE', `Vitest report: testResults[${fileIndex}] must be a JSON object, received ${formatValue(file)}.`);
    }
    const fileName = describeFile(file, fileIndex);
    if (!Array.isArray(file.assertionResults)) {
      throw parseError('ERR_VITEST_JSON_SHAPE', `Vitest report (${fileName}): assertionResults must be an array, received ${formatValue(file.assertionResults)}.`);
    }
    for (const [index, assertion] of file.assertionResults.entries()) {
      if (!isPlainObject(assertion) || !isNonEmptyString(assertion.fullName)) {
        throw parseError('ERR_VITEST_JSON_SHAPE', `Vitest report (${fileName}): assertionResults[${index}].fullName must be a non-empty string, received ${formatValue(assertion?.fullName)}.`);
      }
      assertions.push({ fullName: assertion.fullName, status: normaliseStatus(assertion.status) });
    }
  }

  return assertions;
}
