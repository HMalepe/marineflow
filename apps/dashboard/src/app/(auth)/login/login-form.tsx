'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSaPhone, formatSaPhoneDisplay, isValidSaPhoneLocal, stripPhoneDigits } from '@/lib/phone';
import {
  normalizePhoneForPasswordManager,
  parseLoginRedirectParams,
  promptSavePassword,
  resolvePasswordManagerUsername,
} from '@/lib/password-manager';
import { PasswordManagerUsernameField } from '@/components/password-manager-username-field';
import { checkPhone, login, setupPassword } from './actions';

type LoginTab = 'whatsapp' | 'email';
type PhoneStep = 'number' | 'login' | 'setup';

function validateStrongPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/i.test(password)) return 'Password must include a letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  return null;
}

function e164ToLocalDisplay(e164: string): string {
  const normalized = normalizePhoneForPasswordManager(e164);
  if (!normalized) return '';
  const digits = normalized.replace(/\D/g, '').slice(2);
  return formatSaPhoneDisplay(digits);
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = useMemo(
    () => parseLoginRedirectParams(searchParams),
    [searchParams],
  );

  const tabsId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<LoginTab>(redirect.tab);
  const [phoneStep, setPhoneStep] = useState<PhoneStep>(
    redirect.phone ? 'login' : 'number',
  );
  const [phoneDisplay, setPhoneDisplay] = useState(
    redirect.phone ? e164ToLocalDisplay(redirect.phone) : '',
  );
  const [emailValue, setEmailValue] = useState(redirect.email);
  const [salonName, setSalonName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordChangedBanner, setPasswordChangedBanner] = useState(redirect.passwordChanged);

  const phoneUsername = useMemo(() => {
    const e164 = formatSaPhone(phoneDisplay);
    return normalizePhoneForPasswordManager(e164)
      ? resolvePasswordManagerUsername({ email: '', phone: e164 })
      : null;
  }, [phoneDisplay]);

  const emailUsername = useMemo(
    () => resolvePasswordManagerUsername({ email: emailValue, preferEmail: true }),
    [emailValue],
  );

  useEffect(() => {
    if (redirect.phone && phoneStep === 'login') {
      void checkPhone(redirect.phone).then((result) => {
        if (!('error' in result)) setSalonName(result.salonName);
      });
    }
  }, [redirect.phone, phoneStep]);

  function switchTab(mode: LoginTab) {
    setTab(mode);
    setPhoneStep('number');
    setSalonName(null);
    setError(null);
    requestAnimationFrame(() => {
      (mode === 'email' ? emailRef : phoneRef).current?.focus();
    });
  }

  function handlePhoneChange(value: string) {
    setPhoneDisplay(formatSaPhoneDisplay(value));
  }

  function phoneE164(): string {
    return formatSaPhone(phoneDisplay);
  }

  async function handleCheckPhone(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const localDigits = stripPhoneDigits(phoneDisplay);
    if (!isValidSaPhoneLocal(localDigits)) {
      setError('Enter a valid 9-digit WhatsApp business number (e.g. 82 123 4567)');
      setLoading(false);
      return;
    }

    const result = await checkPhone(phoneE164());
    if ('error' in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSalonName(result.salonName);
    setPhoneStep(result.status === 'setup' ? 'setup' : 'login');
    setLoading(false);
  }

  async function handlePhoneLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const password = new FormData(e.currentTarget).get('password') as string;
    const e164 = phoneE164();
    const result = await login({ method: 'phone', phone: e164, password });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      const username = resolvePasswordManagerUsername({ email: '', phone: e164 });
      if (username) await promptSavePassword(username, password);
      setPasswordChangedBanner(false);
      router.push('/');
      router.refresh();
    }
  }

  async function handleSetupPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;
    const confirm = form.get('confirmPassword') as string;

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const e164 = phoneE164();
    const result = await setupPassword(e164, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      const username = resolvePasswordManagerUsername({ email: '', phone: e164 });
      if (username) await promptSavePassword(username, password);
      router.push('/');
      router.refresh();
    }
  }

  async function handleEmailLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;
    const result = await login({ method: 'email', email, password });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      const username = resolvePasswordManagerUsername({ email, preferEmail: true });
      if (username) await promptSavePassword(username, password);
      setPasswordChangedBanner(false);
      router.push('/');
      router.refresh();
    }
  }

  function backToPhoneEntry() {
    setPhoneStep('number');
    setSalonName(null);
    setError(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">MarineFlow</CardTitle>
          <CardDescription>
            {tab === 'whatsapp' && phoneStep === 'setup'
              ? 'Create your dashboard password'
              : 'Sign in to your salon dashboard'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="tablist"
            aria-label="Sign in method"
            className="flex rounded-lg border p-1 mb-6 bg-muted/30"
          >
            {(['whatsapp', 'email'] as const).map((mode) => (
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
                {mode === 'whatsapp' ? 'WhatsApp' : 'Email'}
              </button>
            ))}
          </div>

          <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`}>
            {passwordChangedBanner && (
              <p className="mb-4 text-sm rounded-md bg-green-600/10 text-green-800 dark:text-green-300 px-3 py-2 border border-green-600/20">
                Password updated. Sign in with your new password — your browser may ask to save it.
              </p>
            )}

            {tab === 'email' ? (
              <form onSubmit={(e) => void handleEmailLogin(e)} className="space-y-4" autoComplete="on" method="post">
                <PasswordManagerUsernameField username={emailUsername} />
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
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    name="password"
                    required
                    autoComplete="current-password"
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
            ) : phoneStep === 'number' ? (
              <form onSubmit={(e) => void handleCheckPhone(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp business number</Label>
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
                      autoFocus
                    />
                  </div>
                  <p id="phone-hint" className="text-xs text-muted-foreground leading-relaxed">
                    Enter the WhatsApp business number assigned to your salon on MarineFlow (from our Twilio account).
                    On first visit you&apos;ll create your password — no Meta account needed.
                  </p>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Checking…' : 'Continue'}
                </Button>
              </form>
            ) : phoneStep === 'login' ? (
              <form onSubmit={(e) => void handlePhoneLogin(e)} className="space-y-4" autoComplete="on" method="post">
                <PasswordManagerUsernameField username={phoneUsername} />
                <p className="text-sm text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                  Signing in to <span className="font-medium text-foreground">{salonName}</span>
                  {' · '}
                  <span className="tabular-nums">{phoneE164()}</span>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    autoFocus
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
                <Button type="button" variant="ghost" className="w-full" onClick={backToPhoneEntry}>
                  Use a different number
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleSetupPassword(e)} className="space-y-4" autoComplete="on" method="post">
                <PasswordManagerUsernameField username={phoneUsername} />
                <p className="text-sm text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                  Welcome to <span className="font-medium text-foreground">{salonName}</span>
                  ! Create a strong password for{' '}
                  <span className="tabular-nums">{phoneE164()}</span>.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    name="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    At least 8 characters, with a letter and a number.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    autoComplete="off"
                    minLength={8}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Saving…' : 'Create password & sign in'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={backToPhoneEntry}>
                  Use a different number
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginPageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">MarineFlow</CardTitle>
          <CardDescription>Sign in to your salon dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-10 rounded-lg bg-muted/50 animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-10 rounded-md bg-muted/50 animate-pulse" />
            <div className="h-10 rounded-md bg-muted/50 animate-pulse" />
            <div className="h-10 rounded-md bg-muted/50 animate-pulse" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { LoginPageSkeleton };
