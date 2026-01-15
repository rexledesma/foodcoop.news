"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
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
