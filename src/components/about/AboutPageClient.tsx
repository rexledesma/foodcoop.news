'use client';

import { useMemo } from 'react';

import SvelteMount from '@/components/SvelteMount';

import AboutPage from './AboutPage.svelte';

type AboutPageClientProps = {
  starCountLabel: string;
};

export default function AboutPageClient({ starCountLabel }: AboutPageClientProps) {
  const props = useMemo(
    () => ({
      starCountLabel,
    }),
    [starCountLabel],
  );

  return <SvelteMount component={AboutPage} props={props} />;
}
