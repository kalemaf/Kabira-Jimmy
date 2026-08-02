"use client"

import * as React from "react"

// Registers public/sw.js, which only ever caches static build assets — see
// that file's header comment for why it deliberately never touches API
// calls or page navigations in a money-handling app.
export function PwaRegister() {
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])

  return null
}
