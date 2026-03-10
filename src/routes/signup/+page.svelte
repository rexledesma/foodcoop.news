<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import SignUpForm from '@/components/SignUpForm.svelte';
  import { signUp } from '@/lib/auth-client';
  import { getNextPathname, resolveAuthDestination, withNextParam } from '@/lib/auth-redirect';

  const channel = `signup-${Math.random().toString(36).slice(2)}`;

  let state = {
    email: '',
    password: '',
    confirmPassword: '',
    error: '',
    loading: false,
    showIntegrationsPrompt: false,
    signinHref: '/login',
    onEmailChange: (value: string) : void => {
      state = { ...state, email: value };
      dispatchState();
    },
    onPasswordChange: (value: string) : void => {
      state = { ...state, password: value };
      dispatchState();
    },
    onConfirmPasswordChange: (value: string) : void => {
      state = { ...state, confirmPassword: value };
      dispatchState();
    },
    onSubmit: async () : Promise<void> => {
      state = { ...state, error: '' };

      if (state.password !== state.confirmPassword) {
        state = { ...state, error: 'Passwords do not match' };
        dispatchState();
        return;
      }

      if (state.password.length < 8) {
        state = { ...state, error: 'Password must be at least 8 characters' };
        dispatchState();
        return;
      }

      state = { ...state, loading: true };
      dispatchState();

      try {
        const result = await signUp.email({
          email: state.email,
          password: state.password,
          name: ' ',
        });

        if (result.error) {
          state = { ...state, error: result.error.message || 'Failed to create account', loading: false };
          dispatchState();
          return;
        }

        await goto(resolveAuthDestination(get(page).url.searchParams.get('next')));
      } catch {
        state = { ...state, error: 'An unexpected error occurred', loading: false };
        dispatchState();
      }
    },
  };

  const initialState = state;

  function dispatchState() : void {
    window.dispatchEvent(new CustomEvent(`signup-form-state:update:${channel}`, { detail: state }));
  }

  onMount(() : void => {
    const next = get(page).url.searchParams.get('next');
    state = {
      ...state,
      email: get(page).url.searchParams.get('email') ?? '',
      showIntegrationsPrompt: getNextPathname(next) === '/integrations',
      signinHref: withNextParam('/login', next),
    };
    dispatchState();
  });
</script>

<SignUpForm {channel} {initialState} />
