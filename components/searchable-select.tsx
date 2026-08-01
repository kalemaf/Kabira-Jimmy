"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

// Registry Searchable Select (jb.desishub.com) is currently broken (its
// manifest references an unresolvable dependency). This is the documented
// master_prompt.md fallback: a Combobox built from Popover + Command.

export type SearchableSelectOption = {
  value: string
  label: string
  description?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results.",
  disabled,
  className,
}: {
  options: SearchableSelectOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-[42px] w-full items-center justify-between rounded-sm border border-(--border-subtle) bg-(--bg-input) px-3.5 text-sm text-(--text-primary) transition-colors outline-none disabled:cursor-not-allowed disabled:bg-(--bg-card) disabled:text-(--text-muted)",
          open && "border-(--accent-500) shadow-[var(--shadow-focus)]",
          !selected && "text-(--text-muted)",
          className
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-(--text-muted)" strokeWidth={1.75} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-[220px] p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label || option.value}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description ? (
                      <span className="text-xs text-(--text-secondary)">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
