import { fetchGitHubProfile } from './profile-api.js';

function element(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeUrl(value, prefix) {
  return typeof value === 'string' && value.startsWith(prefix) ? value : '';
}

export function mountProfileExplorer(
  root,
  { requestProfile = fetchGitHubProfile, AbortControllerClass = globalThis.AbortController } = {},
) {
  if (!root?.ownerDocument || typeof root.replaceChildren !== 'function') {
    return { ok: false, message: 'A valid root element is required.' };
  }

  const document = root.ownerDocument;
  const form = element(document, 'form', 'search-form');
  const field = element(document, 'div', 'field');
  const label = element(document, 'label', '', 'GitHub username');
  const input = element(document, 'input');
  const button = element(document, 'button', '', 'Search profile');
  const panel = element(document, 'div', 'panel');
  const status = element(document, 'p', 'status', 'Enter a GitHub username to begin.');

  label.htmlFor = 'github-username';
  input.id = 'github-username';
  input.name = 'username';
  input.autocomplete = 'off';
  input.placeholder = 'octocat';
  button.type = 'submit';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  field.append(label, input);
  form.append(field, button);
  panel.append(status);
  root.replaceChildren(form, panel);

  let activeController = null;
  let requestNumber = 0;

  function renderMessage(message, kind = 'status') {
    const messageNode = element(document, 'p', 'status', message);
    messageNode.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    messageNode.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
    panel.replaceChildren(messageNode);
  }

  function renderProfile(profile) {
    const article = element(document, 'article', 'profile');
    const avatar = element(document, 'img');
    const content = element(document, 'div');
    const heading = element(document, 'h2', '', profile.name);
    const login = element(document, 'p', 'login', `@${profile.login}`);
    const bio = element(document, 'p', 'bio', profile.bio || 'No public bio.');
    const metrics = element(document, 'ul', 'metrics');
    const link = element(document, 'a', 'profile-link', 'Open GitHub profile');

    avatar.src = safeUrl(profile.avatarUrl, 'https://') || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    avatar.alt = `${profile.login} avatar`;
    for (const [label, value] of [
      ['Repositories', profile.publicRepos],
      ['Followers', profile.followers],
      ['Following', profile.following],
    ]) {
      const item = element(document, 'li');
      const strong = element(document, 'strong', '', Number(value).toLocaleString('en-US'));
      item.append(strong, ` ${label}`);
      metrics.append(item);
    }
    link.href = safeUrl(profile.profileUrl, 'https://github.com/') || 'https://github.com/';
    link.target = '_blank';
    link.rel = 'noreferrer';
    content.append(heading, login, bio, metrics, link);
    article.append(avatar, content);
    panel.replaceChildren(article);
  }

  async function onSubmit(event) {
    event.preventDefault();
    const username = input.value.trim();
    if (!username) {
      renderMessage('Enter a GitHub username.', 'error');
      input.focus();
      return;
    }

    activeController?.abort();
    activeController = typeof AbortControllerClass === 'function'
      ? new AbortControllerClass()
      : { signal: { aborted: false }, abort() { this.signal.aborted = true; } };
    const currentRequest = ++requestNumber;
    button.disabled = true;
    renderMessage(`Searching for ${username}…`);

    let result;
    try {
      result = await requestProfile(username, { signal: activeController.signal });
    } catch {
      result = { ok: false, kind: 'network', message: 'Could not complete the request.' };
    }

    if (currentRequest !== requestNumber) return;
    button.disabled = false;
    if (result?.ok) renderProfile(result.profile);
    else if (result?.kind !== 'aborted') renderMessage(result?.message || 'Could not load the profile.', 'error');
  }

  form.addEventListener('submit', onSubmit);

  return {
    ok: true,
    destroy() {
      requestNumber += 1;
      activeController?.abort();
      form.removeEventListener('submit', onSubmit);
      root.replaceChildren();
    },
  };
}
