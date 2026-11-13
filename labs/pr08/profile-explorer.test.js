import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';

const API_PATH = resolve(process.cwd(), 'pr08-github-profile-explorer', 'profile-api.js');
const APP_PATH = resolve(process.cwd(), 'pr08-github-profile-explorer', 'profile-app.js');
let importSequence = 0;

async function importFresh(filePath) {
  const url = pathToFileURL(filePath);
  url.searchParams.set('test', String(importSequence += 1));
  return import(url.href);
}

async function loadApi() {
  const module = await importFresh(API_PATH);
  for (const name of ['normalizeUsername', 'mapGitHubProfile', 'fetchGitHubProfile']) {
    expect(module[name]).toEqual(expect.any(Function));
  }
  return module;
}

async function loadApp() {
  const module = await importFresh(APP_PATH);
  expect(module.mountProfileExplorer).toEqual(expect.any(Function));
  return module;
}

const payload = (overrides = {}) => ({
  login: 'octocat',
  name: 'The Octocat',
  bio: 'GitHub mascot',
  avatar_url: 'https://avatars.githubusercontent.com/u/583231',
  html_url: 'https://github.com/octocat',
  followers: 12000,
  following: 9,
  public_repos: 8,
  ...overrides,
});

const profile = (overrides = {}) => ({
  login: 'octocat',
  name: 'The Octocat',
  bio: 'GitHub mascot',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
  profileUrl: 'https://github.com/octocat',
  followers: 12000,
  following: 9,
  publicRepos: 8,
  ...overrides,
});

const flush = () => new Promise((resolvePromise) => setTimeout(resolvePromise, 0));

function submit(dom, root, value) {
  const input = root.querySelector('[name="username"]');
  input.value = value;
  root.querySelector('form').dispatchEvent(
    new dom.window.Event('submit', { bubbles: true, cancelable: true }),
  );
}

it('normalizes valid GitHub usernames and rejects invalid input without throwing', async () => {
  const api = await loadApi();

  expect(api.normalizeUsername('  Octo-Cat  ')).toEqual({ ok: true, value: 'octo-cat' });
  for (const invalid of ['', '   ', '-octocat', 'octocat-', 'two words', 'a'.repeat(40), null]) {
    expect(() => api.normalizeUsername(invalid)).not.toThrow();
    expect(api.normalizeUsername(invalid)).toMatchObject({ ok: false });
  }
});

it('maps a valid GitHub payload to the documented profile model', async () => {
  const api = await loadApi();

  expect(api.mapGitHubProfile(payload())).toEqual({ ok: true, profile: profile() });
  expect(api.mapGitHubProfile(payload({ name: null, bio: null }))).toMatchObject({
    ok: true,
    profile: { name: 'octocat', bio: '' },
  });
  for (const invalid of [null, {}, payload({ login: '' }), payload({ followers: 'many' })]) {
    expect(api.mapGitHubProfile(invalid)).toMatchObject({ ok: false });
  }
});

it('requests the encoded profile endpoint with JSON headers and cancellation support', async () => {
  const api = await loadApi();
  const signal = { aborted: false };
  const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => payload() }));
  const result = await api.fetchGitHubProfile(' OctoCat ', { signal, fetchImpl });

  expect(result).toEqual({ ok: true, profile: profile() });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const [url, options] = fetchImpl.mock.calls[0];
  expect(url).toBe('https://api.github.com/users/octocat');
  expect(options.signal).toBe(signal);
  expect(options.headers.Accept).toMatch(/github\+json/i);
});

it('turns HTTP network abort and malformed-response failures into result objects', async () => {
  const api = await loadApi();
  const response = (status) => ({ ok: false, status, json: async () => ({}) });

  await expect(api.fetchGitHubProfile('missing', { fetchImpl: async () => response(404) }))
    .resolves.toMatchObject({ ok: false, kind: 'not-found' });
  await expect(api.fetchGitHubProfile('limited', { fetchImpl: async () => response(403) }))
    .resolves.toMatchObject({ ok: false, kind: 'rate-limit' });
  await expect(api.fetchGitHubProfile('broken', { fetchImpl: async () => response(500) }))
    .resolves.toMatchObject({ ok: false, kind: 'http' });
  await expect(api.fetchGitHubProfile('offline', { fetchImpl: async () => { throw new TypeError('offline'); } }))
    .resolves.toMatchObject({ ok: false, kind: 'network' });
  await expect(api.fetchGitHubProfile('cancelled', { fetchImpl: async () => { throw new DOMException('cancelled', 'AbortError'); } }))
    .resolves.toMatchObject({ ok: false, kind: 'aborted' });
  await expect(api.fetchGitHubProfile('invalid', { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) }) }))
    .resolves.toMatchObject({ ok: false, kind: 'validation' });
});

