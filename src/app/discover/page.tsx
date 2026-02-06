import { DiscoverFeed } from '@/components/DiscoverFeed';
import { ScrollAwarePageShell } from '@/components/ScrollAwarePageShell';

export const metadata = {
  title: 'Discover',
};

export default function DiscoverPage() {
  return (
    <ScrollAwarePageShell>
      <DiscoverFeed />
    </ScrollAwarePageShell>
  );
}
