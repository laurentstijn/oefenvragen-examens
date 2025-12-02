import Quiz from "@/components/quiz"

export default function Page() {
  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Oefenvragen Examen Radar</h1>
        </div>
        <Quiz />
      </div>
    </main>
  )
}
