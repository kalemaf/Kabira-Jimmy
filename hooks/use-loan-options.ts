"use client"

import { useQuery } from "@tanstack/react-query"
import type { SearchableSelectOption } from "@/components/searchable-select"

type Loan = {
  id: string
  principal: number
  member: { firstName: string; lastName: string; memberNumber: string }
}

export function useLoanOptions() {
  const { data, isLoading } = useQuery({
    queryKey: ["loans", "options"],
    queryFn: async () => {
      const res = await fetch("/api/loans?limit=50")
      if (!res.ok) throw new Error("Failed to load loans")
      return res.json() as Promise<{ data: Loan[] }>
    },
    staleTime: 15_000,
  })

  const options: SearchableSelectOption[] = (data?.data ?? []).map((l) => ({
    value: l.id,
    label: `${l.member.firstName} ${l.member.lastName}`,
    description: l.member.memberNumber,
  }))

  return { options, isLoading }
}
