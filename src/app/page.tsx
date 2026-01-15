"use client";

import { useState, useEffect } from "react";
import { MemberCard } from "@/components/MemberCard";
import { LoginForm } from "@/components/LoginForm";
import type { Member } from "@/lib/types";

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth");
      const data = await response.json();

      if (data.authenticated && data.member) {
        setAuthenticated(true);
        setMember(data.member);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      {authenticated && member ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
          <MemberCard member={member} />
        </div>
      ) : (
        <LoginForm onSuccess={checkAuth} />
      )}
    </div>
  );
}
