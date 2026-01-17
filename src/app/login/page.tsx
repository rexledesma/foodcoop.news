"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get("redirect") || "/";

  const handleSuccess = () => {
    router.push(redirect);
  };

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <LoginForm onSuccess={handleSuccess} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 max-w-2xl mx-auto">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
