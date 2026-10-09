import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { expect, it } from 'vitest';

const APP_PATH = resolve(process.cwd(), 'pr03-workout-timer', 'app.js');

function loadFunctions() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(readFileSync(APP_PATH, 'utf8'), context, { filename: APP_PATH });
  expect(context.createWorkoutPlan).toEqual(expect.any(Function));
  expect(context.formatDuration).toEqual(expect.any(Function));
  return context;
}

function expectErrorWithoutThrow(createWorkoutPlan, ...args) {
  let result;
  expect(() => { result = createWorkoutPlan(...args); }).not.toThrow();
  expect(result).toMatchObject({ ok: false });
  expect(result.message).toEqual(expect.any(String));
  expect(result.message.trim().length).toBeGreaterThan(0);
}

it('one workout round contains one work step and no trailing rest', () => {
  const result = loadFunctions().createWorkoutPlan(1, 30, 10);
  expect(result).toMatchObject({ ok: true, rounds: 1, workSeconds: 30, restSeconds: 10 });
  expect(result.steps).toEqual([{ type: 'work', round: 1, duration: 30 }]);
});

it('multiple rounds alternate work and rest in order', () => {
  const result = loadFunctions().createWorkoutPlan(3, 30, 10);
  expect(result.steps).toEqual([
    { type: 'work', round: 1, duration: 30 },
    { type: 'rest', round: 1, duration: 10 },
    { type: 'work', round: 2, duration: 30 },
    { type: 'rest', round: 2, duration: 10 },
    { type: 'work', round: 3, duration: 30 },
  ]);
});

it('the final round never adds a trailing rest step', () => {
  const result = loadFunctions().createWorkoutPlan(4, 20, 5);
  expect(result.steps).toHaveLength(7);
  expect(result.steps.at(-1)).toEqual({ type: 'work', round: 4, duration: 20 });
});

it('zero rest seconds omits rest steps without breaking round numbers', () => {
  const result = loadFunctions().createWorkoutPlan(3, 15, 0);
  expect(result.steps).toEqual([
    { type: 'work', round: 1, duration: 15 },
    { type: 'work', round: 2, duration: 15 },
    { type: 'work', round: 3, duration: 15 },
  ]);
});

it('the plan reports the exact total duration', () => {
  const result = loadFunctions().createWorkoutPlan(3, 30, 10);
  expect(result.totalDuration).toBe(110);
  expect(result.steps.reduce((sum, step) => sum + step.duration, 0)).toBe(result.totalDuration);
});

it('formatDuration returns zero-padded minute and second text', () => {
  const { formatDuration } = loadFunctions();
  expect(formatDuration(0)).toBe('00:00');
  expect(formatDuration(5)).toBe('00:05');
  expect(formatDuration(65)).toBe('01:05');
  expect(formatDuration(3605)).toBe('60:05');
});

it('invalid workout values return an error result without throwing', () => {
  const { createWorkoutPlan } = loadFunctions();
  for (const args of [[0, 30, 10], [21, 30, 10], [1.5, 30, 10], [3, 4, 10], [3, 3601, 10], [3, 30, -1], [3, 30, 1801], ['3', 30, 10]]) {
    expectErrorWithoutThrow(createWorkoutPlan, ...args);
  }
});

it('repeated calls return independent step arrays', () => {
  const { createWorkoutPlan } = loadFunctions();
  const first = createWorkoutPlan(2, 30, 10);
  const second = createWorkoutPlan(2, 30, 10);
  expect(first.steps).not.toBe(second.steps);
  first.steps.push({ type: 'rest', round: 99, duration: 99 });
  expect(second.steps).toHaveLength(3);
});
