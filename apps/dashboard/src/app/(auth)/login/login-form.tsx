'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSaPhone, formatSaPhoneDisplay, isValidSaPhoneLocal, parseSaLocalPhoneInput } from '@/lib/phone';
import {
  normalizePhoneForPasswordManager,
  parseLoginRedirectParams,
  promptSavePassword,
  resolvePasswordManagerUsername,
} from '@/lib/password-manager';
import { postLoginDestination } from '@/lib/post-login-redirect';
import { PasswordManagerUsernameField } from '@/components/password-manager-username-field';
import {
  checkUsername,
  setupUsernamePassword,
  getForgotQuestion,
  forgotResetPassword,
  login,
  setupPassword,
  checkPhone,
} from './actions';

type LoginTab = 'username' | 'email';
type UsernameStep = 'check' | 'setup' | 'login' | 'forgot' | 'forgot_reset';
type PhoneStep = 'entry' | 'setup';

const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is the name of the street you grew up on?",
];

function validateStrongPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-z]/i.test(password)) return 'Password must include a letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  return null;
}

function e164ToLocalDisplay(e164: string): string {
  const normalized = normalizePhoneForPasswordManager(e164);
  if (!normalized) return '';
  return formatSaPhoneDisplay(normalized);
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = useMemo(() => parseLoginRedirectParams(searchParams), [searchParams]);
  const afterLoginPath = useMemo(() => postLoginDestination(redirect.redirectPath), [redirect.redirectPath]);

  const tabsId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<LoginTab>('username');
  const [usernameStep, setUsernameStep] = useState<UsernameStep>('check');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('entry');

  const [usernameValue, setUsernameValue] = useState('');
  const [salonName, setSalonName] = useState<string | null>(null);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [forgotQuestion, setForgotQuestion] = useState('');

  const [phoneDisplay, setPhoneDisplay] = useState(
    redirect.phone ? e164ToLocalDisplay(redirect.phone) : '',
  );
  const [emailValue, setEmailValue] = useState(redirect.email);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordChangedBanner, setPasswordChangedBanner] = useState(redirect.passwordChanged);

  const emailUsername = useMemo(
    () => resolvePasswordManagerUsername({ email: emailValue, preferEmail: true }),
    [emailValue],
  );

  const phoneUsername = useMemo(() => {
    const e164 = formatSaPhone(phoneDisplay);
    return normalizePhoneForPasswordManager(e164)
      ? resolvePasswordManagerUsername({ email: '', phone: e164 })
      : null;
  }, [phoneDisplay]);

  useEffect(() => {
    if (redirect.phone && phoneStep === 'entry') {
      void checkPhone(redirect.phone).then((result) => {
        if (!('error' in result)) setSalonName(result.salonName);
      });
    }
  }, [redirect.phone, phoneStep]);

  function switchTab(mode: LoginTab) {
    setTab(mode);
    setUsernameStep('check');
    setPhoneStep('entry');
    setSalonName(null);
    setError(null);
    requestAnimationFrame(() => {
      if (mode === 'email') emailRef.current?.focus();
      else usernameRef.current?.focus();
    });
  }

  // ── Username tab handlers ──────────────────────────────────────────────

  async function handleUsernameCheck(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await checkUsername(usernameValue);
    if ('error' in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSalonName(result.salonName);
    setUsernameStep(result.status === 'setup' ? 'setup' : 'login');
    setLoading(false);
  }

  async function handleUsernameSetup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;
    const confirm = form.get('confirmPassword') as string;
    const answer = (form.get('securityAnswer') as string).trim();

    const passwordError = validateStrongPassword(password);
    if (passwordError) { setError(passwordError); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (!securityQuestion) { setError('Choose a security question'); return; }
    if (!answer) { setError('Enter an answer to your security question'); return; }

    setLoading(true);
    const result = await setupUsernamePassword(usernameValue, password, securityQuestion, answer);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      await promptSavePassword({ type: 'username', value: usernameValue.toUpperCase() }, password);
      router.push(afterLoginPath);
      router.refresh();
    }
  }

  async function handleUsernameLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = form.get('password') as string;
    if (!password.trim()) { setError('Enter your password'); return; }
    setLoading(true);
    const result = await login({ method: 'username', username: usernameValue, password });
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      await promptSavePassword({ type: 'username', value: usernameValue.toUpperCase() }, password);
      setPasswordChangedBanner(false);
      router.push(afterLoginPath);
      router.refresh();
    }
  }

  async function handleForgotStart() {
    setError(null);
    setLoading(true);
    const result = await getForgotQuestion(usernameValue);
    if ('error' in result) {
      setError(result.error);
      setLoading(false);
    } else {
      setForgotQuestion(result.securityQuestion);
      setUsernameStep('forgot');
      setLoading(false);
    }
  }

  async function handleForgotReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const answer = (form.get('securityAnswer') as string).trim();
    const newPassword = form.get('newPassword') as string;
    const confirm = form.get('confirmPassword') as string;

    if (!answer) { setError('Enter your answer'); return; }
    if (usernameStep === 'forgot') {
      // Move to password entry step after answer check (or do it all in one step)
    }
    const passwordError = validateStrongPassword(newPassword);
    if (passwordError) { setError(passwordError); return; }
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    const result = await forgotResetPassword(usernameValue, answer, newPassword);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      await promptSavePassword({ type: 'username', value: usernameValue.toUpperCase() }, newPassword);
      router.push(afterLoginPath);
      router.refresh();
    }
  }

  // ── Phone tab handlers (kept for backwards compatibility) ──────────────

  function handlePhoneChange(value: string) {
    setPhoneDisplay(formatSaPhoneDisplay(value));
  }

  function phoneE164(): string { return formatSaPhone(phoneDisplay); }

  async function handlePhoneEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const localDigits = parseSaLocalPhoneInput(phoneDisplay);
    if (!isValidSaPhoneLocal(localDigits)) {
      setError('Enter a valid 9-digit WhatsApp business number (e.g. 82 123 4567)');
      setLoading(false);
      return;
    }
    const e164 = phoneE164();
    const password = (new FormData(e.currentTarget).get('password') as string) ?? '';
    const check = await checkPhone(e164);
    if ('error' in check) { setError(check.error); setLoading(false); return; }
    setSalonName(check.salonName);
    if (check.status === 'setup') { setPhoneStep('setup'); setLoading(false); return; }
    if (!password.trim()) { setError('Enter your password'); setLoading(false); return; }
    const result = await login({ method: 'phone', phone: e164, password });
    if (result.error) { setError(result.error); setLoading(false); }
    else {
      const username = resolvePasswordManagerUsername({ email: '', phone: e164 });
      if (username) await promptSavePassword(username, password);
      setPasswordChangedBanner(false);
      router.push(afterLoginPath);
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
    if (passwordError) { setError(passwordError); setLoading(false); return; }
    if (password !== confirm) { setError('Passwords do not match'); setLoading(false); return; }
    const e164 = phoneE164();
    const result = await setupPassword(e164, password);
    if (result.error) { setError(result.error); setLoading(false); }
    else {
      const username = resolvePasswordManagerUsername({ email: '', phone: e164 });
      if (username) await promptSavePassword(username, password);
      router.push(afterLoginPath);
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
    if (result.error) { setError(result.error); setLoading(false); }
    else {
      const username = resolvePasswordManagerUsername({ email, preferEmail: true });
      if (username) await promptSavePassword(username, password);
      setPasswordChangedBanner(false);
      router.push(afterLoginPath);
      router.refresh();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center dashboard-main-shell px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight solupair-text-gradient">Solupair</CardTitle>
          <CardDescription>
            {tab === 'username' && usernameStep === 'setup'
              ? `Welcome to ${salonName ?? 'your business'} — create your password`
              : tab === 'username' && usernameStep === 'forgot'
                ? 'Reset your password'
                : 'Login to your dashboard'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="tablist"
            aria-label="Sign in method"
            className="flex rounded-lg border p-1 mb-6 bg-muted/30"
          >
            {(['username', 'email'] as const).map((mode) => (
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
                {mode === 'username' ? 'Username' : 'Email'}
              </button>
            ))}
          </div>

          <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`}>
            {passwordChangedBanner && (
              <p className="mb-4 text-sm rounded-md bg-green-600/10 text-green-800 dark:text-green-300 px-3 py-2 border border-green-600/20">
                Password updated — sign in with your new password.
              </p>
            )}

            {/* ── EMAIL TAB ───────────────────────────────────────────── */}
            {tab === 'email' && (
              <form onSubmit={(e) => void handleEmailLogin(e)} className="space-y-4" autoComplete="on" method="post">
                <PasswordManagerUsernameField username={emailUsername} />
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    ref={emailRef}
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@business.co.za"
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
                {error && <p role="alert" className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            )}

            {/* ── USERNAME TAB — step: check ───────────────────────────── */}
            {tab === 'username' && usernameStep === 'check' && (
              <form onSubmit={(e) => void handleUsernameCheck(e)} className="space-y-4" autoComplete="on" method="post">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    ref={usernameRef}
                    id="username"
                    name="username"
                    type="text"
                    placeholder="e.g. SALON"
                    required
                    autoComplete="username"
                    autoFocus
                    value={usernameValue}
                    onChange={(e) => setUsernameValue(e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the username for your business (e.g. <strong>SALON</strong> or <strong>DISPENSARY</strong>).
                  </p>
                </div>
                {error && <p role="alert" className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Checking…' : 'Continue'}
                </Button>
              </form>
            )}

            {/* ── USERNAME TAB — step: login ───────────────────────────── */}
            {tab === 'username' && usernameStep === 'login' && (
              <form onSubmit={(e) => void handleUsernameLogin(e)} className="space-y-4" autoComplete="on" method="post">
                <PasswordManagerUsernameField username={{ type: 'username', value: usernameValue.toUpperCase() }} />
                {salonName && (
                  <p className="text-sm text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                    Signing in to <span className="font-medium text-foreground">{salonName}</span>
                  </p>
                )}
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
                {error && <p role="alert" className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
                <button
                  type="button"
                  className="w-full text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline text-center"
                  onClick={() => void handleForgotStart()}
                  disabled={loading}
                >
                  Forgot password?
                </button>
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { setUsernameStep('check'); setError(null); }}>
                  ← Use a different username
                </Button>
              </form>
            )}

            {/* ── USERNAME TAB — step: setup (first visit) ─────────────── */}
            {tab === 'username' && usernameStep === 'setup' && (
              <form onSubmit={(e) => void handleUsernameSetup(e)} className="space-y-4" autoComplete="on" method="post">
                <PasswordManagerUsernameField username={{ type: 'username', value: usernameValue.toUpperCase() }} />
                <p className="text-sm text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                  First visit — create a password for <span className="font-medium text-foreground">{salonName}</span>.
                  Your browser will offer to remember it.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <PasswordInput id="password" name="password" required autoComplete="new-password" minLength={8} autoFocus />
                  <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <PasswordInput id="confirmPassword" name="confirmPassword" required autoComplete="off" minLength={8} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="securityQuestion">Security question</Label>
                  <select
                    id="securityQuestion"
                    value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    required
                  >
                    <option value="">— Choose a question —</option>
                    {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">Used to reset your password if you forget it.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="securityAnswer">Your answer</Label>
                  <Input id="securityAnswer" name="securityAnswer" type="text" autoComplete="off" placeholder="Answer (not case-sensitive)" required />
                </div>

                {error && <p role="alert" className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Setting up…' : 'Create password & sign in'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => { setUsernameStep('check'); setError(null); }}>
                  ← Back
                </Button>
              </form>
            )}

            {/* ── USERNAME TAB — step: forgot ───────────────────────────── */}
            {tab === 'username' && (usernameStep === 'forgot') && (
              <form onSubmit={(e) => void handleForgotReset(e)} className="space-y-4" autoComplete="off" method="post">
                <p className="text-sm text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                  Resetting password for <span className="font-medium text-foreground">{salonName}</span>
                </p>
                <div className="space-y-2">
                  <Label>Security question</Label>
                  <p className="text-sm font-medium">{forgotQuestion}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="securityAnswer">Your answer</Label>
                  <Input id="securityAnswer" name="securityAnswer" type="text" autoComplete="off" placeholder="Answer" required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <PasswordInput id="newPassword" name="newPassword" required autoComplete="new-password" minLength={8} />
                  <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <PasswordInput id="confirmPassword" name="confirmPassword" required autoComplete="off" minLength={8} />
                </div>
                {error && <p role="alert" className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Resetting…' : 'Reset password & sign in'}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { setUsernameStep('login'); setError(null); }}>
                  ← Back to sign in
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
    <div className="min-h-screen flex items-center justify-center dashboard-main-shell px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight solupair-text-gradient">Solupair</CardTitle>
          <CardDescription>Login to your dashboard</CardDescription>
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
