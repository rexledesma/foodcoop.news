<script lang="ts">
  import { onMount } from 'svelte';

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

  let {
    channel,
    initialState,
  }: {
    channel: string;
    initialState: SignUpFormClientState;
  } = $props();

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let loading = $state(false);
  let showIntegrationsPrompt = $state(false);
  let signinHref = $state('/login');

  let onEmailChange = $state<(value: string) => void>(() => {});
  let onPasswordChange = $state<(value: string) => void>(() => {});
  let onConfirmPasswordChange = $state<(value: string) => void>(() => {});
  let onSubmit = $state<() => Promise<void>>(async () => {});

  function applyState(next: SignUpFormClientState) {
    email = next.email;
    password = next.password;
    confirmPassword = next.confirmPassword;
    error = next.error;
    loading = next.loading;
    showIntegrationsPrompt = next.showIntegrationsPrompt;
    signinHref = next.signinHref;
    onEmailChange = next.onEmailChange;
    onPasswordChange = next.onPasswordChange;
    onConfirmPasswordChange = next.onConfirmPasswordChange;
    onSubmit = next.onSubmit;
  }

  function handleStateUpdate(event: Event) {
    if (!(event instanceof CustomEvent)) return;
    applyState(event.detail as SignUpFormClientState);
  }

  function handleEmailInput(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    onEmailChange(target.value);
  }

  function handlePasswordInput(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    onPasswordChange(target.value);
  }

  function handleConfirmPasswordInput(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    onConfirmPasswordChange(target.value);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    await onSubmit();
  }

  onMount(() => {
    applyState(initialState);

    const handler = (event: Event) => handleStateUpdate(event);
    window.addEventListener(`signup-form-state:update:${channel}`, handler as EventListener);

    return () => {
      window.removeEventListener(`signup-form-state:update:${channel}`, handler as EventListener);
    };
  });
</script>

<div class="mx-auto max-w-3xl px-4 py-6">
  <h1 class="mb-6 text-2xl font-bold text-zinc-900">Create Account</h1>

  <form onsubmit={handleSubmit} class="mx-auto max-w-sm space-y-4">
    {#if showIntegrationsPrompt}
      <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Create an account to save changes, add wallet passes, and subscribe to the shift calendar.
      </div>
    {/if}

    {#if error}
      <div class="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
    {/if}

    <div>
      <label for="email" class="mb-1 block text-sm font-medium text-zinc-700">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        oninput={handleEmailInput}
        required
        class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
        placeholder="you@example.com"
      />
    </div>

    <div>
      <label for="password" class="mb-1 block text-sm font-medium text-zinc-700">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        oninput={handlePasswordInput}
        required
        class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
        placeholder="••••••••"
      />
    </div>

    <div>
      <label for="confirmPassword" class="mb-1 block text-sm font-medium text-zinc-700">
        Confirm Password
      </label>
      <input
        id="confirmPassword"
        type="password"
        value={confirmPassword}
        oninput={handleConfirmPasswordInput}
        required
        class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
        placeholder="••••••••"
      />
    </div>

    <button
      type="submit"
      disabled={loading}
      class="w-full rounded-lg bg-black px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-800 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 focus:outline-none disabled:bg-zinc-400"
    >
      {loading ? 'Creating account...' : 'Create Account'}
    </button>
  </form>

  <p class="mx-auto mt-4 max-w-sm text-center text-sm text-zinc-600">
    Already have an account?
    <a href={signinHref} class="text-green-600 hover:underline">Sign in</a>
  </p>
</div>
