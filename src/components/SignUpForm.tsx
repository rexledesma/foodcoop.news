'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SvelteMount from '@/components/SvelteMount';
import SignUpFormView from '@/components/SignUpForm.svelte';
import { signUp } from '@/lib/auth-client';
import { getNextPathname, resolveAuthDestination, withNextParam } from '@/lib/auth-redirect';

type SignUpFormClientState = {
  email: string;
  password: string;
  confirmPassword: string;
  error: string;
  loading: boolean;
  showIntegrationsPrompt: boolean;
  signinHref: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => Promise<void>;
};

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const channelRef = useRef<string>(`signup-form-${Math.random().toString(36).slice(2)}`);

  const onSubmit = useCallback(async () => {
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name: ' ',
      });

      if (result.error) {
        setError(result.error.message || 'Failed to create account');
        setLoading(false);
        return;
      }

      router.push(resolveAuthDestination(nextPath));
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  }, [email, password, confirmPassword, nextPath, router]);

  const state = useMemo<SignUpFormClientState>(
    () => ({
      email,
      password,
      confirmPassword,
      error,
      loading,
      showIntegrationsPrompt: getNextPathname(nextPath) === '/integrations',
      signinHref: withNextParam('/login', nextPath),
      onEmailChange: setEmail,
      onPasswordChange: setPassword,
      onConfirmPasswordChange: setConfirmPassword,
      onSubmit,
    }),
    [email, password, confirmPassword, error, loading, nextPath, onSubmit],
  );

  const initialStateRef = useRef(state);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(`signup-form-state:update:${channelRef.current}`, {
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

  return <SvelteMount component={SignUpFormView} props={props} />;
}
