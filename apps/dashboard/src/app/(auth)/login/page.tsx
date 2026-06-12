import { Suspense } from 'react';
import { LoginForm, LoginPageSkeleton } from './login-form';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
