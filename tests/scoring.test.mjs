import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { scoreLab } from '../src/scoring.mjs';

const HOME = '/ renders the ProjectHub home page';
const LIST = '/projects renders the project list';
const DETAIL = '/projects/:projectId renders a single project page';
const NOT_FOUND = 'an unknown URL renders the 404 page';
const CLIENT_NAV = 'UI navigation changes the route without a full reload';
const DIRECT_ENTRY = 'direct entry to a detail route works';
const MISSING_ID = 'a missing projectId is handled gracefully';
const A11Y_LINKS = 'primary links have accessible names';

const PR01_RUBRIC = {
  id: 'pr01',
  title: 'Practical 1 — React Router',
  maxPoints: 80,
  passPoints: 48,
  tests: [
    { fullName: HOME, points: 10 },
    { fullName: LIST, points: 10 },
    { fullName: DETAIL, points: 10 },
    { fullName: NOT_FOUND, points: 10 },
    { fullName: CLIENT_NAV, points: 10 },
    { fullName: DIRECT_ENTRY, points: 10 },
    { fullName: MISSING_ID, points: 10 },
    { fullName: A11Y_LINKS, points: 10 },
  ],
};

const WEIGHTED_RUBRIC = {
  id: 'pr01',
  title: 'Practical 1 — React Router',
  maxPoints: 80,
  passPoints: 48,
  tests: [
    { fullName: HOME, points: 30 },
    { fullName: LIST, points: 50 },
  ],
};

function summaryOf(score) {
  const { tests, ...summary } = score;
  return summary;
}

