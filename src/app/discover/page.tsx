import { DiscoverFeed } from '@/components/DiscoverFeed';

export const metadata = {
  title: 'Discover',
};

export default function DiscoverPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-6">
      <h1 className="sticky top-24 z-20 bg-white py-6 text-2xl font-bold text-zinc-900 md:top-14 dark:bg-zinc-900 dark:text-zinc-100">
        Discover
      </h1>
      <DiscoverFeed />
    </div>
  );
}
