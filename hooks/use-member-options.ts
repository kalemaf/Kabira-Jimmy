"use client"

import { useQuery } from "@tanstack/react-query"
import type { SearchableSelectOption } from "@/components/searchable-select"

type Member = { id: string; firstName: string; lastName: string; memberNumber: string; phone: string }

export function useMemberOptions(search: string = "") {
  const { data, isLoading } = useQuery({
    queryKey: ["members", "options", search],
    queryFn: async () => {
      const url = new URL("/api/members", window.location.origin)
      url.searchParams.set("limit", "50")
      url.searchParams.set("status", "Active")
      if (search) url.searchParams.set("search", search)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load members")
      return res.json() as Promise<{ data: Member[] }>
    },
    staleTime: 30_000,
  })

  const options: SearchableSelectOption[] = (data?.data ?? []).map((m) => ({
    value: m.id,
    label: `${m.firstName} ${m.lastName}`,
    description: `${m.memberNumber} · ${m.phone}`,
  }))

  return { options, isLoading, members: data?.data ?? [] }
}
