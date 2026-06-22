export default function ConversationsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="h-4 w-72 bg-muted rounded" />
      <div className="flex gap-4 dashboard-fit-panel min-h-[20rem]">
        <div className="w-full md:w-96 bg-muted rounded-xl" />
        <div className="flex-1 bg-muted rounded-xl hidden md:block" />
      </div>
    </div>
  );
}
