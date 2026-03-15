"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface ErrorFallbackProps {
  error: unknown;
  resetErrorBoundary: () => void;
}

export default function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6" role="alert">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-card p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <ExclamationTriangleIcon className="h-6 w-6 text-destructive" />
        </div>

        <h2 className="mb-2 text-lg font-heading font-semibold text-card-foreground">Something went wrong</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>

        {isDev && (
          <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-xs text-destructive">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        )}

        <button
          onClick={resetErrorBoundary}
          className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
