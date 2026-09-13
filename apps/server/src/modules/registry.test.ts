import { describe, expect, it } from 'vitest';
import { getRegisteredModules } from './registry';

describe('Nibleaf Module Registry', () => {
  it('registers all core domain modules with required metadata', () => {
    const modules = getRegisteredModules();
    expect(modules.length).toBeGreaterThanOrEqual(20);

    const keys = new Set<string>();
    for (const mod of modules) {
      expect(mod.key).toBeTruthy();
      expect(mod.title).toBeTruthy();
      expect(mod.description).toBeTruthy();
      expect(keys.has(mod.key)).toBe(false);
      keys.add(mod.key);
    }

    expect(keys.has('projects')).toBe(true);
    expect(keys.has('pages')).toBe(true);
    expect(keys.has('deployments')).toBe(true);
    expect(keys.has('domains')).toBe(true);
    expect(keys.has('branches')).toBe(true);
    expect(keys.has('exports')).toBe(true);
    expect(keys.has('openapi')).toBe(true);
    expect(keys.has('git')).toBe(true);
    expect(keys.has('public')).toBe(true);
    expect(keys.has('admin')).toBe(true);
    expect(keys.has('mcp')).toBe(true);
  });
});
