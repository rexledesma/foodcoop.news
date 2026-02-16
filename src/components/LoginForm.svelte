<script lang="ts">
  import { onMount } from 'svelte';

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

  let {
    channel,
    initialState,
  }: {
    channel: string;
    initialState: LoginFormClientState;
  } = $props();

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let step = $state<LoginStep>('email');
  let checkingEmail = $state(false);
  let signupHref = $state('/signup');

  let onEmailChange = $state<(value: string) => void>(() => {});
  let onPasswordChange = $state<(value: string) => void>(() => {});
  let onEmailSubmit = $state<() => Promise<void>>(async () => {});
  let onPasswordSubmit = $state<() => Promise<void>>(async () => {});
  let onBack = $state<() => void>(() => {});

  function applyState(next: LoginFormClientState) {
    email = next.email;
    password = next.password;
    error = next.error;
    loading = next.loading;
    step = next.step;
    checkingEmail = next.checkingEmail;
    signupHref = next.signupHref;
    onEmailChange = next.onEmailChange;
    onPasswordChange = next.onPasswordChange;
    onEmailSubmit = next.onEmailSubmit;
    onPasswordSubmit = next.onPasswordSubmit;
    onBack = next.onBack;
  }

  function handleStateUpdate(event: Event) {
    if (!(event instanceof CustomEvent)) return;
    applyState(event.detail as LoginFormClientState);
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

  async function handleEmailSubmit(event: SubmitEvent) {
    event.preventDefault();
    await onEmailSubmit();
  }

  async function handlePasswordSubmit(event: SubmitEvent) {
    event.preventDefault();
    await onPasswordSubmit();
  }

  onMount(() => {
    applyState(initialState);

    const handler = (event: Event) => handleStateUpdate(event);
    window.addEventListener(`login-form-state:update:${channel}`, handler as EventListener);

    return () => {
      window.removeEventListener(`login-form-state:update:${channel}`, handler as EventListener);
    };
  });
</script>

<div class="mx-auto max-w-3xl px-4 py-6">
  <h1 class="mb-6 text-2xl font-bold text-zinc-900">Sign In</h1>

  {#if step === 'email'}
    <form onsubmit={handleEmailSubmit} class="mx-auto max-w-sm space-y-4">
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

      <button
        type="submit"
        disabled={checkingEmail}
        class="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:bg-green-400"
      >
        {checkingEmail ? 'Checking...' : 'Continue'}
      </button>
    </form>
  {:else}
    <form onsubmit={handlePasswordSubmit} class="mx-auto max-w-sm space-y-4">
      {#if error}
        <div class="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      {/if}

      <div>
        <div class="mb-1 flex items-center justify-between">
          <label for="email-display" class="block text-sm font-medium text-zinc-700">Email</label>
          <button type="button" onclick={onBack} class="text-sm text-green-600 hover:underline">
            Change
          </button>
        </div>
        <div id="email-display" class="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600">
          {email}
        </div>
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
          placeholder="Enter your password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:bg-green-400"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  {/if}

  <p class="mx-auto mt-4 max-w-sm text-center text-sm text-zinc-600">
    First time here?
    <a href={signupHref} class="text-green-600 hover:underline">Create account</a>
  </p>
</div>
