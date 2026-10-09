import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';

const ENGINE_PATH = resolve(process.cwd(), 'pr06-interactive-quiz', 'quiz-engine.js');
const APP_PATH = resolve(process.cwd(), 'pr06-interactive-quiz', 'quiz-app.js');
let importSequence = 0;

const questionsFixture = () => [
  {
    id: 'dom',
    text: 'What does the DOM represent?',
    answers: [
      { id: 'tree', text: 'A live document tree' },
      { id: 'database', text: 'A database table' },
    ],
    correctAnswerId: 'tree',
  },
  {
    id: 'events',
    text: 'Which method subscribes to browser events?',
    answers: [
      { id: 'listen', text: 'addEventListener' },
      { id: 'query', text: 'querySelector' },
    ],
    correctAnswerId: 'listen',
  },
];

async function importFresh(filePath) {
  const url = pathToFileURL(filePath);
  url.searchParams.set('test', String(importSequence += 1));
  return import(url.href);
}

async function loadEngine() {
  const module = await importFresh(ENGINE_PATH);
  for (const name of ['createQuiz', 'selectAnswer', 'submitAnswer', 'nextQuestion', 'restartQuiz']) {
    expect(module[name]).toEqual(expect.any(Function));
  }
  return module;
}

async function loadApp() {
  const module = await importFresh(APP_PATH);
  expect(module.mountQuiz).toEqual(expect.any(Function));
  return module;
}

function start(engine, questions = questionsFixture()) {
  const result = engine.createQuiz(questions);
  expect(result.ok).toBe(true);
  return result.state;
}

