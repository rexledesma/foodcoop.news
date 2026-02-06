import { ProducePageClient } from './client';
import { ScrollAwarePageShell } from '@/components/ScrollAwarePageShell';

export const metadata = {
  title: 'Produce',
};

export default function ProducePage() {
  return (
    <ScrollAwarePageShell>
      <ProducePageClient />
    </ScrollAwarePageShell>
  );
}
