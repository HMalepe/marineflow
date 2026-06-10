export default function PayCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="size-20 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto">
          <svg className="size-10 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Payment cancelled</h1>
          <p className="text-muted-foreground">
            No charge was made. Your booking is on hold — go back to WhatsApp to retry the payment or choose a different option.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p>Your slot is held for a short time. Head back to WhatsApp to complete your booking. 💬</p>
        </div>
      </div>
    </div>
  );
}
