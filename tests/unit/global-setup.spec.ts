import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { clearDirectory } from '../../src/config/global-setup';

function scratch(): string {
  return mkdtempSync(path.join(tmpdir(), 'clear-dir-'));
}

test.describe('Directory cleanup', () => {
  test('removes the entries but keeps the directory itself', () => {
    const parent = scratch();
    const target = path.join(parent, 'results');
    mkdirSync(path.join(target, 'nested'), { recursive: true });
    writeFileSync(path.join(target, 'one.json'), '{}');
    writeFileSync(path.join(target, 'nested', 'two.json'), '{}');

    clearDirectory(target);

    // The directory has to survive: in a container it is a mount point, and deleting one fails.
    expect(existsSync(target), 'the directory survives the cleanup').toBe(true);
    expect(readdirSync(target), 'nothing is left inside it').toEqual([]);
    rmSync(parent, { recursive: true, force: true });
  });

  test('creates the directory when it does not exist yet', () => {
    const parent = scratch();
    const target = path.join(parent, 'missing');

    clearDirectory(target);

    expect(existsSync(target), 'the directory is created').toBe(true);
    expect(readdirSync(target), 'and it is empty').toEqual([]);
    rmSync(parent, { recursive: true, force: true });
  });

  test('names the directory it could not empty', () => {
    const parent = scratch();
    const target = path.join(parent, 'a-file');
    writeFileSync(target, 'not a directory');

    expect(() => clearDirectory(target)).toThrow(/Cannot empty the directory ".*a-file"/);
    rmSync(parent, { recursive: true, force: true });
  });
});
