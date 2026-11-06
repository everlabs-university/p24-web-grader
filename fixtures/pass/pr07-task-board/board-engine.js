const STATUSES = new Set(['backlog', 'doing', 'done']);
const PRIORITIES = new Set(['low', 'medium', 'high']);
const FILTERS = new Set(['all', ...STATUSES]);
const fail = (message) => ({ ok: false, message });
const ok = (state) => ({ ok: true, state });
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

function validTask(task) {
  return task && typeof task === 'object' && !Array.isArray(task)
    && nonEmpty(task.id) && nonEmpty(task.title)
    && PRIORITIES.has(task.priority) && STATUSES.has(task.status);
}

function normalizeTask(task) {
  return { id: task.id.trim(), title: task.title.trim(), priority: task.priority, status: task.status };
}

function validTasks(tasks) {
  if (!Array.isArray(tasks)) return false;
  const ids = new Set();
  const titles = new Set();
  for (const task of tasks) {
    if (!validTask(task)) return false;
    const id = task.id.trim();
    const title = task.title.trim().toLowerCase();
    if (ids.has(id) || titles.has(title)) return false;
    ids.add(id);
    titles.add(title);
  }
  return true;
}

export function createBoard(tasks) {
  if (!validTasks(tasks)) return fail('Tasks are invalid.');
  return ok({ tasks: tasks.map(normalizeTask), query: '', filter: 'all' });
}

export function updateBoard(state, action) {
  if (!validTasks(state?.tasks) || typeof state.query !== 'string' || !FILTERS.has(state.filter) || !action || typeof action !== 'object') return fail('Board state or action is invalid.');
  if (action.type === 'ADD_TASK') {
    if (!validTask(action.task)) return fail('Task is invalid.');
    const task = normalizeTask(action.task);
    if (state.tasks.some((entry) => entry.id === task.id || entry.title.toLowerCase() === task.title.toLowerCase())) return fail('Task already exists.');
    return ok({ ...state, tasks: [...state.tasks, task] });
  }
  if (action.type === 'MOVE_TASK') {
    if (!nonEmpty(action.taskId) || !STATUSES.has(action.status) || !state.tasks.some(({ id }) => id === action.taskId)) return fail('Move is invalid.');
    return ok({ ...state, tasks: state.tasks.map((task) => task.id === action.taskId ? { ...task, status: action.status } : task) });
  }
  if (action.type === 'REMOVE_TASK') {
    if (!nonEmpty(action.taskId) || !state.tasks.some(({ id }) => id === action.taskId)) return fail('Task does not exist.');
    return ok({ ...state, tasks: state.tasks.filter(({ id }) => id !== action.taskId) });
  }
  if (action.type === 'SET_QUERY') {
    if (typeof action.query !== 'string') return fail('Query is invalid.');
    return ok({ ...state, query: action.query.trim() });
  }
  if (action.type === 'SET_FILTER') {
    if (!FILTERS.has(action.filter)) return fail('Filter is invalid.');
    return ok({ ...state, filter: action.filter });
  }
  return fail('Unknown action.');
}

export function selectVisibleTasks(state) {
  if (!validTasks(state?.tasks) || typeof state.query !== 'string' || !FILTERS.has(state.filter)) return fail('Board state is invalid.');
  const query = state.query.trim().toLowerCase();
  return {
    ok: true,
    tasks: state.tasks.filter((task) => (!query || task.title.toLowerCase().includes(query)) && (state.filter === 'all' || task.status === state.filter)).map((task) => ({ ...task })),
  };
}

export function serializeBoard(state) {
  if (!validTasks(state?.tasks)) return fail('Board state is invalid.');
  return { ok: true, value: JSON.stringify({ tasks: state.tasks.map((task) => ({ ...task })) }) };
}

export function restoreBoard(serialized, fallbackTasks = []) {
  if (serialized === null || serialized === undefined || serialized === '') return createBoard(fallbackTasks);
  if (typeof serialized !== 'string') return fail('Stored board is invalid.');
  try {
    const parsed = JSON.parse(serialized);
    return createBoard(parsed?.tasks);
  } catch {
    return fail('Stored board is invalid.');
  }
}
