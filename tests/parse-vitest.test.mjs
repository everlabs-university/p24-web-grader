import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseVitestJson } from '../src/parse-vitest.mjs';

const HOME = '/ renders the ProjectHub home page';
const LIST = '/projects renders the project list';
const DETAIL = '/projects/:projectId renders a single project page';
const NOT_FOUND = 'an unknown URL renders the 404 page';
const CLIENT_NAV = 'UI navigation changes the route without a full reload';
const CART_TOTAL = 'the cart calculates the total';
const CART_EMPTY = 'an empty cart shows a hint';

const PR01_FILE =
  '/home/runner/work/projecthub/projecthub/.projecthub-grader/labs/pr01/routes.test.tsx';
const PR02_FILE =
  '/home/runner/work/projecthub/projecthub/.projecthub-grader/labs/pr02/cart.test.tsx';

/** Output of `vitest --reporter=json` (Vitest 5) for a single lab file. */
const SINGLE_FILE_REPORT = `{
  "numTotalTestSuites": 1,
  "numPassedTestSuites": 0,
  "numFailedTestSuites": 1,
  "numPendingTestSuites": 0,
  "numTotalTests": 3,
  "numPassedTests": 1,
  "numFailedTests": 1,
  "numPendingTests": 1,
  "numTodoTests": 0,
  "snapshot": { "added": 0, "failure": false, "filesAdded": 0, "filesRemoved": 0, "filesRemovedList": [], "filesUnmatched": 0, "filesUpdated": 0, "matched": 0, "total": 0, "unchecked": 0, "uncheckedKeysByFile": [], "unmatched": 0, "updated": 0, "didUpdate": false },
  "startTime": 1757145600000,
  "success": false,
  "testResults": [
    {
      "assertionResults": [
        {
          "ancestorTitles": [],
          "fullName": "${HOME}",
          "status": "passed",
          "title": "${HOME}",
          "duration": 46,
          "failureMessages": [],
          "location": { "line": 52, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        },
        {
          "ancestorTitles": [],
          "fullName": "${DETAIL}",
          "status": "failed",
          "title": "${DETAIL}",
          "duration": 1187,
          "failureMessages": ["AssertionError: expected '/projects' to be '/projects/onboarding'\\n    at ${PR01_FILE}:78:38"],
          "location": { "line": 64, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        },
        {
          "ancestorTitles": [],
          "fullName": "${NOT_FOUND}",
          "status": "skipped",
          "title": "${NOT_FOUND}",
          "failureMessages": [],
          "location": { "line": 84, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        }
      ],
      "startTime": 1757145601422,
      "endTime": 1757145602701,
      "status": "failed",
      "message": "",
      "name": "${PR01_FILE}"
    }
  ]
}
`;

/** The same reporter when published.json lists two practicals. */
const TWO_FILE_REPORT = `{
  "numTotalTestSuites": 2,
  "numPassedTestSuites": 1,
  "numFailedTestSuites": 1,
  "numPendingTestSuites": 0,
  "numTotalTests": 4,
  "numPassedTests": 3,
  "numFailedTests": 1,
  "numPendingTests": 0,
  "numTodoTests": 0,
  "snapshot": { "added": 0, "failure": false, "filesAdded": 0, "filesRemoved": 0, "filesRemovedList": [], "filesUnmatched": 0, "filesUpdated": 0, "matched": 0, "total": 0, "unchecked": 0, "uncheckedKeysByFile": [], "unmatched": 0, "updated": 0, "didUpdate": false },
  "startTime": 1757145600000,
  "success": false,
  "testResults": [
    {
      "assertionResults": [
        {
          "ancestorTitles": [],
          "fullName": "${LIST}",
          "status": "passed",
          "title": "${LIST}",
          "duration": 38,
          "failureMessages": [],
          "location": { "line": 58, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        },
        {
          "ancestorTitles": [],
          "fullName": "${CLIENT_NAV}",
          "status": "failed",
          "title": "${CLIENT_NAV}",
          "duration": 1204,
          "failureMessages": ["AssertionError: expected '/' to be '/projects'\\n    at ${PR01_FILE}:96:38"],
          "location": { "line": 88, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        }
      ],
      "startTime": 1757145601422,
      "endTime": 1757145602701,
      "status": "failed",
      "message": "",
      "name": "${PR01_FILE}"
    },
    {
      "assertionResults": [
        {
          "ancestorTitles": [],
          "fullName": "${CART_TOTAL}",
          "status": "passed",
          "title": "${CART_TOTAL}",
          "duration": 21,
          "failureMessages": [],
          "location": { "line": 24, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        },
        {
          "ancestorTitles": [],
          "fullName": "${CART_EMPTY}",
          "status": "passed",
          "title": "${CART_EMPTY}",
          "duration": 17,
          "failureMessages": [],
          "location": { "line": 33, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        }
      ],
      "startTime": 1757145602710,
      "endTime": 1757145603006,
      "status": "passed",
      "message": "",
      "name": "${PR02_FILE}"
    }
  ]
}
`;

