import { DiscoverFeed } from "@/components/DiscoverFeed";

export default function DiscoverPage() {
  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Discover
      </h1>
      <DiscoverFeed />
    </div>
  );
}
