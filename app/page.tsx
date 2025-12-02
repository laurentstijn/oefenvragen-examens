import Quiz from "@/components/quiz"

export default function Page() {
  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Elektromagnetische Golven Quiz</h1>
          <p className="text-muted-foreground text-lg">Test je kennis over elektromagnetische golven en radar</p>
        </div>
        <Quiz />
      </div>
    </main>
  )
}
