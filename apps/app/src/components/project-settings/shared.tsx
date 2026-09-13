import { Button } from '@nibleaf/design-system/components/ui/button';
import { useConfirm } from '@nibleaf/design-system/components/ui/confirm';
import { Input } from '@nibleaf/design-system/components/ui/input';
import { SegmentedControl, SegmentedControlItem } from '@nibleaf/design-system/components/ui/segmented-control';
import { Slider } from '@nibleaf/design-system/components/ui/slider';
import { Switch } from '@nibleaf/design-system/components/ui/switch';
import { Textarea } from '@nibleaf/design-system/components/ui/textarea';
import { cn } from '@nibleaf/design-system/lib/utils';
import { useT } from '@nibleaf/i18n/react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode, useCallback, useEffect, useId, useRef } from 'react';

/**
 * Shared building blocks for the Site-configurations sections. Each section file
 * composes these to stay consistent with the design (section header rule, a
 * label + helper-text field wrapper, segmented controls and toggle rows).
 */

/** The header at the top of every section pane: a muted glyph + the title, with
 *  an optional one-line description under it. */
export function SectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="mb-6 border-border border-b pb-3">
      <div className="flex items-center gap-2.5">
        <span className="text-base text-muted-foreground">{icon}</span>
        <h2 className="font-semibold text-lg tracking-tight">{title}</h2>
      </div>
      {description ? <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">{description}</p> : null}
    </div>
  );
}

/** A labelled form row: bold label, muted helper text, then the control. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const generatedId = useId();
  const isDirectControl = isValidElement(children) && (children.type === Input || children.type === Textarea || children.type === Slider);
  const childId = isDirectControl ? (children as ReactElement<{ id?: string }>).props.id : undefined;
  const controlId = htmlFor ?? childId ?? (isDirectControl ? generatedId : undefined);
  const labelledChildren = isDirectControl ? cloneElement(children as ReactElement<{ id?: string }>, { id: controlId }) : children;

  return (
    <div className={cn('mb-6', className)}>
      <label className="block font-semibold text-[13px]" htmlFor={controlId}>
        {label}
      </label>
      {hint ? <p className="mt-1 mb-2.5 text-[12.5px] text-muted-foreground leading-snug">{hint}</p> : <div className="mb-2.5" />}
      {labelledChildren}
    </div>
  );
}

/**
 * A standalone bold group label (e.g. "Navbar links", "Primary color") that
 * heads a control group rather than labelling a single input. Rendered as a
 * non-`<label>` element so it isn't expected to associate with one control.
 */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('font-semibold text-[13px]', className)}>{children}</div>;
}

