import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';

export const metadata = {
  title: 'Login',
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
