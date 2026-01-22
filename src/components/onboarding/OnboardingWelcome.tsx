"use client";

interface OnboardingWelcomeProps {
  onContinue: () => void;
}

export function OnboardingWelcome({ onContinue }: OnboardingWelcomeProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">
          Set Up Your Digital Member Card
        </h1>
        <p className="text-zinc-400">
          Add your PSFC member card to your phone for easy access at checkout.
        </p>
      </div>

      <div className="bg-zinc-800/50 rounded-xl p-6 space-y-4">
        <h2 className="font-medium text-zinc-200">What you&apos;ll need:</h2>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-green-500"
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
            <span className="text-zinc-300">
              Your physical PSFC member card with the barcode visible
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg
                className="w-4 h-4 text-green-500"
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
            <span className="text-zinc-300">
              Good lighting to take a clear photo
            </span>
          </li>
        </ul>
      </div>

      <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
        <p className="text-zinc-400 text-sm">
          Don&apos;t have your card handy? You can also enter your member ID
          manually.
        </p>
      </div>

      <button
        onClick={onContinue}
        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}
