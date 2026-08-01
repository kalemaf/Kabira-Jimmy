"use client"

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"

/**
 * Keeps page/search/filter state in the URL (so refresh and back/forward
 * preserve it) — the source-of-truth pattern master_prompt.md's server-side
 * pagination rule expects. Search is debounced 300ms before it hits the URL.
 */
export function useTableQuery(extraKeys: string[] = []) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const page = Number(searchParams.get("page") ?? "1")
  const urlSearch = searchParams.get("search") ?? ""
  const [search, setSearchLocal] = React.useState(urlSearch)

  const filters = React.useMemo(() => {
    const result: Record<string, string> = {}
    for (const key of extraKeys) result[key] = searchParams.get(key) ?? ""
    return result
  }, [searchParams, extraKeys]);

  const pushParams = React.useCallback(
    (next: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") params.delete(key)
        else params.set(key, String(value))
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== urlSearch) pushParams({ search, page: 1 })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return {
    page,
    search,
    setSearch: setSearchLocal,
    filters,
    setFilter: (key: string, value: string) => pushParams({ [key]: value, page: 1 }),
    setPage: (nextPage: number) => pushParams({ page: nextPage }),
  }
}
