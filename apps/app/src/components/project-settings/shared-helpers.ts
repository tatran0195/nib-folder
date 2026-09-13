import type { MessageKey } from '@nibleaf/i18n';
import { translateFn } from '@nibleaf/i18n/react';
import type { ProjectConfigUpdate } from '@nibleaf/validators';
import { toast } from 'sonner';

export type ConfigMutation = {
  mutate: (vars: { config: ProjectConfigUpdate }, opts?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => void;
};

const localizedFn = (key: MessageKey): string => translateFn(key);

/**
 * Wraps `useUpdateProjectConfig(...).mutate` in a promise + toast so a TanStack
 * Form `onSubmit` can `await` it. The server deep-merges section-level config,
 * so callers pass just the one section they own (e.g. `{ footer: {...} }`).
 */
export function saveConfigSection(update: ConfigMutation, config: ProjectConfigUpdate) {
  return new Promise<void>((resolve) => {
    update.mutate(
      { config },
      {
        onSuccess: () => {
          toast.success(localizedFn('common.saved'));
          resolve();
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : localizedFn('settings.saveError'));
          resolve();
        },
      },
    );
  });
}

/**
 * Canonical ordering for every language list in the settings surfaces:
 * the default language first, then the configured position.
 */
export function sortLanguagesDefaultFirst<T extends { isDefault: boolean; position: number }>(languages: T[]): T[] {
  return [...languages].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.position - b.position);
}

/** Shared input styling tokens. */
export const FIELD_INPUT = 'text-sm';
export const FIELD_MONO = 'font-mono text-sm';
export const FIELD_TEXTAREA = 'min-h-[84px] text-sm';
export const FIELD_COMPACT = '[--control-size-default:var(--control-size-compact)] rounded-md bg-background text-[13px]';
export const FIELD_COMPACT_MONO = '[--control-size-default:var(--control-size-compact)] rounded-md bg-background font-mono text-[13px]';
