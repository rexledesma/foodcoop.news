'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConvex } from 'convex/react';
import { signIn } from '@/lib/auth-client';
import { api } from '../../convex/_generated/api';

export function LoginForm() {
  const router = useRouter();
  const convex = useConvex();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [checkingEmail, setCheckingEmail] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email');
      return;
    }

    setCheckingEmail(true);

    try {
      const result = await convex.query(api.auth.checkEmailExists, { email });

      if (result.exists) {
        setStep('password');
      } else {
        router.push(`/signup?email=${encodeURIComponent(email)}`);
      }
    } catch {
      setError('Failed to check email. Please try again.');
    } finally {
      setCheckingEmail(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || 'Failed to sign in');
        setLoading(false);
        return;
      }

      router.push('/discover');
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setPassword('');
    setError('');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Sign In</h1>

      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="mx-auto max-w-sm space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-green-400"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={checkingEmail}
            className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:bg-green-400 dark:focus:ring-offset-zinc-900"
          >
            {checkingEmail ? 'Checking...' : 'Continue'}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="mx-auto max-w-sm space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="email-display"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email
              </label>
              <button
                type="button"
                onClick={handleBack}
                className="text-sm text-green-600 hover:underline dark:text-green-400"
              >
                Change
              </button>
            </div>
            <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              {email}
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-green-400"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:bg-green-400 dark:focus:ring-offset-zinc-900"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      )}

      <p className="mx-auto mt-4 max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400">
        First time here?{' '}
        <Link href="/signup" className="text-green-600 hover:underline dark:text-green-400">
          Create account
        </Link>
      </p>
    </div>
  );
}
