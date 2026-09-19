"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadState } from "@/lib/storage";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const state = loadState();
    if (state.currentBatch) {
      router.replace("/dashboard");
    } else {
      router.replace("/upload");
    }
  }, [router]);

  if (!mounted) return null;

  return null;
}