/** `todo` and `pending` come from the Vitest StatusMap; `flaky` comes from a third-party reporter. */
const MIXED_STATUS_REPORT = `{
  "numTotalTestSuites": 1,
  "numPassedTestSuites": 0,
  "numFailedTestSuites": 0,
  "numPendingTestSuites": 1,
  "numTotalTests": 4,
  "numPassedTests": 1,
  "numFailedTests": 0,
  "numPendingTests": 2,
  "numTodoTests": 1,
  "snapshot": { "added": 0, "failure": false, "filesAdded": 0, "filesRemoved": 0, "filesRemovedList": [], "filesUnmatched": 0, "filesUpdated": 0, "matched": 0, "total": 0, "unchecked": 0, "uncheckedKeysByFile": [], "unmatched": 0, "updated": 0, "didUpdate": false },
  "startTime": 1757145600000,
  "success": true,
  "testResults": [
    {
      "assertionResults": [
        {
          "ancestorTitles": [],
          "fullName": "${LIST}",
          "status": "passed",
          "title": "${LIST}",
          "duration": 33,
          "failureMessages": [],
          "location": { "line": 58, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        },
        {
          "ancestorTitles": [],
          "fullName": "${CLIENT_NAV}",
          "status": "todo",
          "title": "${CLIENT_NAV}",
          "failureMessages": [],
          "location": { "line": 88, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        },
        {
          "ancestorTitles": [],
          "fullName": "${NOT_FOUND}",
          "status": "pending",
          "title": "${NOT_FOUND}",
          "failureMessages": [],
          "location": { "line": 84, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        },
        {
          "ancestorTitles": [],
          "fullName": "${DETAIL}",
          "status": "flaky",
          "title": "${DETAIL}",
          "duration": 902,
          "failureMessages": [],
          "location": { "line": 64, "column": 1 },
          "meta": {},
          "tags": [],
          "benchmarks": []
        }
      ],
      "startTime": 1757145601422,
      "endTime": 1757145602701,
      "status": "passed",
      "message": "",
      "name": "${PR01_FILE}"
    }
  ]
}
`;

/** The suite failed while importing `@student/App`, so Vitest collected no tests. */
const EMPTY_ASSERTIONS_REPORT = `{
  "numTotalTestSuites": 1,
  "numPassedTestSuites": 0,
  "numFailedTestSuites": 1,
  "numPendingTestSuites": 0,
  "numTotalTests": 0,
  "numPassedTests": 0,
  "numFailedTests": 0,
  "numPendingTests": 0,
  "numTodoTests": 0,
  "snapshot": { "added": 0, "failure": false, "filesAdded": 0, "filesRemoved": 0, "filesRemovedList": [], "filesUnmatched": 0, "filesUpdated": 0, "matched": 0, "total": 0, "unchecked": 0, "uncheckedKeysByFile": [], "unmatched": 0, "updated": 0, "didUpdate": false },
  "startTime": 1757145600000,
  "success": false,
  "testResults": [
    {
      "assertionResults": [],
      "startTime": 1757145600841,
      "endTime": 1757145600841,
      "status": "failed",
      "message": "Failed to resolve import \\"@student/App\\" from \\"labs/pr01/routes.test.tsx\\".",
      "name": "${PR01_FILE}"
    }
  ]
}
`;

/** The reporter was cut off midway through writing the file. */
const MALFORMED_REPORT = `{
  "numTotalTests": 8,
  "numPassedTests": 8,
  "success": true,
  "testResults": [
`;

