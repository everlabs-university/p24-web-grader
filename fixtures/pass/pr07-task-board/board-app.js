import { createBoard, restoreBoard, selectVisibleTasks, serializeBoard, updateBoard } from './board-engine.js';

const KEY = 'p24-task-board';
const columns = [
  ['backlog', 'Backlog'],
  ['doing', 'In progress'],
  ['done', 'Done'],
];
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function mountTaskBoard(root, { initialTasks = [], storage = globalThis.localStorage } = {}) {
  if (!root || typeof root.addEventListener !== 'function') return { ok: false, message: 'A valid root is required.' };
  const initial = createBoard(initialTasks);
  if (!initial.ok) {
    root.innerHTML = `<p role="alert">${escapeHtml(initial.message)}</p>`;
    return initial;
  }
  let notice = '';
  let restored;
  try {
    restored = restoreBoard(storage?.getItem?.(KEY) ?? null, initialTasks);
  } catch {
    restored = { ok: false, message: 'Storage is unavailable.' };
  }
  let state = restored.ok ? restored.state : initial.state;
  if (!restored.ok) notice = 'Saved data was ignored.';

  function persist() {
    const serialized = serializeBoard(state);
    if (!serialized.ok) return;
    try { storage?.setItem?.(KEY, serialized.value); } catch { notice = 'Changes could not be saved.'; }
  }

  function render() {
    const selected = selectVisibleTasks(state);
    const visible = selected.ok ? selected.tasks : [];
    root.innerHTML = `
      <form data-task-form>
        <label>Task title <input name="title" required></label>
        <label>Priority <select name="priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <button>Add task</button>
      </form>
      <div class="board-toolbar">
        <label>Search <input name="query" value="${escapeHtml(state.query)}"></label>
        <label>Status <select name="filter">${['all', ...columns.map(([id]) => id)].map((value) => `<option value="${value}" ${state.filter === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      </div>
      <p class="board-status" role="status">${escapeHtml(notice)}</p>
      <div class="board-columns">${columns.map(([status, label]) => {
        const tasks = visible.filter((task) => task.status === status);
        return `<section data-board-column="${status}" aria-labelledby="column-${status}"><h2 id="column-${status}">${label} <span>${tasks.length}</span></h2><div>${tasks.length ? tasks.map((task) => `<article data-task-id="${escapeHtml(task.id)}" data-priority="${task.priority}"><p>${escapeHtml(task.title)}</p><div>${columns.filter(([next]) => next !== task.status).map(([next, nextLabel]) => `<button type="button" data-action="move" data-status="${next}">Move to ${nextLabel}</button>`).join('')}<button type="button" data-action="remove">Remove</button></div></article>`).join('') : '<p class="empty">No matching tasks</p>'}</div></section>`;
      }).join('')}</div>`;
  }

  function dispatch(action, durable = false) {
    const result = updateBoard(state, action);
    if (!result.ok) { notice = result.message; render(); return false; }
    state = result.state;
    notice = '';
    if (durable) persist();
    render();
    return true;
  }

  let sequence = state.tasks.length;
  root.addEventListener('submit', (event) => {
    const form = event.target.closest?.('form');
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    sequence += 1;
    const title = form.elements.title.value;
    const priority = form.elements.priority.value;
    if (dispatch({ type: 'ADD_TASK', task: { id: `task-${Date.now()}-${sequence}`, title, priority, status: 'backlog' } }, true)) form.reset();
  });
  root.addEventListener('input', (event) => {
    if (event.target.name === 'query') dispatch({ type: 'SET_QUERY', query: event.target.value });
  });
  root.addEventListener('change', (event) => {
    if (event.target.name === 'filter') dispatch({ type: 'SET_FILTER', filter: event.target.value });
  });
  root.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-action]');
    const card = button?.closest?.('[data-task-id]');
    if (!button || !card || !root.contains(button)) return;
    if (button.dataset.action === 'move') dispatch({ type: 'MOVE_TASK', taskId: card.dataset.taskId, status: button.dataset.status }, true);
    if (button.dataset.action === 'remove') dispatch({ type: 'REMOVE_TASK', taskId: card.dataset.taskId }, true);
  });
  render();
  return { ok: true, getState: () => state };
}
