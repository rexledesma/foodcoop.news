<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import LoginForm from '@/components/LoginForm.svelte';
  import { signIn } from '@/lib/auth-client';
  import { resolveAuthDestination, withNextParam } from '@/lib/auth-redirect';

  const channel = `login-${Math.random().toString(36).slice(2)}`;

  let state = {
    email: '',
    password: '',
    error: '',
    loading: false,
    step: 'email' as 'email' | 'password',
    checkingEmail: false,
    signupHref: '/signup',
    onEmailChange: (value: string) : void => {
      state = { ...state, email: value };
      dispatchState();
    },
    onPasswordChange: (value: string) : void => {
      state = { ...state, password: value };
      dispatchState();
    },
    onEmailSubmit: async () : Promise<void> => {
      state = { ...state, error: '' };
      if (!state.email) {
        state = { ...state, error: 'Please enter your email' };
        dispatchState();
        return;
      }

      state = { ...state, checkingEmail: true };
      dispatchState();

      try {
        const response = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: state.email }),
        });

        if (!response.ok) {
          throw new Error('Failed to check email');
        }

        const result = (await response.json()) as { exists: boolean };
        if (result.exists) {
          state = { ...state, step: 'password' };
          dispatchState();
          return;
        }

        const params = new URLSearchParams({ email: state.email });
        const next = get(page).url.searchParams.get('next');
        await goto(withNextParam(`/signup?${params.toString()}`, next));
      } catch {
        state = { ...state, error: 'Failed to check email. Please try again.' };
      } finally {
        state = { ...state, checkingEmail: false };
        dispatchState();
      }
    },
    onPasswordSubmit: async () : Promise<void> => {
      state = { ...state, error: '', loading: true };
      dispatchState();

      try {
        const result = await signIn.email({
          email: state.email,
          password: state.password,
        });

        if (result.error) {
          state = {
            ...state,
            error: result.error.message || 'Failed to sign in',
            loading: false,
          };
          dispatchState();
          return;
        }

        await goto(resolveAuthDestination(get(page).url.searchParams.get('next')));
      } catch {
        state = { ...state, error: 'An unexpected error occurred', loading: false };
        dispatchState();
      }
    },
    onBack: () : void => {
      state = { ...state, step: 'email', password: '', error: '' };
      dispatchState();
    },
  };

  const initialState = state;

  function dispatchState() : void {
    window.dispatchEvent(new CustomEvent(`login-form-state:update:${channel}`, { detail: state }));
  }

  onMount(() : void => {
    state = {
      ...state,
      signupHref: withNextParam('/signup', get(page).url.searchParams.get('next')),
    };
    dispatchState();
  });
</script>

<LoginForm {channel} {initialState} />
