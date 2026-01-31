import { Suspense } from 'react';
import { SignUpForm } from '@/components/SignUpForm';

export const metadata = {
  title: 'Sign Up',
};

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
