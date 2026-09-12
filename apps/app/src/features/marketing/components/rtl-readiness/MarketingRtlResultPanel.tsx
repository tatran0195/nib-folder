import { Clipboard } from 'lucide-react';
import { outlineButton } from '@/components/cloud-marketing';
import type { RtlReadinessResult } from '@/lib/rtl-readiness';
import { MarketingRtlCheckRow } from './MarketingRtlCheckRow';

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="font-semibold text-lg">{value}</p>
      <p className="mt-0.5 text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

export interface MarketingRtlResultPanelProps {
  copied: boolean;
  copyError: string | null;
  onCopy: () => void;
  result: RtlReadinessResult;
}

export function MarketingRtlResultPanel({ copied, copyError, onCopy, result }: MarketingRtlResultPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">Static evidence score</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-semibold text-5xl tracking-tight">{result.score ?? '—'}</span>
            <span className="text-muted-foreground">/ 100 known evidence</span>
          </div>
          <p className="mt-2 font-medium capitalize">{result.band}</p>
        </div>
        <button className={outlineButton} onClick={onCopy} type="button">
          <Clipboard className="size-4" /> {copied ? 'Copied' : 'Copy JSON'}
        </button>
      </div>
      {copyError ? <p className="mt-3 text-amber-700 text-sm dark:text-amber-300">{copyError}</p> : null}
      <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
        <Metric value={`${result.coverage}%`} label="rubric covered" />
        <Metric value={String(result.checksRun)} label="checks scored" />
        <Metric value={String(result.checksUnknown)} label="unknown" />
      </div>
      <div className="mt-7 space-y-3">
        {result.categories.map((category) => (
          <div className="rounded-lg border border-border bg-background p-4" key={category.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-sm">{category.label}</h3>
              <span className="font-mono text-muted-foreground text-xs">{category.score ?? '—'} / 100</span>
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              {category.knownWeight}/{category.totalWeight} weight scored · {category.unknownChecks} unknown
            </p>
          </div>
        ))}
      </div>
      <details className="mt-6 rounded-lg border border-border bg-background px-4" open>
        <summary className="cursor-pointer py-4 font-medium text-sm">All checks and reproduction steps</summary>
        <div className="divide-y divide-border border-border border-t">
          {result.checks.map((check) => (
            <MarketingRtlCheckRow check={check} key={check.id} />
          ))}
        </div>
      </details>
    </div>
  );
}
