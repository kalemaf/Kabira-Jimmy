"use client"

import * as React from "react"
import { Camera, Upload, RotateCcw, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useR2Upload } from "@/hooks/use-r2-upload"

// Registry's camera-capture component is part of the same unreachable
// Advanced Form Elements set as PhoneInput/SignaturePad — hand-built
// getUserMedia fallback, mirroring master_prompt.md's documented pattern.

export function PhotoCapture({
  value,
  onChange,
  disabled,
}: {
  /** Public R2 URL of the captured/uploaded photo, or empty when unset. */
  value?: string
  onChange: (url: string | undefined) => void
  disabled?: boolean
}) {
  const [streaming, setStreaming] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { upload, isUploading } = useR2Upload()

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStreaming(false)
  }

  React.useEffect(() => stopStream, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      streamRef.current = stream
      setStreaming(true)
      // Video element mounts on next render; attach once available.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
    } catch {
      toast.error("Couldn't access the camera — check browser permissions, or upload a photo instead")
    }
  }

  async function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      stopStream()
      try {
        const file = new File([blob], `applicant-photo-${Date.now()}.jpg`, { type: "image/jpeg" })
        const url = await upload(file)
        onChange(url)
      } catch {
        toast.error("Failed to upload the captured photo")
      }
    }, "image/jpeg", 0.9)
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) return
    try {
      const url = await upload(file)
      onChange(url)
    } catch {
      toast.error("Failed to upload photo")
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Applicant" className="size-20 rounded-md border border-(--border-subtle) object-cover" />
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(undefined)} disabled={disabled} className="gap-1.5">
          <RotateCcw className="size-4" />
          Retake
        </Button>
      </div>
    )
  }

  if (streaming) {
    return (
      <div className="space-y-2">
        <div className="relative w-full max-w-xs overflow-hidden rounded-md border border-(--border-subtle) bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full scale-x-[-1]" />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={capture} loading={isUploading} className="gap-1.5">
            <Camera className="size-4" />
            Capture
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={stopStream} className="gap-1.5">
            <X className="size-4" />
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" size="sm" onClick={startCamera} disabled={disabled} className="gap-1.5">
        <Camera className="size-4" />
        Use camera
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        className="gap-1.5"
      >
        {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Upload photo
      </Button>
    </div>
  )
}
