import React from 'react'

// Last-resort crash screen: without this, any uncaught render error
// white-screens the whole app — an instant App Store rejection risk.
// Styled with plain inline values because the error may have happened
// before the design system finished loading.
export default class ErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        role="alert"
        className="flex flex-col h-full items-center justify-center gap-4 px-8 text-center bg-background pt-safe-top pb-safe-bottom"
      >
        <h1 className="text-[22px] font-bold text-foreground">Something went wrong</h1>
        <p className="text-[15px] text-muted-foreground">
          An unexpected error occurred. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => { window.location.href = '/' }}
          className="h-14 px-8 rounded-full ember-primary active:scale-95 transition-transform text-[16px] font-bold"
        >
          Reload app
        </button>
      </div>
    )
  }
}