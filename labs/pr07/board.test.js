import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';

const ENGINE_PATH = resolve(process.cwd(), 'pr07-task-board', 'board-engine.js');
const APP_PATH = resolve(process.cwd(), 'pr07-task-board', 'board-app.js');
let importSequence = 0;

const tasksFixture = () => [
  { id: 'alpha', title: 'Design state model', priority: 'high', status: 'backlog' },
  { id: 'beta', title: 'Render board columns', priority: 'medium', status: 'doing' },
  { id: 'gamma', title: 'Ship accessible shell', priority: 'low', status: 'done' },
];

async function importFresh(filePath) {
  const url = pathToFileURL(filePath);
  url.searchParams.set('test', String(importSequence += 1));
  return import(url.href);
}

async function loadEngine() {
  const module = await importFresh(ENGINE_PATH);
  for (const name of ['createBoard', 'updateBoard', 'selectVisibleTasks', 'serializeBoard', 'restoreBoard']) {
    expect(module[name]).toEqual(expect.any(Function));
  }
  return module;
}

async function loadApp() {
  const module = await importFresh(APP_PATH);
  expect(module.mountTaskBoard).toEqual(expect.any(Function));
  return module;
}

function start(engine, tasks = tasksFixture()) {
  const result = engine.createBoard(tasks);
  expect(result.ok).toBe(true);
  return result.state;
}

function memoryStorage(value = null) {
  let stored = value;
  return {
    getItem: () => stored,
    setItem: (_key, next) => { stored = next; },
    removeItem: () => { stored = null; },
    read: () => stored,
  };
}

it('creating a board validates clones and normalizes the initial state', async () => {
  const engine = await loadEngine();
  const tasks = tasksFixture();
  const result = engine.createBoard(tasks);

  expect(result).toMatchObject({ ok: true, state: { query: '', filter: 'all', tasks } });
  expect(result.state.tasks).not.toBe(tasks);
  expect(result.state.tasks[0]).not.toBe(tasks[0]);
  expect(engine.createBoard([])).toMatchObject({ ok: true, state: { tasks: [] } });
  for (const invalid of [null, [{ id: '', title: 'Broken', priority: 'high', status: 'backlog' }], [tasks[0], { ...tasks[1], id: 'alpha' }]]) {
    expect(engine.createBoard(invalid)).toMatchObject({ ok: false });
  }
});

it('adding a task is immutable and rejects duplicate or malformed tasks', async () => {
  const engine = await loadEngine();
  const state = start(engine);
  const before = JSON.stringify(state);
  const task = { id: 'delta', title: '  Persist the board  ', priority: 'high', status: 'backlog' };
  const added = engine.updateBoard(state, { type: 'ADD_TASK', task });

  expect(added).toMatchObject({ ok: true, state: { tasks: [...state.tasks, { ...task, title: 'Persist the board' }] } });
  expect(added.state.tasks).not.toBe(state.tasks);
  expect(JSON.stringify(state)).toBe(before);
  expect(engine.updateBoard(state, { type: 'ADD_TASK', task: { ...task, id: 'alpha' } })).toMatchObject({ ok: false });
  expect(engine.updateBoard(state, { type: 'ADD_TASK', task: { ...task, title: '   ' } })).toMatchObject({ ok: false });
});

it('moving and removing tasks enforce valid transitions without mutation', async () => {
  const engine = await loadEngine();
  const state = start(engine);
  const moved = engine.updateBoard(state, { type: 'MOVE_TASK', taskId: 'alpha', status: 'doing' });

  expect(moved).toMatchObject({ ok: true, state: { tasks: [{ ...state.tasks[0], status: 'doing' }, state.tasks[1], state.tasks[2]] } });
  expect(state.tasks[0].status).toBe('backlog');
  const removed = engine.updateBoard(moved.state, { type: 'REMOVE_TASK', taskId: 'beta' });
  expect(removed.state.tasks.map(({ id }) => id)).toEqual(['alpha', 'gamma']);
  expect(engine.updateBoard(state, { type: 'MOVE_TASK', taskId: 'missing', status: 'done' })).toMatchObject({ ok: false });
  expect(engine.updateBoard(state, { type: 'REMOVE_TASK', taskId: 'missing' })).toMatchObject({ ok: false });
  expect(engine.updateBoard(state, { type: 'UNKNOWN' })).toMatchObject({ ok: false });
});

it('visible tasks derive from query and status without changing source order', async () => {
  const engine = await loadEngine();
  let state = start(engine);
  const before = JSON.stringify(state.tasks);
  state = engine.updateBoard(state, { type: 'SET_QUERY', query: '  board ' }).state;
  state = engine.updateBoard(state, { type: 'SET_FILTER', filter: 'doing' }).state;
  const selected = engine.selectVisibleTasks(state);

  expect(selected).toMatchObject({ ok: true, tasks: [tasksFixture()[1]] });
  expect(JSON.stringify(state.tasks)).toBe(before);
  expect(engine.updateBoard(state, { type: 'SET_FILTER', filter: 'missing' })).toMatchObject({ ok: false });
});

