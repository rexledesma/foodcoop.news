import { ProduceList } from "@/components/ProduceList";

export default function ProducePage() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Produce
      </h1>
      <ProduceList />
    </div>
  );
}
