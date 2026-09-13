import { translateFn } from '@nibleaf/i18n/react';
import { describe, expect, it } from 'vitest';
import { SEARCH_RUNTIME_MESSAGE_KEYS } from './integration-config-values';

describe('integration configuration enum labels', () => {
  it('maps every persisted runtime mode to localized copy', () => {
    expect(Object.keys(SEARCH_RUNTIME_MESSAGE_KEYS)).toEqual(['legacy', 'shadow', 'hybrid']);

    for (const [raw, key] of Object.entries(SEARCH_RUNTIME_MESSAGE_KEYS)) {
      expect(translateFn(key, undefined, 'ar')).not.toBe(raw);
      expect(translateFn(key, undefined, 'ar')).not.toContain('_');
    }
  });
});
