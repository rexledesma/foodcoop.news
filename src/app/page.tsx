"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending) {
      if (session) {
        router.replace("/discover");
      } else {
        router.replace("/login");
      }
    }
  }, [session, isPending, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-zinc-400">Loading...</div>
    </div>
  );
}
