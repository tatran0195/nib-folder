import { NibleafMark } from '@nibleaf/design-system/brand';
import { Button } from '@nibleaf/design-system/components/ui/button';
import { Skeleton } from '@nibleaf/design-system/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nibleaf/design-system/components/ui/table';
import { useT } from '@nibleaf/i18n/react';
import { useNavigate } from '@tanstack/react-router';
import { BookText, FileText, Plus, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SectionCard } from '@/components/app/section-card';
import { useProjects } from '@/hooks/api';
import { recordFirstPublishStage } from '@/lib/first-publish-activation';
import { useFormatters } from '@/lib/format';
import { DashboardCreateProjectDialog } from './components/DashboardCreateProjectDialog';

interface DashboardProjectsPageProps {
  firstPublish?: boolean;
  newSite?: boolean;
}

export function DashboardProjectsPage({ firstPublish, newSite }: DashboardProjectsPageProps) {
  const { data: projects, isPending } = useProjects();
  const [newProjectOpen, setNewProjectOpen] = useState(Boolean(newSite));
  const t = useT();
  const navigate = useNavigate();
  const { number } = useFormatters();

  const totalPages = (projects ?? []).reduce((sum, p) => sum + (p._count?.pages ?? 0), 0);
  const totalDeploys = (projects ?? []).reduce((sum, p) => sum + (p._count?.deployments ?? 0), 0);

  useEffect(() => {
    const starterProject = projects?.[0];
    if (!firstPublish || !starterProject) return;
    void recordFirstPublishStage('project_entered');
    void navigate({
      to: '/app/projects/$projectId/editor',
      params: { projectId: starterProject.id },
      search: { firstPublish: true },
      replace: true,
    });
  }, [firstPublish, navigate, projects]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">{t('dashboard.title')}</h1>
          <p className="mt-1 text-muted-foreground text-sm">{t('dashboard.subtitle')}</p>
        </div>
        <Button onClick={() => setNewProjectOpen(true)}>
          <Plus className="size-4" /> {t('dashboard.newProject')}
        </Button>
        <DashboardCreateProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SectionCard label={t('dashboard.stats.projects')} value={projects?.length ?? 0} icon={<BookText className="size-4" />} loading={isPending} />
        <SectionCard label={t('dashboard.stats.pages')} value={totalPages} icon={<FileText className="size-4" />} loading={isPending} />
        <SectionCard label={t('dashboard.stats.deploys')} value={totalDeploys} icon={<Rocket className="size-4" />} loading={isPending} />
      </div>

      {/* Sites table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-border border-b px-5 py-3.5">
          <h2 className="font-semibold text-sm">{t('dashboard.sitesTable')}</h2>
        </div>
        {isPending ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (projects ?? []).length === 0 ? (
          <div className="grid place-items-center py-16 text-center">
            <BookText className="size-7 text-muted-foreground" />
            <p className="mt-3 font-medium">{t('dashboard.empty.title')}</p>
            <p className="mt-1 max-w-sm text-muted-foreground text-sm">{t('dashboard.empty.body')}</p>
            <Button className="mt-4" onClick={() => setNewProjectOpen(true)}>
              <Plus className="size-4" /> {t('dashboard.empty.cta')}
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('dashboard.col.site')}</TableHead>
                <TableHead className="text-end">{t('dashboard.col.pages')}</TableHead>
                <TableHead className="text-end">{t('dashboard.col.deploys')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(projects ?? []).map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ to: '/app/projects/$projectId', params: { projectId: project.id } })}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <NibleafMark className="size-8 shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{project.name}</div>
                        <div className="truncate font-mono text-muted-foreground text-xs">/{project.slug}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{number(project._count?.pages ?? 0)}</TableCell>
                  <TableCell className="text-end tabular-nums">{number(project._count?.deployments ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export default DashboardProjectsPage;
