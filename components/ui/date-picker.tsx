"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  fromYear = 1940,
  toYear = new Date().getFullYear(),
}: {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: (date: Date) => boolean
  fromYear?: number
  toYear?: number
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-[42px] w-full justify-start rounded-sm border-(--border-subtle) px-3.5 font-normal",
              !value && "text-(--text-muted)"
            )}
          />
        }
      >
        <CalendarIcon className="size-4 text-(--text-muted)" strokeWidth={1.75} />
        {value ? format(value, "PPP") : <span>{placeholder}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={disabled}
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
