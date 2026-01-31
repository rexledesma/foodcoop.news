"use client";

import dynamic from "next/dynamic";

const ProduceAnalytics = dynamic(
  () => import("@/components/ProduceAnalytics").then((mod) => mod.ProduceAnalytics),
  { ssr: false }
);

export function ProducePageClient() {
  return <ProduceAnalytics />;
}
