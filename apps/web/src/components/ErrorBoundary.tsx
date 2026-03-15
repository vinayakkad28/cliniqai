"use client";

import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import ErrorFallback from "./ErrorFallback";

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => {
        console.error("[ErrorBoundary]", error, info.componentStack);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
