"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { SearchResult } from "@/app/api/search/route"

export function GlobalSearch() {
  const router = useRouter()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [query, setQuery] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`)
      if (!res.ok) throw new Error("Search failed")
      return res.json() as Promise<{ data: SearchResult[] }>
    },
    enabled: debounced.length >= 2,
  })

  const showDropdown = open && debounced.length >= 2

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-(--text-muted)" />
      <Input
        placeholder="Search members, loans, payments"
        className="h-10 w-72 rounded-full pl-10"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {isFetching ? (
        <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-(--text-muted)" />
      ) : null}

      {showDropdown ? (
        <div
          className={cn(
            "absolute top-full left-0 z-50 mt-2 w-full overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card) shadow-[var(--shadow-md)]"
          )}
        >
          {!data || data.data.length === 0 ? (
            <p className="p-3 text-sm text-(--text-secondary)">{isFetching ? "Searching..." : "No results"}</p>
          ) : (
            <div className="max-h-80 overflow-y-auto p-1">
              {data.data.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    router.push(r.href)
                    setOpen(false)
                    setQuery("")
                  }}
                  className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors hover:bg-(--bg-card-hover)"
                >
                  <span className="text-sm text-(--text-primary)">{r.label}</span>
                  <span className="text-xs text-(--text-secondary)">
                    {r.type} · {r.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
