import { Suspense } from 'react';
import { SignUpForm } from '@/components/SignUpForm';

export const metadata = {
  title: 'Sign Up',
  description: 'Create your foodcoop.news account to save preferences and Coop member tools.',
  openGraph: {
    title: 'Sign Up · foodcoop.news',
    description: 'Create your foodcoop.news account to save preferences and Coop member tools.',
  },
};

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
