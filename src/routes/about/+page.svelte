<script lang="ts">
  import AboutPage from '@/components/about/AboutPage.svelte';

  let { data }: { data: { starCountLabel: string } } = $props();
</script>

<AboutPage starCountLabel={data.starCountLabel} />
