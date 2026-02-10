import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProducePageClient } from './client';
import { ScrollAwarePageShell } from '@/components/ScrollAwarePageShell';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const date = typeof params.date === 'string' ? params.date : undefined;
  const nameParam = typeof params.name === 'string' ? params.name : undefined;
  const name = nameParam?.trim() || undefined;

  if (name) {
    const description = `Track price and availability trends for ${name} at the Park Slope Food Coop.`;
    const openGraphTitle = `${name} · foodcoop.news`;
    return {
      title: name,
      description,
      openGraph: {
        title: openGraphTitle,
        description,
      },
    };
  }

  if (date) {
    const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const title = `Produce (${formatted})`;
    const description = `See produce prices and availability at the Park Slope Food Coop for ${formatted}.`;
    const openGraphTitle = `${title} · foodcoop.news`;
    return {
      title,
      description,
      openGraph: {
        title: openGraphTitle,
        description,
      },
    };
  }

  const title = 'Produce';
  const description = 'Explore Park Slope Food Coop produce pricing and availability trends.';
  const openGraphTitle = `${title} · foodcoop.news`;
  return {
    title,
    description,
    openGraph: {
      title: openGraphTitle,
      description,
    },
  };
}

export default function ProducePage() {
  return (
    <ScrollAwarePageShell>
      <Suspense>
        <ProducePageClient />
      </Suspense>
    </ScrollAwarePageShell>
  );
}
