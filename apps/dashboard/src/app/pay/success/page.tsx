export default function PaySuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="size-20 rounded-full bg-green-600/15 flex items-center justify-center mx-auto">
          <svg className="size-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Payment successful!</h1>
          <p className="text-muted-foreground">
            Your booking is confirmed. You&apos;ll receive a WhatsApp message with your booking details shortly.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p>You can close this page and check your WhatsApp for confirmation. 💬</p>
        </div>
      </div>
    </div>
  );
}
