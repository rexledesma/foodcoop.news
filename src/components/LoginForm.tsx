"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConvex } from "convex/react";
import { signIn } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";

export function LoginForm() {
  const router = useRouter();
  const convex = useConvex();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"email" | "password">("email");
  const [checkingEmail, setCheckingEmail] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email");
      return;
    }

    setCheckingEmail(true);

    try {
      const result = await convex.query(api.auth.checkEmailExists, { email });

      if (result.exists) {
        setStep("password");
      } else {
        router.push(`/signup?email=${encodeURIComponent(email)}`);
      }
    } catch {
      setError("Failed to check email. Please try again.");
    } finally {
      setCheckingEmail(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Failed to sign in");
        setLoading(false);
        return;
      }

      router.push("/discover");
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setPassword("");
    setError("");
  };

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Sign In
      </h1>

      {step === "email" ? (
        <form onSubmit={handleEmailSubmit} className="space-y-4 max-w-sm mx-auto">
          {error && (
            <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={checkingEmail}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            {checkingEmail ? "Checking..." : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-sm mx-auto">
          {error && (
            <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="email-display"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email
              </label>
              <button
                type="button"
                onClick={handleBack}
                className="text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                Change
              </button>
            </div>
            <div className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
              {email}
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      )}

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto text-center">
        First time here?{" "}
        <Link
          href="/signup"
          className="text-green-600 dark:text-green-400 hover:underline"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
