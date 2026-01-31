import { ProducePageClient } from "./client";

export const metadata = {
  title: "Produce",
};

export default function ProducePage() {
  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Produce
      </h1>
      <ProducePageClient />
    </div>
  );
}
