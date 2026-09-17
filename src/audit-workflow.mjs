import { createHash } from 'node:crypto';

const HASH_ALGORITHM = 'sha256';

function auditError(message) {
  const error = new Error(message);
  error.code = 'ERR_AUDIT_INPUT';
  return error;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(value) {
  return JSON.stringify(value) ?? String(value);
}

function toUtf8Bytes(value, field) {
  if (typeof value !== 'string') {
    throw auditError(`${field} must be a string containing the workflow text, received ${formatValue(value)}.`);
  }
  return Buffer.from(value, 'utf8');
}

function sha256Hex(bytes) {
  return createHash(HASH_ALGORITHM).update(bytes).digest('hex');
}

export function auditWorkflow(input) {
  if (!isPlainObject(input)) {
    throw auditError(`The auditWorkflow argument must be an object {candidateText, canonicalText}, received ${formatValue(input)}.`);
  }
  const candidateBytes = toUtf8Bytes(input.candidateText, 'candidateText');
  const canonicalBytes = toUtf8Bytes(input.canonicalText, 'canonicalText');
  return {
    valid: candidateBytes.equals(canonicalBytes),
    candidateSha256: sha256Hex(candidateBytes),
    canonicalSha256: sha256Hex(canonicalBytes),
  };
}
