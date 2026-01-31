'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

export default function Home() {
  const router = useRouter();
  const { isPending } = useSession();

  useEffect(() => {
    if (!isPending) {
      router.replace('/discover');
    }
  }, [isPending, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-zinc-400">Loading...</div>
    </div>
  );
}
