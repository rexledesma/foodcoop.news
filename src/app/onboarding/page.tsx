"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { v4 as uuidv4 } from "uuid";
import { api } from "../../../convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { OnboardingWelcome } from "@/components/onboarding/OnboardingWelcome";
import { CardUploader } from "@/components/onboarding/CardUploader";
import { BarcodeScanner } from "@/components/onboarding/BarcodeScanner";
import { ManualEntryForm } from "@/components/onboarding/ManualEntryForm";
import { MemberConfirmation } from "@/components/onboarding/MemberConfirmation";
import { OnboardingComplete } from "@/components/onboarding/OnboardingComplete";

type OnboardingStep = "welcome" | "upload" | "manual" | "confirm" | "complete";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: isSessionLoading } = useSession();
  const hasCompletedOnboarding = useQuery(api.memberProfiles.hasCompletedOnboarding);
  const createMemberProfile = useMutation(api.memberProfiles.createMemberProfile);

  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [memberId, setMemberId] = useState("");
  const [memberName, setMemberName] = useState("");
  const [scanError, setScanError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { scanImage, isScanning } = BarcodeScanner({
    onScanSuccess: (id) => {
      setMemberId(id);
      setScanError("");
      setStep("confirm");
    },
    onScanError: (error) => {
      setScanError(error);
      setIsProcessing(false);
    },
  });

  const handleImageSelected = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setScanError("");
      await scanImage(file);
      setIsProcessing(false);
    },
    [scanImage]
  );

  const handleManualSubmit = useCallback((id: string) => {
    setMemberId(id);
    setStep("confirm");
  }, []);

  const handleConfirm = useCallback(
    async (confirmedMemberId: string, confirmedName: string) => {
      setIsSubmitting(true);
      try {
        await createMemberProfile({
          memberId: confirmedMemberId,
          memberName: confirmedName,
          passSerialNumber: uuidv4(),
        });
        setMemberName(confirmedName);
        setStep("complete");
      } catch (error) {
        console.error("Failed to create profile:", error);
        setScanError("Failed to save your profile. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [createMemberProfile]
  );

  // Show loading state while session is loading
  if (isSessionLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">Loading...</div>
      </div>
    );
  }

  // Redirect if not authenticated (only after session loading is complete)
  if (!session) {
    router.push("/login");
    return null;
  }

  // Show loading state while checking onboarding status
  // null = Convex auth not ready yet, undefined = query still loading
  if (hasCompletedOnboarding === undefined || hasCompletedOnboarding === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">Loading...</div>
      </div>
    );
  }

  // Redirect if already completed onboarding
  if (hasCompletedOnboarding === true) {
    router.push("/discover");
    return null;
  }

  // Get user name from session for pre-filling
  const userName = session?.user?.name || "";

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {step === "welcome" && (
          <OnboardingWelcome onContinue={() => setStep("upload")} />
        )}

        {step === "upload" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-zinc-100">
                Scan Your Member Card
              </h2>
              <p className="text-zinc-400 text-sm">
                Take a photo of the barcode on your PSFC member card.
              </p>
            </div>

            <CardUploader
              onImageSelected={handleImageSelected}
              isProcessing={isProcessing || isScanning}
            />

            {scanError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-400 text-sm">{scanError}</p>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-zinc-950 text-zinc-500">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep("manual")}
              className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Enter Member ID Manually
            </button>
          </div>
        )}

        {step === "manual" && (
          <ManualEntryForm
            onSubmit={handleManualSubmit}
            onCancel={() => setStep("upload")}
          />
        )}

        {step === "confirm" && (
          <MemberConfirmation
            memberId={memberId}
            initialName={userName}
            onConfirm={handleConfirm}
            onBack={() => setStep("upload")}
            isSubmitting={isSubmitting}
          />
        )}

        {step === "complete" && <OnboardingComplete memberName={memberName} />}
      </div>
    </div>
  );
}
