'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSaPhone, formatSaPhoneDisplay, isValidSaPhoneLocal, stripPhoneDigits } from '@/lib/phone';
import { login } from './actions';

type LoginTab = 'email' | 'phone';

export default function LoginPage() {
  const router = useRouter();
  const tabsId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<LoginTab>('email');
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchTab(mode: LoginTab) {
    setTab(mode);
    setError(null);
    requestAnimationFrame(() => {
      (mode === 'email' ? emailRef : phoneRef).current?.focus();
    });
  }

  function handlePhoneChange(value: string) {
    setPhoneDisplay(formatSaPhoneDisplay(value));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;

    if (tab === 'phone') {
      const localDigits = stripPhoneDigits(phoneDisplay);
      if (!isValidSaPhoneLocal(localDigits)) {
        setError('Enter a valid 9-digit mobile number (e.g. 82 123 4567)');
        setLoading(false);
        return;
      }
    }

    const result =
      tab === 'email'
        ? await login({
            method: 'email',
            email: form.get('email') as string,
            password,
          })
        : await login({
            method: 'phone',
            phone: formatSaPhone(phoneDisplay),
            password,
          });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">MarineFlow</CardTitle>
          <CardDescription>Sign in to your salon dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="tablist"
            aria-label="Sign in method"
            className="flex rounded-lg border p-1 mb-6 bg-muted/30"
          >
            {(['email', 'phone'] as const).map((mode) => (
              <button
                key={mode}
                id={`${tabsId}-${mode}`}
                type="button"
                role="tab"
                aria-selected={tab === mode}
                aria-controls={`${tabsId}-panel`}
                onClick={() => switchTab(mode)}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {mode === 'email' ? 'Email' : 'Phone'}
              </button>
            ))}
          </div>

          <form
            id={`${tabsId}-panel`}
            role="tabpanel"
            aria-labelledby={`${tabsId}-${tab}`}
            onSubmit={(e) => void handleSubmit(e)}
            className="space-y-4"
          >
            {tab === 'email' ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@salon.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="flex">
                  <span
                    className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted px-3 text-sm font-medium text-muted-foreground shrink-0"
                    aria-hidden
                  >
                    +27
                  </span>
                  <Input
                    ref={phoneRef}
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    value={phoneDisplay}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="82 123 4567"
                    required
                    autoComplete="tel-national"
                    className="rounded-l-none"
                    aria-describedby="phone-hint"
                    maxLength={11}
                  />
                </div>
                <p id="phone-hint" className="text-xs text-muted-foreground leading-relaxed">
                  For owners and managers who registered with a phone number instead of email.
                  Enter your 9-digit number without the leading 0.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                minLength={1}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
