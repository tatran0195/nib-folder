import { HelpCircle } from 'lucide-react';

export function MarketingRtlEmptyResult() {
  return (
    <div className="flex min-h-[34rem] flex-col items-center justify-center rounded-2xl border border-border border-dashed bg-card/30 p-8 text-center">
      <HelpCircle className="size-10 text-muted-foreground" />
      <h2 className="mt-4 font-semibold text-xl">Your evidence report appears here</h2>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm">
        The included sample demonstrates the input format. Replace it with a real initial HTML response when you are ready.
      </p>
    </div>
  );
}
