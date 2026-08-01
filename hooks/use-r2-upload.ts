"use client"

import * as React from "react"

export function useR2Upload() {
  const [isUploading, setIsUploading] = React.useState(false)

  async function upload(file: File): Promise<string> {
    setIsUploading(true)
    try {
      const presignedRes = await fetch("/api/r2/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      })
      if (!presignedRes.ok) throw new Error("Failed to get upload URL")
      const { presignedUrl, publicUrl } = await presignedRes.json()

      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error("Upload failed")

      return publicUrl as string
    } finally {
      setIsUploading(false)
    }
  }

  return { upload, isUploading }
}
