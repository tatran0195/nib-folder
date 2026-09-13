import { Button } from '@nibleaf/design-system/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@nibleaf/design-system/components/ui/select';
import { Skeleton } from '@nibleaf/design-system/components/ui/skeleton';
import { cn } from '@nibleaf/design-system/lib/utils';
import type { MessageKey } from '@nibleaf/i18n';
import { useT } from '@nibleaf/i18n/react';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AddonsSection } from '@/components/project-settings/addons-section';
import { AuthenticationSection } from '@/components/project-settings/authentication-section';
import { DangerSection } from '@/components/project-settings/danger-section';
import { DomainSection } from '@/components/project-settings/domain-section';
import { ExportsSection } from '@/components/project-settings/exports-section';
import { GeneralSection } from '@/components/project-settings/general-section';
import { LanguagesSection } from '@/components/project-settings/languages-section';
import { MembersSection } from '@/components/project-settings/members-section';
import { OpenApiSection } from '@/components/project-settings/openapi-section';
import { SearchSection } from '@/components/project-settings/search-section';
import { ApiKeysTab } from '@/components/settings/api-keys-tab';
import { GitTab } from '@/components/settings/git-tab';
import { ImportTab } from '@/components/settings/import-tab';
import { IntegrationsTab } from '@/components/settings/integrations-tab';
import { NotificationsTab } from '@/components/settings/notifications-tab';
import type { Project } from '@/hooks/api';
import { useProject } from '@/services/projects.service';
import { GROUPS, type ProjectSectionId, SECTIONS } from './project-settings-schema';

export type { ProjectSectionId };

interface ProjectSettingsPageProps {
  projectId: string;
  section: ProjectSectionId;
}

export function ProjectSettingsPage({ projectId, section }: ProjectSettingsPageProps) {
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const t = useT();
  const sectionItems = SECTIONS.map((item) => ({ value: item.id, label: t(`settings.${item.id}` as MessageKey) }));

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-background md:flex-row">
      <div className="shrink-0 border-border border-b bg-card px-4 py-3 md:hidden">
        <label className="mb-1.5 block font-semibold text-[10.5px] text-muted-foreground uppercase tracking-wider" htmlFor="mobile-settings-section">
          {t('settings.heading')}
        </label>
        <Select
          items={sectionItems}
          onValueChange={(next) =>
            navigate({
              search: ((prev: Record<string, unknown>) => ({ ...prev, section: (next ?? section) as ProjectSectionId })) as never,
              replace: true,
            })
          }
          value={section}
        >
          <SelectTrigger aria-label={t('settings.heading')} className="h-10 w-full rounded-lg font-medium" id="mobile-settings-section">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((group) => (
              <SelectGroup key={group.id}>
                <SelectLabel>{t(group.labelKey)}</SelectLabel>
                {SECTIONS.filter((item) => item.group === group.id).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {t(`settings.${item.id}` as MessageKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <aside className="hidden w-[238px] shrink-0 overflow-y-auto border-border border-e bg-card px-3 py-4.5 md:block">
        <div className="px-3 pt-1 pb-2.5 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">{t('settings.heading')}</div>
        <nav className="flex flex-col gap-0.5">
          {GROUPS.map((group) => (
            <div key={group.id} className="mt-3 first:mt-0">
              <div className="px-3 pb-1 font-semibold text-[10.5px] text-muted-foreground/70 uppercase tracking-wider">{t(group.labelKey)}</div>
              {SECTIONS.filter((item) => item.group === group.id).map((item) => {
                const active = item.id === section;
                const Icon = item.icon;
                return (
                  <Button
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'h-9 w-full justify-start gap-2 rounded-lg px-3 text-[13.5px]',
                      active ? 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary' : 'text-muted-foreground',
                    )}
                    key={item.id}
                    onClick={() => navigate({ search: ((prev: Record<string, unknown>) => ({ ...prev, section: item.id })) as never, replace: true })}
                    type="button"
                    variant="ghost"
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    {t(`settings.${item.id}` as MessageKey)}
                  </Button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-6 md:px-9 md:pt-8 md:pb-32">
          {isLoading || !project ? <SectionSkeleton /> : <ActiveSection projectId={projectId} project={project} section={section} />}
        </div>
      </div>
    </div>
  );
}

function ActiveSection({ project, section, projectId }: { project: Project; section: ProjectSectionId; projectId: string }) {
  const sections: Record<ProjectSectionId, ReactNode> = {
    general: <GeneralSection key={`general-${project.id}`} project={project} />,
    languages: <LanguagesSection key={`languages-${project.id}`} project={project} />,
    domain: <DomainSection key={`domain-${projectId}`} project={project} />,
    authentication: <AuthenticationSection key={`authentication-${project.id}`} project={project} />,
    search: <SearchSection key={`search-${project.id}`} project={project} />,
    addons: <AddonsSection key={`addons-${project.id}`} projectId={project.id} />,
    git: <GitTab key={`git-${projectId}`} projectId={projectId} />,
    openapi: <OpenApiSection key={`openapi-${projectId}`} projectId={projectId} />,
    contentImport: <ImportTab key={`import-${projectId}`} projectId={projectId} />,
    members: <MembersSection key={`members-${projectId}`} projectId={projectId} />,
    apiKeys: <ApiKeysTab key={`api-keys-${projectId}`} projectId={projectId} />,
    integrations: <IntegrationsTab key={`integrations-${projectId}`} projectId={projectId} project={project} />,
    notifications: <NotificationsTab key={`notifications-${projectId}`} projectId={projectId} />,
    exports: <ExportsSection key={`exports-${projectId}`} projectId={projectId} />,
    danger: <DangerSection project={project} />,
  };
  const wideSection = section === 'general' || section === 'integrations' || section === 'exports';
  return <div className={cn('w-full', wideSection ? 'max-w-6xl' : 'max-w-4xl')}>{sections[section]}</div>;
}

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-[42px] w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-[42px] w-full" />
      </div>
    </div>
  );
}

export default ProjectSettingsPage;
