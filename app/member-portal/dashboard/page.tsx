import Image from "next/image";
import { memberAuth } from "@/lib/member-auth";
import { db } from "@/lib/db";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { headers } from "next/headers";
import { LinkAccountForm } from "@/components/member-portal/link-account-form";
import { MemberDashboardClient } from "@/components/member-portal/member-dashboard-client";
import { StatusBadge } from "@/components/status-badge";
import { ShieldCheck, User } from "lucide-react";

export default async function MemberDashboardPage() {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  const memberId = await getLinkedMemberId(session!.user.id);

  if (!memberId) {
    return (
      <main className="flex-1 px-4 py-10 md:px-8 md:py-16">
        <div className="mx-auto grid max-w-[1000px] grid-cols-1 overflow-hidden rounded-[1.375rem] border border-(--border-subtle) bg-(--bg-card) shadow-[var(--shadow-xl)] lg:grid-cols-2">
          <div className="relative hidden min-h-[420px] lg:block">
            <Image src="/display.png" alt="" fill sizes="500px" priority className="object-cover object-right" />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.55) 65%, rgba(10,10,10,0.85) 100%)" }}
            />
            <div className="relative flex h-full flex-col justify-between p-8">
              <span className="text-[24px] font-bold tracking-[-0.01em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
                nexcgen
              </span>
              <div>
                <h2 className="text-[24px] leading-[1.2] font-bold text-white">
                  Almost there, {session!.user.name.split(" ")[0]}.
                </h2>
                <p className="mt-2 max-w-xs text-sm leading-[1.6] text-white/85">
                  Link your member number to unlock your savings, loans, and repayment history.
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-white/90">
                  <ShieldCheck className="size-4" strokeWidth={1.75} />
                  Verified against your branch records
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center p-8 md:p-10">
            <span className="relative mb-6 block size-14 overflow-hidden rounded-2xl shadow-[var(--shadow-sm)] lg:hidden">
              <Image src="/nexcgen.png" alt="Nexcgen" fill sizes="56px" priority className="object-cover object-top" />
            </span>
            <p className="text-[13px] font-semibold tracking-[0.04em] text-(--accent-500) uppercase">
              Welcome
            </p>
            <h1 className="mt-1 text-[22px] font-semibold text-(--text-primary)">
              Signed in as {session!.user.name}
            </h1>
            <p className="mt-1 text-sm text-(--text-secondary)">
              One more step — link this login to your member record to see your savings and loans.
            </p>
            <div className="mt-6">
              <LinkAccountForm />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { firstName: true, lastName: true, memberNumber: true, status: true, photoUrl: true },
  });

  const now = new Date();

  return (
    <main className="flex-1 px-4 py-6 md:px-8">
      <div className="relative mb-6 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
        <span className="bg-brand-gradient absolute inset-x-0 top-0 h-1" aria-hidden="true" />
        <div className="flex items-center gap-4">
          {member?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.photoUrl} alt={`${member.firstName} ${member.lastName}`} className="size-14 rounded-full border-2 border-(--accent-500) object-cover" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-(--accent-soft) text-(--brand-blue)">
              <User className="size-6" />
            </div>
          )}
          <div>
            <h1 className="text-[18px] font-semibold text-(--text-primary)">
              Welcome, {member?.firstName} {member?.lastName}
            </h1>
            <p className="text-sm text-(--text-secondary)">{member?.memberNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={member?.status ?? "Active"} />
          <span className="text-sm text-(--text-secondary)">
            {now.toLocaleDateString("en-UG", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            {" · "}
            {now.toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      <MemberDashboardClient />
    </main>
  );
}