const REPORT_WITHOUT_TEST_RESULTS = `{
  "numTotalTestSuites": 0,
  "numPassedTestSuites": 0,
  "numFailedTestSuites": 0,
  "numPendingTestSuites": 0,
  "numTotalTests": 0,
  "numPassedTests": 0,
  "numFailedTests": 0,
  "numPendingTests": 0,
  "numTodoTests": 0,
  "snapshot": { "added": 0, "failure": false, "filesAdded": 0, "filesRemoved": 0, "filesRemovedList": [], "filesUnmatched": 0, "filesUpdated": 0, "matched": 0, "total": 0, "unchecked": 0, "uncheckedKeysByFile": [], "unmatched": 0, "updated": 0, "didUpdate": false },
  "startTime": 1757145600000,
  "success": false
}
`;

const REPORT_WITHOUT_ASSERTION_RESULTS = `{
  "numTotalTestSuites": 1,
  "numPassedTestSuites": 0,
  "numFailedTestSuites": 1,
  "numPendingTestSuites": 0,
  "numTotalTests": 0,
  "numPassedTests": 0,
  "numFailedTests": 0,
  "numPendingTests": 0,
  "numTodoTests": 0,
  "snapshot": { "added": 0, "failure": false, "filesAdded": 0, "filesRemoved": 0, "filesRemovedList": [], "filesUnmatched": 0, "filesUpdated": 0, "matched": 0, "total": 0, "unchecked": 0, "uncheckedKeysByFile": [], "unmatched": 0, "updated": 0, "didUpdate": false },
  "startTime": 1757145600000,
  "success": false,
  "testResults": [
    {
      "startTime": 1757145600841,
      "endTime": 1757145600841,
      "status": "failed",
      "message": "",
      "name": "${PR01_FILE}"
    }
  ]
}
`;

describe('parseVitestJson', () => {
  it('maps passed, failed and skipped assertions to fullName and status', () => {
    assert.deepStrictEqual(parseVitestJson(SINGLE_FILE_REPORT), [
      { fullName: HOME, status: 'passed' },
      { fullName: DETAIL, status: 'failed' },
      { fullName: NOT_FOUND, status: 'skipped' },
    ]);
  });

  it('preserves assertion order across several result files', () => {
    assert.deepStrictEqual(parseVitestJson(TWO_FILE_REPORT), [
      { fullName: LIST, status: 'passed' },
      { fullName: CLIENT_NAV, status: 'failed' },
      { fullName: CART_TOTAL, status: 'passed' },
      { fullName: CART_EMPTY, status: 'passed' },
    ]);
  });

  it('treats every status other than passed and failed as skipped', () => {
    assert.deepStrictEqual(parseVitestJson(MIXED_STATUS_REPORT), [
      { fullName: LIST, status: 'passed' },
      { fullName: CLIENT_NAV, status: 'skipped' },
      { fullName: NOT_FOUND, status: 'skipped' },
      { fullName: DETAIL, status: 'skipped' },
    ]);
  });

  it('returns no assertions when a suite failed before collecting tests', () => {
    assert.deepStrictEqual(parseVitestJson(EMPTY_ASSERTIONS_REPORT), []);
  });

  it('rejects output that is not valid JSON', () => {
    assert.throws(
      () => parseVitestJson(MALFORMED_REPORT),
      (error) => {
        assert.equal(error.code, 'ERR_VITEST_JSON_MALFORMED');
        assert.match(error.message, /JSON/);
        return true;
      },
    );
  });

  it('rejects a report without testResults', () => {
    assert.throws(
      () => parseVitestJson(REPORT_WITHOUT_TEST_RESULTS),
      (error) => {
        assert.equal(error.code, 'ERR_VITEST_JSON_SHAPE');
        assert.match(error.message, /testResults/);
        return true;
      },
    );
  });

  it('rejects a result file without assertionResults', () => {
    assert.throws(
      () => parseVitestJson(REPORT_WITHOUT_ASSERTION_RESULTS),
      (error) => {
        assert.equal(error.code, 'ERR_VITEST_JSON_SHAPE');
        assert.match(error.message, /assertionResults/);
        assert.match(error.message, /routes\.test\.tsx/);
        return true;
      },
    );
  });
});
