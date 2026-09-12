import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import type { RtlReadinessResult } from '@/lib/rtl-readiness';

export function MarketingRtlCheckRow({ check }: { check: RtlReadinessResult['checks'][number] }) {
  const Icon = check.status === 'pass' ? CheckCircle2 : check.status === 'fail' ? AlertTriangle : HelpCircle;
  const color =
    check.status === 'pass'
      ? 'text-emerald-600 dark:text-emerald-400'
      : check.status === 'fail'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';
  return (
    <div className="py-4 text-sm">
      <div className="flex items-start gap-2">
        <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${color}`} />
        <span className="sr-only">Status: {check.status}</span>
        <div>
          <p className="font-medium">{check.id}</p>
          <p className="mt-1 text-muted-foreground">{check.actual}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1 ps-6 text-xs">
        <p>
          <strong>Expected:</strong> {check.expected}
        </p>
        <p>
          <strong>Reproduce:</strong> {check.reproduction}
        </p>
      </div>
    </div>
  );
}
