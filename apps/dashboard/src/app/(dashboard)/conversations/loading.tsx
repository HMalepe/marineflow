export default function ConversationsLoading() {
  return (
    <div className="dashboard-workspace animate-pulse">
      <div className="h-8 w-48 bg-muted rounded shrink-0" />
      <div className="h-4 w-72 bg-muted rounded shrink-0" />
      <div className="dashboard-inbox-frame flex-col md:flex-row min-h-[20rem]">
        <div className="w-full md:w-96 bg-muted/60 border-b md:border-b-0 md:border-r" />
        <div className="flex-1 bg-muted/40 hidden md:block" />
      </div>
    </div>
  );
}