it('serializing and restoring the board preserves durable state safely', async () => {
  const engine = await loadEngine();
  let state = start(engine);
  state = engine.updateBoard(state, { type: 'SET_QUERY', query: 'state' }).state;
  state = engine.updateBoard(state, { type: 'SET_FILTER', filter: 'backlog' }).state;
  const serialized = engine.serializeBoard(state);
  const restored = engine.restoreBoard(serialized.value, []);

  expect(serialized.ok).toBe(true);
  expect(JSON.parse(serialized.value)).toEqual({ tasks: tasksFixture() });
  expect(restored).toMatchObject({ ok: true, state: { tasks: tasksFixture(), query: '', filter: 'all' } });
  expect(restored.state.tasks).not.toBe(state.tasks);
  expect(engine.restoreBoard(null, tasksFixture())).toMatchObject({ ok: true, state: { tasks: tasksFixture() } });
  expect(engine.restoreBoard('{broken', tasksFixture())).toMatchObject({ ok: false });
  expect(engine.restoreBoard('{"tasks":"nope"}', tasksFixture())).toMatchObject({ ok: false });
});

it('mounting renders an accessible board with columns counts and controls', async () => {
  const { mountTaskBoard } = await loadApp();
  const dom = new JSDOM('<main id="board"></main>');
  const root = dom.window.document.querySelector('#board');
  const result = mountTaskBoard(root, { initialTasks: tasksFixture(), storage: memoryStorage() });

  expect(result.ok).toBe(true);
  expect(root.querySelector('form')).not.toBeNull();
  expect(root.querySelector('[name="title"]')).not.toBeNull();
  expect(root.querySelector('[name="priority"]')).not.toBeNull();
  expect(root.querySelector('[name="query"]')).not.toBeNull();
  expect(root.querySelector('[name="filter"]')).not.toBeNull();
  expect(root.querySelectorAll('[data-board-column]')).toHaveLength(3);
  expect(root.querySelectorAll('[data-task-id]')).toHaveLength(3);
  expect(root.textContent).toMatch(/backlog/i);
  expect(root.textContent).toMatch(/in progress|doing/i);
  expect(root.textContent).toMatch(/done/i);
});

it('the browser flow adds moves filters and removes a task', async () => {
  const { mountTaskBoard } = await loadApp();
  const dom = new JSDOM('<main id="board"></main>');
  const root = dom.window.document.querySelector('#board');
  const storage = memoryStorage();
  mountTaskBoard(root, { initialTasks: tasksFixture(), storage });

  const title = root.querySelector('[name="title"]');
  const priority = root.querySelector('[name="priority"]');
  title.value = 'Test persistence';
  priority.value = 'high';
  root.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  const added = [...root.querySelectorAll('[data-task-id]')].find((card) => card.textContent.includes('Test persistence'));
  expect(added).not.toBeUndefined();
  const taskId = added.dataset.taskId;
  added.querySelector('[data-action="move"][data-status="doing"]').click();
  expect(root.querySelector(`[data-board-column="doing"] [data-task-id="${taskId}"]`)).not.toBeNull();

  const query = root.querySelector('[name="query"]');
  query.value = 'persistence';
  query.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  expect(root.querySelectorAll('[data-task-id]')).toHaveLength(1);
  root.querySelector('[name="filter"]').value = 'doing';
  root.querySelector('[name="filter"]').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  expect(root.querySelectorAll('[data-task-id]')).toHaveLength(1);
  root.querySelector(`[data-task-id="${taskId}"] [data-action="remove"]`).click();
  expect(root.querySelector(`[data-task-id="${taskId}"]`)).toBeNull();
  expect(JSON.parse(storage.read()).tasks.some((task) => task.id === taskId)).toBe(false);
});

it('invalid initial or stored data renders a recoverable error state', async () => {
  const { mountTaskBoard } = await loadApp();
  const invalidDom = new JSDOM('<main id="board"></main>');
  const invalidRoot = invalidDom.window.document.querySelector('#board');
  expect(() => mountTaskBoard(invalidRoot, { initialTasks: [{ id: '' }], storage: memoryStorage() })).not.toThrow();
  expect(invalidRoot.querySelector('[role="alert"]')).not.toBeNull();

  const storedDom = new JSDOM('<main id="board"></main>');
  const storedRoot = storedDom.window.document.querySelector('#board');
  const recovered = mountTaskBoard(storedRoot, { initialTasks: tasksFixture(), storage: memoryStorage('{broken') });
  expect(recovered.ok).toBe(true);
  expect(storedRoot.querySelector('[role="status"], [role="alert"]')).not.toBeNull();
  expect(storedRoot.querySelectorAll('[data-task-id]')).toHaveLength(3);
});
