export function MarketingRtlEvidenceCard({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <h3 className="font-semibold text-lg">{title}</h3>
      <ul className="mt-4 space-y-2 text-muted-foreground text-sm">
        {items.map((item) => (
          <li className="flex gap-2" key={item}>
            <span className="text-primary">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
