<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  const INSTALL_INTENT_STORAGE_KEY = 'foodcoop:show-pwa-install';

  onMount(() : void => {
    sessionStorage.setItem(INSTALL_INTENT_STORAGE_KEY, 'true');
    void goto('/', { replaceState: true, keepFocus: true, noScroll: true });
  });
</script>
