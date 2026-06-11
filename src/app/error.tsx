"use client";

import { ErrorCard } from "@/components/error-card";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorCard error={error} retry={unstable_retry} />;
}
