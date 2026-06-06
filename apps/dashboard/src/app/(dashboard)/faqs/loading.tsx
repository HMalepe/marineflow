export default function FaqsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 bg-muted rounded" />
      <div className="h-4 w-96 max-w-full bg-muted rounded" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-20 bg-muted rounded-xl" />
        <div className="h-20 bg-muted rounded-xl" />
        <div className="h-20 bg-muted rounded-xl" />
        <div className="h-20 bg-muted rounded-xl" />
      </div>
      <div className="h-72 bg-muted rounded-xl" />
    </div>
  );
}