function click(window, element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

it('creating a quiz validates and clones the question model', async () => {
  const engine = await loadEngine();
  const questions = questionsFixture();
  const result = engine.createQuiz(questions);

  expect(result).toMatchObject({
    ok: true,
    state: {
      currentIndex: 0,
      selectedAnswerId: null,
      answers: [],
      score: 0,
      status: 'answering',
    },
  });
  expect(result.state.questions).toEqual(questions);
  expect(result.state.questions).not.toBe(questions);
  expect(result.state.questions[0]).not.toBe(questions[0]);
  expect(result.state.questions[0].answers).not.toBe(questions[0].answers);

  for (const invalid of [[], null, [{ id: 'broken', text: '', answers: [], correctAnswerId: 'x' }]]) {
    const invalidResult = engine.createQuiz(invalid);
    expect(invalidResult.ok).toBe(false);
    expect(invalidResult.message).toEqual(expect.any(String));
  }
});

it('selecting an answer updates state immutably and rejects unknown answers', async () => {
  const engine = await loadEngine();
  const state = start(engine);
  const before = JSON.stringify(state);
  const selected = engine.selectAnswer(state, 'tree');

  expect(selected).toMatchObject({ ok: true, state: { selectedAnswerId: 'tree', status: 'answering' } });
  expect(selected.state).not.toBe(state);
  expect(JSON.stringify(state)).toBe(before);
  expect(engine.selectAnswer(state, 'missing')).toMatchObject({ ok: false });
});

it('submitting locks the answer and awards each question at most once', async () => {
  const engine = await loadEngine();
  const initial = start(engine);
  const selected = engine.selectAnswer(initial, 'tree').state;
  const submitted = engine.submitAnswer(selected);

  expect(submitted).toMatchObject({
    ok: true,
    state: {
      status: 'review',
      score: 1,
      answers: [{ questionId: 'dom', answerId: 'tree', isCorrect: true }],
    },
  });
  expect(engine.submitAnswer(submitted.state)).toMatchObject({ ok: false });
  expect(engine.selectAnswer(submitted.state, 'database')).toMatchObject({ ok: false });
});

it('next question advances the flow and completes the final question', async () => {
  const engine = await loadEngine();
  let state = start(engine);
  state = engine.selectAnswer(state, 'tree').state;
  state = engine.submitAnswer(state).state;
  state = engine.nextQuestion(state).state;

  expect(state).toMatchObject({ currentIndex: 1, selectedAnswerId: null, status: 'answering', score: 1 });

  state = engine.selectAnswer(state, 'query').state;
  state = engine.submitAnswer(state).state;
  const completed = engine.nextQuestion(state);
  expect(completed).toMatchObject({ ok: true, state: { status: 'completed', score: 1 } });
  expect(engine.nextQuestion(completed.state)).toMatchObject({ ok: false });
});

it('restarting produces a clean independent quiz state', async () => {
  const engine = await loadEngine();
  let state = start(engine);
  state = engine.selectAnswer(state, 'tree').state;
  state = engine.submitAnswer(state).state;
  const restarted = engine.restartQuiz(state);

  expect(restarted).toMatchObject({
    ok: true,
    state: { currentIndex: 0, selectedAnswerId: null, answers: [], score: 0, status: 'answering' },
  });
  expect(restarted.state.questions).toEqual(state.questions);
  expect(restarted.state.questions).not.toBe(state.questions);
  expect(restarted.state.questions[0].answers).not.toBe(state.questions[0].answers);
});

it('mounting renders the first question answers and progress accessibly', async () => {
  const { mountQuiz } = await loadApp();
  const dom = new JSDOM('<main id="quiz"></main>');
  const root = dom.window.document.querySelector('#quiz');
  const result = mountQuiz(root, questionsFixture());

  expect(result.ok).toBe(true);
  expect(root.querySelector('[data-quiz-progress]').textContent).toContain('1 / 2');
  expect(root.querySelector('h1, h2').textContent).toContain('What does the DOM represent?');
  expect(root.querySelectorAll('button[data-answer-id]')).toHaveLength(2);
  expect(root.querySelector('[role="radiogroup"]')).not.toBeNull();
  expect(root.querySelector('button[data-action="submit"]').disabled).toBe(true);
});

it('the browser flow selects submits advances and renders final results', async () => {
  const { mountQuiz } = await loadApp();
  const dom = new JSDOM('<main id="quiz"></main>');
  const root = dom.window.document.querySelector('#quiz');
  mountQuiz(root, questionsFixture());

  click(dom.window, root.querySelector('[data-answer-id="tree"]'));
  expect(root.querySelector('[data-answer-id="tree"]').getAttribute('aria-checked')).toBe('true');
  click(dom.window, root.querySelector('[data-action="submit"]'));
  expect(root.querySelector('[role="status"]').textContent).toMatch(/correct/i);
  expect([...root.querySelectorAll('[data-answer-id]')].every((button) => button.disabled)).toBe(true);
  click(dom.window, root.querySelector('[data-action="next"]'));

  expect(root.querySelector('[data-quiz-progress]').textContent).toContain('2 / 2');
  click(dom.window, root.querySelector('[data-answer-id="query"]'));
  click(dom.window, root.querySelector('[data-action="submit"]'));
  click(dom.window, root.querySelector('[data-action="next"]'));

  expect(root.textContent).toMatch(/quiz complete/i);
  expect(root.querySelector('[data-quiz-score]').textContent).toContain('1 / 2');
  expect(root.querySelector('[data-action="restart"]')).not.toBeNull();
  click(dom.window, root.querySelector('[data-action="restart"]'));
  expect(root.querySelector('[data-quiz-progress]').textContent).toContain('1 / 2');
});

it('invalid quiz data renders an accessible error without throwing', async () => {
  const { mountQuiz } = await loadApp();
  const dom = new JSDOM('<main id="quiz"></main>');
  const root = dom.window.document.querySelector('#quiz');
  let result;

  expect(() => { result = mountQuiz(root, [{ id: 'broken' }]); }).not.toThrow();
  expect(result).toMatchObject({ ok: false });
  expect(root.querySelector('[role="alert"]')).not.toBeNull();
  expect(root.querySelector('[role="alert"]').textContent.trim().length).toBeGreaterThan(0);
});
