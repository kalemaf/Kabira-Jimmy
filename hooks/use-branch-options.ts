"use client"

import { useQuery } from "@tanstack/react-query"
import type { SearchableSelectOption } from "@/components/searchable-select"

type Branch = { id: string; name: string; code: string }

export function useBranchOptions() {
  const { data, isLoading } = useQuery({
    queryKey: ["branches", "options"],
    queryFn: async () => {
      const res = await fetch("/api/branches?limit=100")
      if (!res.ok) throw new Error("Failed to load branches")
      return res.json() as Promise<{ data: Branch[] }>
    },
    staleTime: 60_000,
  })

  const options: SearchableSelectOption[] = (data?.data ?? []).map((b) => ({
    value: b.id,
    label: b.name,
    description: b.code,
  }))

  return { options, isLoading }
}
