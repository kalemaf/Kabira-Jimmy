"use client"

import { useQuery } from "@tanstack/react-query"
import type { SearchableSelectOption } from "@/components/searchable-select"

export type LoanProductOption = {
  id: string
  name: string
  interestRate: number
  minAmount: number
  maxAmount: number
  repaymentPeriodMonths: number
  interestMethod: string;
  penaltyRate: number;
  processingFee: number;
  insuranceFee: number;
  serviceCharge: number;
};

export function useLoanProductOptions() {
  const { data, isLoading } = useQuery({
    queryKey: ["loan-products", "options"],
    queryFn: async () => {
      const res = await fetch("/api/loan-products?limit=50")
      if (!res.ok) throw new Error("Failed to load loan products")
      return res.json() as Promise<{ data: LoanProductOption[] }>
    },
    staleTime: 60_000,
  })

  const options: SearchableSelectOption[] = (data?.data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
    description: `${p.interestRate}% · ${p.repaymentPeriodMonths}mo`,
  }))

  return { options, isLoading, products: data?.data ?? [] }
}
