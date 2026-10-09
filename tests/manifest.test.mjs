import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublished, loadRubric } from '../src/manifest.mjs';

const GRADER_ROOT = fileURLToPath(new URL('..', import.meta.url));

const PR01_BEHAVIOURS = [
  'personal names are non-empty and contain no TODO',
  'group is one of the documented P-24 groups',
  'fullName combines firstName and lastName',
  'specialty is a non-empty value',
  'weeklyHours is a realistic finite number',
  'semester workload is calculated from 15 weeks',
  'intro contains the generated profile details',
  'renderProfile receives the profile exactly once',
];

const PR02_BEHAVIOURS = [
  'pickup without a discount keeps a 500 UAH total',
  'a student receives 5 percent before standard delivery',
  'a 1000 UAH order receives 10 percent and free standard delivery',
  'express delivery stays 150 UAH and the stronger discount wins',
  'the 1000 UAH discount boundary is inclusive',
  'standard delivery becomes free at a discounted subtotal of 750',
  'invalid subtotal values return an error result without throwing',
  'invalid student or delivery values return an error result without throwing',
];

const PR03_BEHAVIOURS = [
  'one workout round contains one work step and no trailing rest',
  'multiple rounds alternate work and rest in order',
  'the final round never adds a trailing rest step',
  'zero rest seconds omits rest steps without breaking round numbers',
  'the plan reports the exact total duration',
  'formatDuration returns zero-padded minute and second text',
  'invalid workout values return an error result without throwing',
  'repeated calls return independent step arrays',
];

const PR04_BEHAVIOURS = [
  'each player receives an exact total average and best score',
  'players are sorted from the strongest average to the weakest',
  'equal averages use best score and then name as deterministic tie breakers',
  'sorted players receive sequential ranks starting at one',
  'the summary reports player count class average and highest score',
  'invalid leaderboard data returns an error result without throwing',
  'analysis leaves the source players and nested score arrays unchanged',
  'repeated analysis returns independent players and score arrays',
];

const PR05_BEHAVIOURS = [
  'adding a new product creates a normalized line without mutating inputs',
  'adding an existing product merges quantities in the original line order',
  'stock limits and invalid additions return errors without throwing',
  'removing a product returns a new cart and preserves the source',
  'removing an unknown product returns an error without throwing',
  'the summary reports exact counts subtotal shipping and total',
  'the strongest discount wins and shipping uses the discounted subtotal',
  'malformed carts and promo codes return errors without throwing',
];

const PR06_BEHAVIOURS = [
  'creating a quiz validates and clones the question model',
  'selecting an answer updates state immutably and rejects unknown answers',
  'submitting locks the answer and awards each question at most once',
  'next question advances the flow and completes the final question',
  'restarting produces a clean independent quiz state',
  'mounting renders the first question answers and progress accessibly',
  'the browser flow selects submits advances and renders final results',
  'invalid quiz data renders an accessible error without throwing',
];

async function writePublished(root, text) {
  await writeFile(join(root, 'published.json'), text, 'utf8');
}

async function writeRubric(root, labId, text) {
  await mkdir(join(root, 'labs', labId), { recursive: true });
  await writeFile(join(root, 'labs', labId, 'rubric.json'), text, 'utf8');
}

describe('shipped grader manifest', () => {
  it('loads the PR06 draft manifest cumulatively', async () => {
    assert.deepStrictEqual(await loadPublished(GRADER_ROOT), {
      schemaVersion: 1,
      graderVersion: '2026.10.09.4-draft',
      labs: ['pr01', 'pr02', 'pr03', 'pr04', 'pr05', 'pr06'],
    });
  });

  for (const [labId, title, behaviours] of [
    ['pr01', 'Practical 1 — Personal Card', PR01_BEHAVIOURS],
    ['pr02', 'Practical 2 — Smart Checkout', PR02_BEHAVIOURS],
    ['pr03', 'Practical 3 — Workout Timer Core', PR03_BEHAVIOURS],
    ['pr04', 'Practical 4 — Leaderboard Analyzer', PR04_BEHAVIOURS],
    ['pr05', 'Practical 5 — Modular Shopping Cart', PR05_BEHAVIOURS],
    ['pr06', 'Practical 6 — Interactive Quiz', PR06_BEHAVIOURS],
  ]) {
    it(`loads ${labId} as eight ten-point behaviours with a 48 pass mark`, async () => {
      const rubric = await loadRubric(GRADER_ROOT, labId);

      assert.equal(rubric.id, labId);
      assert.equal(rubric.title, title);
      assert.equal(rubric.maxPoints, 80);
      assert.equal(rubric.passPoints, 48);
      assert.deepStrictEqual(rubric.tests.map((entry) => entry.fullName), behaviours);
      assert.deepStrictEqual(rubric.tests.map((entry) => entry.points), Array(8).fill(10));
    });
  }

  it('has a rubric for every published lab', async () => {
    const published = await loadPublished(GRADER_ROOT);
    for (const labId of published.labs) {
      assert.equal((await loadRubric(GRADER_ROOT, labId)).id, labId);
    }
  });
});

describe('manifest validation', () => {
  let workspace;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'p24-web-manifest-'));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('rejects duplicate lab ids in published.json', async () => {
    await writePublished(workspace, `{
  "schemaVersion": 1,
  "graderVersion": "2026.09.17.1",
  "labs": ["pr01", "pr02", "pr01"]
}\n`);

    await assert.rejects(
      () => loadPublished(workspace),
      (error) => error.code === 'ERR_MANIFEST_DUPLICATE_LAB' && /pr01/.test(error.message),
    );
  });

  it('rejects rubric weights that do not total 80', async () => {
    await writeRubric(workspace, 'pr01', `{
  "id": "pr01",
  "title": "Practical 1",
  "maxPoints": 80,
  "passPoints": 48,
  "tests": [
    { "fullName": "first behaviour", "points": 40 },
    { "fullName": "second behaviour", "points": 30 }
  ]
}\n`);

    await assert.rejects(
      () => loadRubric(workspace, 'pr01'),
      (error) => error.code === 'ERR_RUBRIC_WEIGHTS' && /70/.test(error.message),
    );
  });

  it('rejects invalid pass thresholds and duplicate test names', async () => {
    await writeRubric(workspace, 'pr01', `{
  "id": "pr01",
  "title": "Practical 1",
  "maxPoints": 80,
  "passPoints": 96,
  "tests": [
    { "fullName": "duplicate", "points": 40 },
    { "fullName": "duplicate", "points": 40 }
  ]
}\n`);

    await assert.rejects(
      () => loadRubric(workspace, 'pr01'),
      (error) => error.code === 'ERR_RUBRIC_DUPLICATE_TEST'
        || error.code === 'ERR_RUBRIC_PASS_THRESHOLD',
    );
  });

  it('rejects a published lab with no rubric', async () => {
    await writePublished(workspace, `{
  "schemaVersion": 1,
  "graderVersion": "2026.09.17.1",
  "labs": ["pr99"]
}\n`);

    await assert.rejects(
      () => loadRubric(workspace, 'pr99'),
      (error) => error.code === 'ERR_RUBRIC_MISSING',
    );
  });
});
