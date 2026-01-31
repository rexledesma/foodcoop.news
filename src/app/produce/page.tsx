import { ProducePageClient } from "./client";

export const metadata = {
  title: "Produce Prices",
};

export default function ProducePage() {
  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        Produce Prices
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-6">
        Daily prices from Park Slope Food Coop
      </p>
      <ProducePageClient />
    </div>
  );
}
