'use client';

import { useRouter } from 'next/navigation';

export default function RefreshButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.refresh()}
      className="btn btn-secondary text-xs"
      title="Refresh"
    >
      Refresh
    </button>
  );
}
