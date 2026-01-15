import { FeedList } from "@/components/FeedList";

export default function FeedPage() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Feed
      </h1>
      <FeedList />
    </div>
  );
}
