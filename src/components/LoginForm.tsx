'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useConvex } from 'convex/react';
import SvelteMount from '@/components/SvelteMount';
import LoginFormView from '@/components/LoginForm.svelte';
import { signIn } from '@/lib/auth-client';
import { resolveAuthDestination, withNextParam } from '@/lib/auth-redirect';
import { api } from '../../convex/_generated/api';

type LoginStep = 'email' | 'password';

type LoginFormClientState = {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  step: LoginStep;
  checkingEmail: boolean;
  signupHref: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onEmailSubmit: () => Promise<void>;
  onPasswordSubmit: () => Promise<void>;
  onBack: () => void;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const convex = useConvex();
  const nextPath = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginStep>('email');
  const [checkingEmail, setCheckingEmail] = useState(false);

  const channelRef = useRef<string>(`login-form-${Math.random().toString(36).slice(2)}`);

  const onEmailSubmit = useCallback(async () => {
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
        const params = new URLSearchParams({ email });
        const signupHref = withNextParam(`/signup?${params.toString()}`, nextPath);
        router.push(signupHref);
      }
    } catch {
      setError('Failed to check email. Please try again.');
    } finally {
      setCheckingEmail(false);
    }
  }, [email, convex, nextPath, router]);

  const onPasswordSubmit = useCallback(async () => {
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

      router.push(resolveAuthDestination(nextPath));
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  }, [email, password, nextPath, router]);

  const state = useMemo<LoginFormClientState>(
    () => ({
      email,
      password,
      error,
      loading,
      step,
      checkingEmail,
      signupHref: withNextParam('/signup', nextPath),
      onEmailChange: setEmail,
      onPasswordChange: setPassword,
      onEmailSubmit,
      onPasswordSubmit,
      onBack: () => {
        setStep('email');
        setPassword('');
        setError('');
      },
    }),
    [
      email,
      password,
      error,
      loading,
      step,
      checkingEmail,
      nextPath,
      onEmailSubmit,
      onPasswordSubmit,
    ],
  );

  const initialStateRef = useRef(state);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(`login-form-state:update:${channelRef.current}`, {
        detail: state,
      }),
    );
  }, [state]);

  const props = useMemo(
    () => ({
      channel: channelRef.current,
      initialState: initialStateRef.current,
    }),
    [],
  );

  return <SvelteMount component={LoginFormView} props={props} />;
}
