"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = { children: React.ReactNode; fallbackTitle?: string }
type State = { hasError: boolean }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-12 text-center">
          <AlertTriangle className="size-8 text-(--error-600)" strokeWidth={1.75} />
          <p className="text-sm font-medium text-(--text-primary)">
            {this.props.fallbackTitle ?? "Something went wrong loading this section"}
          </p>
          <Button size="sm" variant="outline" onClick={() => this.setState({ hasError: false })}>
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
