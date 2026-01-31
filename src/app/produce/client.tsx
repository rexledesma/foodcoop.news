"use client";

import dynamic from "next/dynamic";
import { useProduceDataContext } from "@/lib/produce-data-context";

const ProduceAnalytics = dynamic(
  () => import("@/components/ProduceAnalytics").then((mod) => mod.ProduceAnalytics),
  { ssr: false }
);

export function ProducePageClient() {
  const { data, isLoading, error } = useProduceDataContext();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-500 dark:text-zinc-400">Loading produce data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return <ProduceAnalytics data={data} />;
}
