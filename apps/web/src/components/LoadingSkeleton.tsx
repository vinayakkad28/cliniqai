export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b">
        <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="p-3">
                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b">
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="p-3">
                  <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-32" />
    </div>
  );
}

export function PatientProfileSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton rows={3} cols={5} />
    </div>
  );
}

export function ConsultationSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex gap-4">
        <div className="flex-1 bg-white rounded-xl shadow-sm border p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
            ))}
          </div>
        </div>
        <div className="w-80 bg-white rounded-xl shadow-sm border p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-24 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
