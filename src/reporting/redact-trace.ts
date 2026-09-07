import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const MASK = '***';
const MIN_SECRET_LENGTH = 8;

/**
 * Where a trace of this application stores credentials: request bodies (`password`),
 * responses (`token`), the Authorization header of every request, the storage state
 * of the browser context (`jwtToken`), and a password typed into a form. Each pattern
 * captures the value.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /"password"\s*:\s*"([^"]+)"/g,
  /"token"\s*:\s*"([^"]+)"/g,
  /"name"\s*:\s*"authorization"\s*,\s*"value"\s*:\s*"Token ([^"]+)"/gi,
  /"name"\s*:\s*"jwtToken"\s*,\s*"value"\s*:\s*"([^"]+)"/g,
  // A password typed into a form that was never submitted: the fill action keeps it in its
  // parameters, and the DOM snapshot taken after the action keeps it in an attribute.
  /"selector":"(?:[^"\\]|\\.)*password(?:[^"\\]|\\.)*"\s*,\s*"value":"((?:[^"\\]|\\.)+)"/gi,
  /<input\b(?=[^>]*type="password")[^>]*__playwright_value_="([^"]+)"/g,
];

/** First pass: every secret value the patterns find in the texts, plus the known ones. */
export function collectSecrets(texts: Iterable<string>, known: Iterable<string> = []): Set<string> {
  const secrets = new Set<string>();
  for (const value of known) {
    if (value.length >= MIN_SECRET_LENGTH) secrets.add(value);
  }
  for (const text of texts) {
    for (const pattern of SECRET_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        const value = match[1];
        if (value.length >= MIN_SECRET_LENGTH) secrets.add(value);
      }
    }
  }
  return secrets;
}

/** Second pass: every occurrence of every secret value becomes the mask, wherever it sits. */
export function maskValues(
  text: string,
  secrets: ReadonlySet<string>,
): { text: string; hits: number } {
  let result = text;
  let hits = 0;
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    const parts = result.split(secret);
    hits += parts.length - 1;
    result = parts.join(MASK);
  }
  return { text: result, hits };
}

/** Screenshots and other binaries carry a NUL byte early; text entries never do. */
function isBinary(bytes: Uint8Array): boolean {
  return bytes.subarray(0, 1024).includes(0);
}

/**
 * Rewrites a trace archive in place: secrets are collected from all of its text entries
 * (a password sits in a request body, but resurfaces in the `fill` action and in DOM
 * snapshots), then masked in all of them. Returns the number of replacements and the
 * secrets, so the caller can apply them to files outside the archive.
 */
export function redactTraceZip(
  zipPath: string,
  known: ReadonlySet<string>,
): { hits: number; secrets: Set<string> } {
  const entries = unzipSync(readFileSync(zipPath));
  const texts = new Map<string, string>();
  for (const [name, bytes] of Object.entries(entries)) {
    if (!isBinary(bytes)) texts.set(name, strFromU8(bytes));
  }
  const secrets = collectSecrets(texts.values(), known);
  let hits = 0;
  for (const [name, text] of texts) {
    const masked = maskValues(text, secrets);
    if (masked.hits === 0) continue;
    hits += masked.hits;
    entries[name] = strToU8(masked.text);
  }
  if (hits > 0) {
    const draft = `${zipPath}.redacting`;
    writeFileSync(draft, zipSync(entries));
    renameSync(draft, zipPath);
  }
  return { hits, secrets };
}

/** Masks the given secrets in a plain text file, such as the aria snapshot of a failed test. */
export function redactTextFile(filePath: string, secrets: ReadonlySet<string>): number {
  const masked = maskValues(readFileSync(filePath, 'utf8'), secrets);
  if (masked.hits > 0) writeFileSync(filePath, masked.text);
  return masked.hits;
}
