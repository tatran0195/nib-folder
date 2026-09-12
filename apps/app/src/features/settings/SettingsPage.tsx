import { Label } from '@nibleaf/design-system/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@nibleaf/design-system/components/ui/select';
import { cn } from '@nibleaf/design-system/lib/utils';
import type { MessageKey } from '@nibleaf/i18n';
import { useT } from '@nibleaf/i18n/react';
import { useNavigate } from '@tanstack/react-router';
import { type LucideIcon, Palette, UserRound } from 'lucide-react';
import { AccountTab } from '@/components/settings/account-tab';
import { AppearanceTab } from '@/components/settings/appearance-tab';

export type SettingsTabValue = 'account' | 'appearance';

const SECTIONS = [
  { value: 'account', labelKey: 'settings.tab.account', icon: UserRound },
  { value: 'appearance', labelKey: 'settings.tab.appearance', icon: Palette },
] as const satisfies ReadonlyArray<{ value: SettingsTabValue; labelKey: MessageKey; icon: LucideIcon }>;

interface SettingsPageProps {
  tab: SettingsTabValue;
}

export function SettingsPage({ tab }: SettingsPageProps) {
  const t = useT();
  const navigate = useNavigate();
  const sectionItems = SECTIONS.map((item) => ({ value: item.value, label: t(item.labelKey) }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">{t('settings.title')}</h1>
        <p className="mt-1 text-muted-foreground text-sm">{t('settings.subtitle')}</p>
      </div>

      <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="sm:hidden">
          <Label className="sr-only" htmlFor="settings-section">
            {t('settings.title')}
          </Label>
          <Select
            items={sectionItems}
            onValueChange={(value) => {
              if (value) navigate({ search: ((prev: Record<string, unknown>) => ({ ...prev, tab: value })) as never, replace: true });
            }}
            value={tab}
          >
            <SelectTrigger className="w-full" id="settings-section">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <SelectItem key={item.value} value={item.value}>
                    <span className="flex items-center gap-2">
                      <Icon className="size-4" />
                      {t(item.labelKey)}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Sidebar nav (desktop) */}
        <aside className="hidden w-48 shrink-0 sm:block">
          <nav aria-label={t('settings.title')} className="sticky top-20 flex flex-col gap-1">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sm transition-colors',
                    active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                  onClick={() => navigate({ search: ((prev: Record<string, unknown>) => ({ ...prev, tab: item.value })) as never, replace: true })}
                  type="button"
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{t(item.labelKey)}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          {tab === 'account' ? <AccountTab /> : null}
          {tab === 'appearance' ? <AppearanceTab /> : null}
        </main>
      </div>
    </div>
  );
}

export default SettingsPage;