it('mounts an accessible idle search interface', async () => {
  const { mountProfileExplorer } = await loadApp();
  const dom = new JSDOM('<main id="explorer"></main>');
  const root = dom.window.document.querySelector('#explorer');
  const result = mountProfileExplorer(root, { requestProfile: vi.fn() });

  expect(result).toMatchObject({ ok: true });
  expect(result.destroy).toEqual(expect.any(Function));
  expect(root.querySelector('form')).not.toBeNull();
  expect(root.querySelector('label[for]')).not.toBeNull();
  expect(root.querySelector('[name="username"]')).not.toBeNull();
  expect(root.querySelector('button[type="submit"]')).not.toBeNull();
  expect(root.querySelector('[role="status"][aria-live]')).not.toBeNull();
  expect(root.textContent).toMatch(/github/i);
});

it('renders loading and success states from one submitted search', async () => {
  const { mountProfileExplorer } = await loadApp();
  const dom = new JSDOM('<main id="explorer"></main>');
  const root = dom.window.document.querySelector('#explorer');
  let resolveRequest;
  const requestProfile = vi.fn(() => new Promise((resolvePromise) => { resolveRequest = resolvePromise; }));
  mountProfileExplorer(root, { requestProfile });

  submit(dom, root, 'octocat');
  expect(root.textContent).toMatch(/loading|searching/i);
  expect(root.querySelector('button[type="submit"]').disabled).toBe(true);
  resolveRequest({ ok: true, profile: profile({ name: '<img src=x onerror=alert(1)>' }) });
  await flush();

  expect(requestProfile).toHaveBeenCalledWith('octocat', expect.objectContaining({ signal: expect.anything() }));
  expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(root.querySelector('img[onerror]')).toBeNull();
  expect(root.querySelector('a[href="https://github.com/octocat"]')).not.toBeNull();
  expect(root.textContent).toMatch(/12,?000/);
  expect(root.querySelector('button[type="submit"]').disabled).toBe(false);
});

it('validates empty input and renders request errors without stale profile content', async () => {
  const { mountProfileExplorer } = await loadApp();
  const dom = new JSDOM('<main id="explorer"></main>');
  const root = dom.window.document.querySelector('#explorer');
  const requestProfile = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, profile: profile() })
    .mockResolvedValueOnce({ ok: false, kind: 'not-found', message: 'Profile not found.' });
  mountProfileExplorer(root, { requestProfile });

  submit(dom, root, '   ');
  expect(requestProfile).not.toHaveBeenCalled();
  expect(root.querySelector('[role="alert"]')).not.toBeNull();

  submit(dom, root, 'octocat');
  await flush();
  expect(root.textContent).toContain('The Octocat');
  submit(dom, root, 'missing-user');
  await flush();
  expect(root.querySelector('[role="alert"]')).not.toBeNull();
  expect(root.textContent).toMatch(/not found/i);
  expect(root.textContent).not.toContain('The Octocat');
});

it('aborts an older request and ignores its late response', async () => {
  const { mountProfileExplorer } = await loadApp();
  const dom = new JSDOM('<main id="explorer"></main>');
  const root = dom.window.document.querySelector('#explorer');
  const pending = [];
  const requestProfile = vi.fn((_username, { signal }) => new Promise((resolvePromise) => {
    pending.push({ resolve: resolvePromise, signal });
  }));
  mountProfileExplorer(root, { requestProfile });

  submit(dom, root, 'first-user');
  submit(dom, root, 'second-user');
  expect(pending[0].signal.aborted).toBe(true);
  pending[1].resolve({ ok: true, profile: profile({ login: 'second-user', name: 'Second result' }) });
  await flush();
  pending[0].resolve({ ok: true, profile: profile({ login: 'first-user', name: 'Stale result' }) });
  await flush();

  expect(root.textContent).toContain('Second result');
  expect(root.textContent).not.toContain('Stale result');
});
