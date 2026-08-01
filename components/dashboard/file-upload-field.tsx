"use client"

import * as React from "react"
import { toast } from "sonner"
import { Upload, FileCheck, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useR2Upload } from "@/hooks/use-r2-upload"

export function FileUploadField({
  label,
  value,
  onChange,
  accept = "image/*,application/pdf",
  description,
}: {
  label: string
  value?: string
  onChange: (url: string | undefined) => void
  accept?: string
  description?: string
}) {
  const { upload, isUploading } = useR2Upload()
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    try {
      const url = await upload(file)
      onChange(url)
    } catch {
      toast.error(`Failed to upload ${label.toLowerCase()}`)
    }
  }

  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-(--text-secondary)">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="flex items-center justify-between rounded-sm border border-(--border-subtle) bg-(--bg-card) px-3.5 py-2.5">
          <span className="flex items-center gap-2 truncate text-sm text-(--text-primary)">
            <FileCheck className="size-4 shrink-0 text-(--success-600)" />
            <span className="truncate">Uploaded</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(undefined)}
            aria-label={`Remove ${label}`}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="flex h-[42px] w-full items-center justify-center gap-2 rounded-sm border border-dashed border-(--border-strong) bg-(--bg-input) text-sm text-(--text-secondary) transition-colors hover:bg-(--bg-card-hover) disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {isUploading ? "Uploading..." : "Click to upload"}
        </button>
      )}
      {description ? <p className="mt-1 text-xs text-(--text-secondary)">{description}</p> : null}
    </div>
  )
}
