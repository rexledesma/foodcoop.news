import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';

export const metadata = {
  title: 'Login',
  description: 'Log in to foodcoop.news to personalize your Park Slope Food Coop experience.',
  openGraph: {
    title: 'Login · foodcoop.news',
    description: 'Log in to foodcoop.news to personalize your Park Slope Food Coop experience.',
  },
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
