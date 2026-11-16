"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the board every 2 minutes so it stays live without a manual reload.
export default function AutoRefresh({ seconds = 120 }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
