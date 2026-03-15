export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <h1 className="text-4xl font-heading font-bold text-primary">CliniqAI</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        AI-powered clinical decision support for Indian doctors
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/login"
          className="cursor-pointer rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Doctor Login
        </a>
      </div>
    </main>
  );
}
