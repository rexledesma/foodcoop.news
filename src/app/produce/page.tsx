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
    return {
      title: name,
      description,
      openGraph: {
        title: name,
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
    return { title: `Produce (${formatted})` };
  }

  return { title: 'Produce' };
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
