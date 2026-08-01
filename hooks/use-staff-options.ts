"use client"

import { useQuery } from "@tanstack/react-query"
import type { SearchableSelectOption } from "@/components/searchable-select"

type Staff = { id: string; name: string | null; email: string }

/** Recovery Officers only, via the scoped /api/staff/recovery-officers endpoint. */
export function useRecoveryOfficerOptions() {
  const { data, isLoading } = useQuery({
    queryKey: ["staff", "recovery-officers"],
    queryFn: async () => {
      const res = await fetch("/api/staff/recovery-officers")
      if (!res.ok) throw new Error("Failed to load recovery officers")
      return res.json() as Promise<{ data: Staff[] }>
    },
    staleTime: 30_000,
  })

  const options: SearchableSelectOption[] = (data?.data ?? []).map((s) => ({
    value: s.id,
    label: s.name || s.email,
    description: s.email,
  }))

  return { options, isLoading }
}
