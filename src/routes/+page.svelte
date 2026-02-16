<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    void goto('/discover', { replaceState: true });
  });
</script>

<div class="flex min-h-screen items-center justify-center">
  <div class="animate-pulse text-zinc-400">Loading...</div>
</div>
