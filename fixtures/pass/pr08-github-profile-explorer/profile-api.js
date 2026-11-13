const USERNAME_PATTERN = /^(?!-)(?!.*--)[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/;

function failure(kind, message) {
  return { ok: false, kind, message };
}

export function normalizeUsername(value) {
  if (typeof value !== 'string') return failure('invalid-input', 'Enter a valid GitHub username.');
  const normalized = value.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalized)) {
    return failure('invalid-input', 'Enter a valid GitHub username.');
  }
  return { ok: true, value: normalized };
}

export function mapGitHubProfile(payload) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return failure('validation', 'GitHub returned invalid profile data.');
  }

  const strings = ['login', 'avatar_url', 'html_url'];
  const numbers = ['followers', 'following', 'public_repos'];
  if (
    strings.some((key) => typeof payload[key] !== 'string' || payload[key].trim() === '') ||
    numbers.some((key) => !Number.isInteger(payload[key]) || payload[key] < 0) ||
    !(payload.name === null || typeof payload.name === 'string') ||
    !(payload.bio === null || typeof payload.bio === 'string')
  ) {
    return failure('validation', 'GitHub returned invalid profile data.');
  }

  return {
    ok: true,
    profile: {
      login: payload.login,
      name: payload.name?.trim() || payload.login,
      bio: payload.bio?.trim() || '',
      avatarUrl: payload.avatar_url,
      profileUrl: payload.html_url,
      followers: payload.followers,
      following: payload.following,
      publicRepos: payload.public_repos,
    },
  };
}

export async function fetchGitHubProfile(username, { signal, fetchImpl = globalThis.fetch } = {}) {
  const normalized = normalizeUsername(username);
  if (!normalized.ok) return normalized;
  if (typeof fetchImpl !== 'function') return failure('network', 'The network request is unavailable.');

  let response;
  try {
    response = await fetchImpl(
      `https://api.github.com/users/${encodeURIComponent(normalized.value)}`,
      { signal, headers: { Accept: 'application/vnd.github+json' } },
    );
  } catch (error) {
    if (error?.name === 'AbortError') return failure('aborted', 'The request was cancelled.');
    return failure('network', 'Could not connect to GitHub.');
  }

  if (!response?.ok) {
    if (response?.status === 404) return failure('not-found', 'Profile not found.');
    if (response?.status === 403 || response?.status === 429) {
      return failure('rate-limit', 'GitHub rate limit reached. Try again later.');
    }
    return failure('http', `GitHub request failed with status ${response?.status ?? 'unknown'}.`);
  }

  try {
    return mapGitHubProfile(await response.json());
  } catch {
    return failure('validation', 'GitHub returned invalid profile data.');
  }
}
