import { Suspense } from "react";
import { MemberDepositClient } from "@/components/member-portal/member-deposit-client";

export default function MemberDepositPage() {
  return (
    <main className="flex-1 px-4 py-8 md:px-8">
      <h1 className="mb-6 text-[20px] font-semibold text-(--text-primary)">Deposit money</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />}>
        <MemberDepositClient />
      </Suspense>
    </main>
  );
}
