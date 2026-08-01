"use client"

import * as React from "react"
import { Eraser } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Registry's signature-capture component is part of the same unreachable
// Advanced Form Elements set as PhoneInput — hand-built canvas fallback,
// mirroring master_prompt.md's documented pattern for broken registries.

export function SignaturePad({
  value,
  onChange,
  className,
  disabled,
}: {
  /** PNG data URL of the captured signature, or empty when unsigned. */
  value?: string
  onChange: (dataUrl: string) => void
  className?: string
  disabled?: boolean
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const drawing = React.useRef(false)
  const hasStrokes = React.useRef(false)

  function getContext() {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext("2d")
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    // Canvas has a fixed internal resolution but renders at a responsive
    // CSS width, so pointer coordinates need rescaling to the drawing space.
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    const ctx = getContext()
    if (!ctx) return
    drawing.current = true
    const { x, y } = pointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return
    const ctx = getContext()
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#141414"
    ctx.lineTo(x, y)
    ctx.stroke()
    hasStrokes.current = true
  }

  function handlePointerUp() {
    if (!drawing.current) return
    drawing.current = false
    if (hasStrokes.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"))
    }
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasStrokes.current = false
    onChange("")
  }

  // Repaint from an externally-provided value (e.g. form reset) once on mount.
  React.useEffect(() => {
    if (!value) return
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    const img = new Image()
    img.onload = () => ctx.drawImage(img, 0, 0)
    img.src = value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative overflow-hidden rounded-sm border border-(--border-subtle) bg-white">
        <canvas
          ref={canvasRef}
          width={520}
          height={160}
          className={cn("h-40 w-full touch-none", disabled && "cursor-not-allowed opacity-60")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!value ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-(--text-muted)">
            Sign here with your mouse or finger
          </p>
        ) : null}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={clear} disabled={disabled || !value} className="gap-1.5">
        <Eraser className="size-4" />
        Clear signature
      </Button>
    </div>
  )
}
