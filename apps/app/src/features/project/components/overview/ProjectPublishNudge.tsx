import { useT } from '@nibleaf/i18n/react';
import { Link } from '@tanstack/react-router';
import { Rocket, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const nudgeDismissKey = (projectId: string) => `nibleaf.publishNudge.${projectId}`;

export function ProjectPublishNudge({ projectId }: { projectId: string }) {
  const t = useT();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(nudgeDismissKey(projectId)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [projectId]);

  if (dismissed) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(nudgeDismissKey(projectId), '1');
    } catch {
      // ignore storage failures
    }
  };

  return (
    <div className="relative mt-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('overview.nudge.dismiss')}
        title={t('overview.nudge.dismiss')}
        className="absolute end-3 top-3 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Rocket className="size-4" />
        </span>
        <div className="leading-snug">
          <div className="font-semibold text-sm">{t('overview.nudge.title')}</div>
          <p className="mt-0.5 text-muted-foreground text-sm">{t('overview.nudge.body')}</p>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NudgeStep n={1} title={t('overview.nudge.step1')} desc={t('overview.nudge.step1Desc')}>
          <Link className="absolute inset-0" aria-label={t('overview.nudge.step1')} to="/app/projects/$projectId/editor" params={{ projectId }} />
        </NudgeStep>
        <NudgeStep n={2} title={t('overview.nudge.step2')} desc={t('overview.nudge.step2Desc')}>
          <Link
            className="absolute inset-0"
            aria-label={t('overview.nudge.step2')}
            to="/app/projects/$projectId/editor"
            params={{ projectId }}
            search={{ publish: true }}
          />
        </NudgeStep>
        <NudgeStep n={3} title={t('overview.nudge.step3')} desc={t('overview.nudge.step3Desc')}>
          <Link
            className="absolute inset-0"
            aria-label={t('overview.nudge.step3')}
            to="/app/projects/$projectId/settings"
            params={{ projectId }}
            search={{ section: 'domain' }}
          />
        </NudgeStep>
      </ol>
    </div>
  );
}

function NudgeStep({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <li className="relative flex items-start gap-3 rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-muted/40">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-[12px] text-primary">{n}</span>
      <div className="min-w-0 leading-snug">
        <div className="font-medium text-sm">{title}</div>
        <div className="mt-0.5 text-muted-foreground text-xs">{desc}</div>
      </div>
      {children}
    </li>
  );
}

export default ProjectPublishNudge;
