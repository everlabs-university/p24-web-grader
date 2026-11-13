export function normalizeUsername() {
  return { ok: false, kind: 'invalid-input', message: 'Not implemented.' };
}

export function mapGitHubProfile() {
  return { ok: false, kind: 'validation', message: 'Not implemented.' };
}

export async function fetchGitHubProfile() {
  return { ok: false, kind: 'http', message: 'Not implemented.' };
}
