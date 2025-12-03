"use client"
import { useState } from "react"
import Quiz from "@/components/quiz"
import { AuthForm } from "@/components/auth-form"
import { UserStatsPanel } from "@/components/user-stats"
import { useAuth } from "@/contexts/auth-context"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Page() {
  const { username, loading, isAnonymous, signOut } = useAuth()
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0)
  const [quizKey, setQuizKey] = useState(0)

  const handleQuizComplete = () => {
    setStatsRefreshTrigger((prev) => prev + 1)
  }

  const handleDataReset = () => {
    setStatsRefreshTrigger((prev) => prev + 1)
    setQuizKey((prev) => prev + 1)
  }

  return (
    <main className="min-h-screen bg-background p-3 sm:p-6 lg:p-8 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[1] hidden sm:block">
        <div className="absolute top-[60%] left-[40%] -translate-x-1/2 -translate-y-1/2">
          <div className="w-[800px] h-[800px] rounded-full border-2 border-lime-400/60"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border-2 border-lime-400/60"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border-2 border-lime-400/60"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border-2 border-lime-400/60"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-0.5 h-[400px] bg-lime-400/70 origin-bottom -translate-y-full"></div>

          {/* Echo blips arranged in a channel pattern */}
          {/* Left side of channel */}
          <div className="absolute top-[20%] left-[45%] w-2 h-2 rounded-full bg-lime-400/50 blur-[1px]"></div>
          <div className="absolute top-[30%] left-[48%] w-1.5 h-1.5 rounded-full bg-lime-400/45 blur-[1px]"></div>
          <div className="absolute top-[40%] left-[46%] w-2 h-2 rounded-full bg-lime-400/50 blur-[1px]"></div>
          <div className="absolute top-[50%] left-[47%] w-1.5 h-1.5 rounded-full bg-lime-400/40 blur-[1px]"></div>
          <div className="absolute top-[60%] left-[45%] w-2 h-2 rounded-full bg-lime-400/45 blur-[1px]"></div>

          {/* Right side of channel */}
          <div className="absolute top-[22%] left-[55%] w-2 h-2 rounded-full bg-lime-400/50 blur-[1px]"></div>
          <div className="absolute top-[32%] left-[52%] w-1.5 h-1.5 rounded-full bg-lime-400/45 blur-[1px]"></div>
          <div className="absolute top-[42%] left-[54%] w-2 h-2 rounded-full bg-lime-400/50 blur-[1px]"></div>
          <div className="absolute top-[52%] left-[53%] w-1.5 h-1.5 rounded-full bg-lime-400/40 blur-[1px]"></div>
          <div className="absolute top-[62%] left-[55%] w-2 h-2 rounded-full bg-lime-400/45 blur-[1px]"></div>
        </div>
      </div>

      <div className="max-w-full sm:max-w-2xl lg:max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Oefenvragen Examen Radar</h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Laden...</p>
          </div>
        ) : !username ? (
          <AuthForm />
        ) : (
          <>
            {isAnonymous && (
              <div className="mb-4">
                <Button onClick={signOut} variant="outline" className="bg-transparent">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Terug naar login
                </Button>
              </div>
            )}
            {!isAnonymous && <UserStatsPanel refreshTrigger={statsRefreshTrigger} onDataReset={handleDataReset} />}
            <Quiz key={quizKey} onQuizComplete={handleQuizComplete} />
          </>
        )}
      </div>
    </main>
  )
}
