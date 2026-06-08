export default function CampaignsLoading() {
  return (
    <div className="max-w-5xl space-y-8 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-32 bg-muted rounded" />
        <div className="h-9 w-56 bg-muted rounded-lg" />
        <div className="h-4 w-full max-w-md bg-muted rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[108px] rounded-xl bg-muted ring-1 ring-border/50" />
        ))}
      </div>
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-[120px] rounded-xl bg-muted ring-1 ring-border/50" />
        ))}
      </div>
    </div>
  );
}
