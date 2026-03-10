'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-slate-300">Something went wrong</h1>
        <p className="mt-4 text-slate-600">{error.message || 'An unexpected error occurred'}</p>
        <button onClick={reset} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Try Again
        </button>
      </div>
    </div>
  );
}