describe('scoreLab', () => {
  it('awards 80/80 and PASS when all eight behaviours pass', () => {
    const score = scoreLab(PR01_RUBRIC, [
      { fullName: HOME, status: 'passed' },
      { fullName: LIST, status: 'passed' },
      { fullName: DETAIL, status: 'passed' },
      { fullName: NOT_FOUND, status: 'passed' },
      { fullName: CLIENT_NAV, status: 'passed' },
      { fullName: DIRECT_ENTRY, status: 'passed' },
      { fullName: MISSING_ID, status: 'passed' },
      { fullName: A11Y_LINKS, status: 'passed' },
    ]);

    assert.deepStrictEqual(summaryOf(score), {
      id: 'pr01',
      title: 'Practical 1 — React Router',
      points: 80,
      maxPoints: 80,
      status: 'PASS',
      passedTests: 8,
      totalTests: 8,
    });
  });

  it('awards 50/80 and PASS when five of eight behaviours pass', () => {
    const score = scoreLab(PR01_RUBRIC, [
      { fullName: HOME, status: 'passed' },
      { fullName: LIST, status: 'passed' },
      { fullName: DETAIL, status: 'passed' },
      { fullName: NOT_FOUND, status: 'passed' },
      { fullName: CLIENT_NAV, status: 'passed' },
      { fullName: DIRECT_ENTRY, status: 'failed' },
      { fullName: MISSING_ID, status: 'failed' },
      { fullName: A11Y_LINKS, status: 'failed' },
    ]);

    assert.deepStrictEqual(summaryOf(score), {
      id: 'pr01',
      title: 'Practical 1 — React Router',
      points: 50,
      maxPoints: 80,
      status: 'PASS',
      passedTests: 5,
      totalTests: 8,
    });
  });

  it('awards 40/80 and FAIL when four of eight behaviours pass', () => {
    const score = scoreLab(PR01_RUBRIC, [
      { fullName: HOME, status: 'passed' },
      { fullName: LIST, status: 'passed' },
      { fullName: DETAIL, status: 'passed' },
      { fullName: NOT_FOUND, status: 'passed' },
      { fullName: CLIENT_NAV, status: 'failed' },
      { fullName: DIRECT_ENTRY, status: 'failed' },
      { fullName: MISSING_ID, status: 'failed' },
      { fullName: A11Y_LINKS, status: 'failed' },
    ]);

    assert.deepStrictEqual(summaryOf(score), {
      id: 'pr01',
      title: 'Practical 1 — React Router',
      points: 40,
      maxPoints: 80,
      status: 'FAIL',
      passedTests: 4,
      totalTests: 8,
    });
  });

  it('awards zero points for a skipped behaviour', () => {
    const score = scoreLab(PR01_RUBRIC, [
      { fullName: HOME, status: 'passed' },
      { fullName: LIST, status: 'passed' },
      { fullName: DETAIL, status: 'passed' },
      { fullName: NOT_FOUND, status: 'passed' },
      { fullName: CLIENT_NAV, status: 'passed' },
      { fullName: DIRECT_ENTRY, status: 'passed' },
      { fullName: MISSING_ID, status: 'skipped' },
      { fullName: A11Y_LINKS, status: 'passed' },
    ]);

    assert.deepStrictEqual(summaryOf(score), {
      id: 'pr01',
      title: 'Practical 1 — React Router',
      points: 70,
      maxPoints: 80,
      status: 'PASS',
      passedTests: 7,
      totalTests: 8,
    });
  });

  it('ignores passing assertions that are not in the rubric', () => {
    const score = scoreLab(PR01_RUBRIC, [
      { fullName: HOME, status: 'passed' },
      { fullName: LIST, status: 'passed' },
      { fullName: DETAIL, status: 'passed' },
      { fullName: NOT_FOUND, status: 'passed' },
      { fullName: CLIENT_NAV, status: 'failed' },
      { fullName: DIRECT_ENTRY, status: 'failed' },
      { fullName: MISSING_ID, status: 'failed' },
      { fullName: A11Y_LINKS, status: 'failed' },
      { fullName: 'extra test outside the rubric #1', status: 'passed' },
      { fullName: 'extra test outside the rubric #2', status: 'passed' },
      { fullName: 'extra test outside the rubric #3', status: 'passed' },
      { fullName: 'extra test outside the rubric #4', status: 'passed' },
    ]);

    assert.deepStrictEqual(summaryOf(score), {
      id: 'pr01',
      title: 'Practical 1 — React Router',
      points: 40,
      maxPoints: 80,
      status: 'FAIL',
      passedTests: 4,
      totalTests: 8,
    });
  });

  it('awards zero points for a rubric behaviour absent from the assertions', () => {
    const score = scoreLab(PR01_RUBRIC, [
      { fullName: HOME, status: 'passed' },
      { fullName: LIST, status: 'passed' },
      { fullName: DETAIL, status: 'passed' },
    ]);

    assert.deepStrictEqual(summaryOf(score), {
      id: 'pr01',
      title: 'Practical 1 — React Router',
      points: 30,
      maxPoints: 80,
      status: 'FAIL',
      passedTests: 3,
      totalTests: 8,
    });
  });

  it('reports a per-test breakdown in rubric order with awarded points and a status', () => {
    const score = scoreLab(PR01_RUBRIC, [
      { fullName: A11Y_LINKS, status: 'passed' },
      { fullName: NOT_FOUND, status: 'skipped' },
      { fullName: HOME, status: 'passed' },
      { fullName: 'extra test outside the rubric', status: 'passed' },
      { fullName: DIRECT_ENTRY, status: 'passed' },
      { fullName: DETAIL, status: 'failed' },
      { fullName: LIST, status: 'passed' },
    ]);

    assert.deepStrictEqual(score.tests, [
      { fullName: HOME, points: 10, awarded: 10, status: 'passed' },
      { fullName: LIST, points: 10, awarded: 10, status: 'passed' },
      { fullName: DETAIL, points: 10, awarded: 0, status: 'failed' },
      { fullName: NOT_FOUND, points: 10, awarded: 0, status: 'failed' },
      { fullName: CLIENT_NAV, points: 10, awarded: 0, status: 'missing' },
      { fullName: DIRECT_ENTRY, points: 10, awarded: 10, status: 'passed' },
      { fullName: MISSING_ID, points: 10, awarded: 0, status: 'missing' },
      { fullName: A11Y_LINKS, points: 10, awarded: 10, status: 'passed' },
    ]);

    assert.deepStrictEqual(summaryOf(score), {
      id: 'pr01',
      title: 'Practical 1 — React Router',
      points: 40,
      maxPoints: 80,
      status: 'FAIL',
      passedTests: 4,
      totalTests: 8,
    });
  });

  it('awards each behaviour its own rubric weight rather than a fixed amount', () => {
    const score = scoreLab(WEIGHTED_RUBRIC, [
      { fullName: HOME, status: 'passed' },
      { fullName: LIST, status: 'failed' },
    ]);

    assert.deepStrictEqual(score.tests, [
      { fullName: HOME, points: 30, awarded: 30, status: 'passed' },
      { fullName: LIST, points: 50, awarded: 0, status: 'failed' },
    ]);
    assert.equal(score.points, 30);
    assert.equal(score.status, 'FAIL');
  });
});