/** A pill segmented control matching the chip-background design tokens. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  disabled = false,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <SegmentedControl className={cn('w-full', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <SegmentedControlItem
            active={active}
            className="px-3"
            disabled={disabled}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </SegmentedControlItem>
        );
      })}
    </SegmentedControl>
  );
}

/** A bordered toggle row: title + helper text on the left, a Switch on the right. */
export function ToggleRow({
  title,
  hint,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  title: string;
  hint?: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  // Associate the visible title with the Switch so assistive tech announces a
  // name (the base-ui switch has no intrinsic label otherwise).
  const titleId = useId();
  return (
    <div className="flex items-center gap-4 border-border border-t py-3.5">
      <div className={cn('flex-1 leading-snug', disabled && 'opacity-60')}>
        <div id={titleId} className="font-medium text-[13.5px]">
          {title}
        </div>
        {hint ? <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div> : null}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-labelledby={titleId} />
    </div>
  );
}

/** A language's display label; disabled languages carry the muted "hidden"
 *  suffix so pickers always signal that the scope isn't live on the site. The
 *  label is the language's own name, so it renders in that language's
 *  direction when known (keeps "Português (Brasil)" intact in an RTL UI). */
export function LanguageOptionLabel({ language }: { language: { label: string; enabled?: boolean; direction?: 'LTR' | 'RTL' } }) {
  const t = useT();
  const dir = language.direction ? (language.direction === 'RTL' ? 'rtl' : 'ltr') : undefined;
  if (language.enabled !== false) {
    return <span dir={dir}>{language.label}</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span dir={dir}>{language.label}</span>
      <span className="font-normal text-[10px] text-muted-foreground/80 uppercase tracking-wide">{t('settings.languages.hiddenBadge')}</span>
    </span>
  );
}

/**
 * "Default + one per extra language" scope switcher used by the scoped sections
 * (navbar/footer/banner/search/seo): the default scope edits `project.config`,
 * a language scope edits that language's `config.<section>` override. EVERY
 * non-default language is listed — disabled languages stay editable (matching
 * the Languages section's promise) but carry a muted "hidden" suffix since that
 * scope isn't live on the published site. Renders nothing when the site has no
 * extra languages. The optional async `guard` runs before a scope switch (the
 * sections use it for an unsaved-changes confirm) — the switch only applies
 * when it resolves true.
 */
export function LanguageScopePicker({
  languages,
  defaultLanguage,
  value,
  onChange,
  hint,
  guard,
}: {
  languages: Array<{ id: string; label: string; enabled?: boolean }>;
  /** The site's default language — its label annotates the Default segment so
   *  it's clear which language the global scope actually is. */
  defaultLanguage?: { label: string; direction?: 'LTR' | 'RTL' } | null;
  value: string;
  onChange: (value: string) => void;
  hint: string;
  guard?: () => boolean | Promise<boolean>;
}) {
  const t = useT();
  if (languages.length === 0) {
    return null;
  }
  const handleChange = async (next: string) => {
    if (next === value) {
      return;
    }
    if (guard && !(await guard())) {
      return;
    }
    onChange(next);
  };
  return (
    <div className="mb-6">
      <GroupLabel>{t('settings.chrome.scope.label')}</GroupLabel>
      <p className="mt-1 mb-2.5 text-[12.5px] text-muted-foreground leading-snug">{hint}</p>
      <Segmented
        onChange={(next) => void handleChange(next)}
        options={[
          {
            value: 'default',
            label: defaultLanguage ? (
              <span className="inline-flex items-baseline gap-1.5">
                {t('settings.chrome.scope.default')}
                <span className="font-normal text-[12px] text-muted-foreground">
                  ·{' '}
                  <span dir={defaultLanguage.direction ? (defaultLanguage.direction === 'RTL' ? 'rtl' : 'ltr') : undefined}>
                    {defaultLanguage.label}
                  </span>
                </span>
              </span>
            ) : (
              t('settings.chrome.scope.default')
            ),
          },
          ...languages.map((language) => ({
            value: language.id,
            label: <LanguageOptionLabel language={language} />,
          })),
        ]}
        value={languages.some((language) => language.id === value) ? value : 'default'}
      />
    </div>
  );
}

/**
 * Mirrors a scope form's dirty flag up to its section parent. Render it from a
 * `<form.Subscribe selector={(s) => s.isDirty}>` inside the form so only the
 * flag re-renders; the flag resets to clean when the scope form unmounts
 * (keyed remount on scope switch).
 */
export function DirtyStateReporter({ dirty, onDirtyChange }: { dirty: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  return null;
}

/**
 * The scoped sections' unsaved-changes guard. Scope forms report dirtiness
 * into a ref via `setDirty` (wired through DirtyStateReporter), and `guard` —
 * passed to LanguageScopePicker — asks to discard (styled confirm) before a
 * scope switch while that ref is dirty. A ref keeps per-keystroke dirty
 * updates from re-rendering the section.
 */
export function useScopeDirtyGuard(): { guard: () => Promise<boolean>; setDirty: (dirty: boolean) => void } {
  const t = useT();
  const confirm = useConfirm();
  const dirtyRef = useRef(false);
  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);
  const guard = useCallback(async () => {
    if (!dirtyRef.current) {
      return true;
    }
    return confirm({
      title: t('settings.chrome.scope.discardTitle'),
      description: t('settings.chrome.scope.discardDescription'),
      confirmLabel: t('settings.chrome.scope.discardConfirm'),
      destructive: true,
    });
  }, [confirm, t]);
  return { guard, setDirty };
}

/** The right-aligned Save button row used at the bottom of each form section. */
export function SaveBar({ isSubmitting, disabled = false }: { isSubmitting: boolean; disabled?: boolean }) {
  const t = useT();
  return (
    <div className="mt-2 flex justify-end">
      <Button disabled={isSubmitting || disabled} type="submit">
        {isSubmitting ? t('common.saving') : t('common.save')}
      </Button>
    </div>
  );
}
