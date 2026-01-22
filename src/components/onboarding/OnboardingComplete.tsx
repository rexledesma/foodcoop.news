"use client";

import { useRouter } from "next/navigation";

interface OnboardingCompleteProps {
  memberName: string;
}

export function OnboardingComplete({ memberName }: OnboardingCompleteProps) {
  const router = useRouter();

  const handleContinue = () => {
    router.push("/discover");
  };

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-zinc-100">You&apos;re All Set!</h2>
        <p className="text-zinc-400">
          Welcome, {memberName}! Your digital member card has been created.
        </p>
      </div>

      <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
        <p className="text-zinc-400 text-sm">
          Apple Wallet integration coming soon. You&apos;ll be able to add your
          member card directly to your iPhone wallet.
        </p>
      </div>

      <button
        onClick={handleContinue}
        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
      >
        Continue to App
      </button>
    </div>
  );
}
