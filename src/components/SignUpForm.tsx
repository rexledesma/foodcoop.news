"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation } from "convex/react";
import { v4 as uuidv4 } from "uuid";
import { signUp } from "@/lib/auth-client";
import { api } from "../../convex/_generated/api";

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createMemberProfile = useMutation(api.memberProfiles.createMemberProfile);
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<{
    memberId: string;
    memberName: string;
  } | null>(null);

  // Create member profile after signup completes
  useEffect(() => {
    if (!pendingProfile) return;

    const createProfile = async () => {
      try {
        await createMemberProfile({
          memberId: pendingProfile.memberId,
          memberName: pendingProfile.memberName,
          passSerialNumber: uuidv4(),
        });
        router.push("/discover");
      } catch (err) {
        console.error("Failed to create profile:", err);
        setError("Failed to create member profile. Please try again.");
        setLoading(false);
        setPendingProfile(null);
      }
    };

    createProfile();
  }, [pendingProfile, createMemberProfile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    // Validate member ID (4-10 digits)
    const memberIdDigits = memberId.replace(/\D/g, "");
    if (memberIdDigits.length < 4 || memberIdDigits.length > 10) {
      setError("Member ID must be 4-10 digits");
      return;
    }

    // Normalize member ID to at least 6 digits
    const normalizedMemberId = memberIdDigits.padStart(6, "0");

    setLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        setError(result.error.message || "Failed to create account");
        setLoading(false);
        return;
      }

      // Set pending profile to trigger creation after auth is ready
      setPendingProfile({
        memberId: normalizedMemberId,
        memberName: name,
      });
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Create Account
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            placeholder="Your name"
          />
        </div>

        <div>
          <label
            htmlFor="memberId"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Member ID
          </label>
          <input
            id="memberId"
            type="text"
            inputMode="numeric"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            placeholder="Your PSFC member ID"
          />
        </div>

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
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            placeholder="you@example.com"
          />
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
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-green-600 dark:text-green-400 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
