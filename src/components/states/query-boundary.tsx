"use client"

import { Component, type ReactNode } from "react"

/**
 * Catches a failing live query in one part of the screen (e.g. the bell)
 * so the rest of the page keeps working. `fallback` gets a `retry` that
 * renders the children again.
 */
export class QueryBoundary extends Component<
  { children: ReactNode; fallback: (retry: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  retry = () => this.setState({ failed: false })

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children
  }
}
