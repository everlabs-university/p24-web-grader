import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { expect, it } from 'vitest';

const APP_PATH = resolve(process.cwd(), 'pr04-leaderboard-analyzer', 'app.js');

function loadAnalyzeLeaderboard() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(readFileSync(APP_PATH, 'utf8'), context, { filename: APP_PATH });
  expect(context.analyzeLeaderboard).toEqual(expect.any(Function));
  return context.analyzeLeaderboard;
}

function playersFixture() {
  return [
    { name: 'Marta', scores: [82, 94, 88] },
    { name: 'Bohdan', scores: [70, 75, 80] },
    { name: 'Iryna', scores: [95, 91, 97] },
  ];
}

function expectErrorWithoutThrow(analyzeLeaderboard, value) {
  let result;
  expect(() => { result = analyzeLeaderboard(value); }).not.toThrow();
  expect(result).toMatchObject({ ok: false });
  expect(result.message).toEqual(expect.any(String));
  expect(result.message.trim().length).toBeGreaterThan(0);
}

it('each player receives an exact total average and best score', () => {
  const result = loadAnalyzeLeaderboard()(playersFixture());
  expect(result.ok).toBe(true);
  expect(result.players.find(({ name }) => name === 'Marta')).toMatchObject({
    name: 'Marta', total: 264, average: 88, best: 94,
  });
  expect(result.players.find(({ name }) => name === 'Bohdan')).toMatchObject({
    name: 'Bohdan', total: 225, average: 75, best: 80,
  });
});

it('players are sorted from the strongest average to the weakest', () => {
  const result = loadAnalyzeLeaderboard()(playersFixture());
  expect(result.players.map(({ name }) => name)).toEqual(['Iryna', 'Marta', 'Bohdan']);
});

it('equal averages use best score and then name as deterministic tie breakers', () => {
  const result = loadAnalyzeLeaderboard()([
    { name: 'Zoia', scores: [80, 100] },
    { name: 'Anna', scores: [90, 90] },
    { name: 'Maksym', scores: [100, 80] },
  ]);
  expect(result.players.map(({ name }) => name)).toEqual(['Maksym', 'Zoia', 'Anna']);
});

it('sorted players receive sequential ranks starting at one', () => {
  const result = loadAnalyzeLeaderboard()(playersFixture());
  expect(result.players.map(({ rank }) => rank)).toEqual([1, 2, 3]);
});

it('the summary reports player count class average and highest score', () => {
  const result = loadAnalyzeLeaderboard()(playersFixture());
  expect(result.summary).toEqual({ playerCount: 3, classAverage: 85.8, highestScore: 97 });
});

it('invalid leaderboard data returns an error result without throwing', () => {
  const analyzeLeaderboard = loadAnalyzeLeaderboard();
  for (const value of [
    null,
    [],
    [{ name: '', scores: [80] }],
    [{ name: 'Marta', scores: [] }],
    [{ name: 'Marta', scores: [80, -1] }],
    [{ name: 'Marta', scores: [80, 101] }],
    [{ name: 'Marta', scores: [80.5] }],
  ]) expectErrorWithoutThrow(analyzeLeaderboard, value);
});

it('analysis leaves the source players and nested score arrays unchanged', () => {
  const players = playersFixture();
  const snapshot = JSON.stringify(players);
  const result = loadAnalyzeLeaderboard()(players);
  expect(result.ok).toBe(true);
  expect(JSON.stringify(players)).toBe(snapshot);
  expect(result.players[0]).not.toBe(players[0]);
  for (const original of players) {
    const analyzed = result.players.find(({ name }) => name === original.name);
    expect(analyzed.scores).not.toBe(original.scores);
  }
});

it('repeated analysis returns independent players and score arrays', () => {
  const analyzeLeaderboard = loadAnalyzeLeaderboard();
  const first = analyzeLeaderboard(playersFixture());
  const second = analyzeLeaderboard(playersFixture());
  expect(first.players).not.toBe(second.players);
  expect(first.players[0]).not.toBe(second.players[0]);
  expect(first.players[0].scores).not.toBe(second.players[0].scores);
  first.players[0].scores.push(0);
  expect(second.players[0].scores).toHaveLength(3);
});
