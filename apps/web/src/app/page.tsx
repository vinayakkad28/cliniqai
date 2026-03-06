export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-blue-700">CliniqAI</h1>
      <p className="mt-4 text-lg text-gray-600">
        AI-powered clinical decision support for Indian doctors
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/login"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700"
        >
          Doctor Login
        </a>
      </div>
    </main>
  );
}
