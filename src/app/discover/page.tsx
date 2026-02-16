import { DiscoverFeed } from '@/components/DiscoverFeed';

export const metadata = {
  title: 'Discover',
  description: 'Browse the latest Park Slope Food Coop news, events, and updates in one feed.',
  openGraph: {
    title: 'Discover · foodcoop.news',
    description: 'Browse the latest Park Slope Food Coop news, events, and updates in one feed.',
  },
};

export default function DiscoverPage() {
  return <DiscoverFeed />;
}
