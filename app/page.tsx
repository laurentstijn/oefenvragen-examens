"use client"
import { useState } from "react"
import Quiz from "@/components/quiz"
import { AuthForm } from "@/components/auth-form"
import { UserStatsPanel } from "@/components/user-stats"
import { useAuth } from "@/contexts/auth-context"
import { ChevronLeft, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Page() {
  const { username, loading, isAnonymous, signOut } = useAuth()
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0)
  const [quizKey, setQuizKey] = useState(0)
  const [isQuizActive, setIsQuizActive] = useState(false) // Added state to track if quiz is active
  const showAdminButton = true

  const handleQuizComplete = () => {
    console.log("[v0] Quiz completed, refreshing stats")
    setStatsRefreshTrigger((prev) => prev + 1)
  }

  const handleDataReset = () => {
    setStatsRefreshTrigger((prev) => prev + 1)
    setQuizKey((prev) => prev + 1)
  }

  const handleQuizStateChange = (isActive: boolean) => {
    setIsQuizActive(isActive)
  }

  return (
    <main className="w-full min-h-screen bg-background relative">
      <div className="absolute inset-0 pointer-events-none opacity-[1] hidden md:block">
        <div className="absolute top-[60%] left-[40%] -translate-x-1/2 -translate-y-1/2">
          <div className="w-[800px] h-[800px] rounded-full border-2 border-lime-400/60"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border-2 border-lime-400/60"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border-2 border-lime-400/60"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border-2 border-lime-400/60"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-0.5 h-[400px] bg-lime-400/70 origin-bottom -translate-y-full"></div>

          <div className="absolute top-[20%] left-[45%] w-2 h-2 rounded-full bg-lime-400/50 blur-[1px]"></div>
          <div className="absolute top-[30%] left-[48%] w-1.5 h-1.5 rounded-full bg-lime-400/45 blur-[1px]"></div>
          <div className="absolute top-[40%] left-[46%] w-2 h-2 rounded-full bg-lime-400/50 blur-[1px]"></div>
          <div className="absolute top-[50%] left-[47%] w-1.5 h-1.5 rounded-full bg-lime-400/40 blur-[1px]"></div>
          <div className="absolute top-[60%] left-[45%] w-2 h-2 rounded-full bg-lime-400/45 blur-[1px]"></div>

          <div className="absolute top-[22%] left-[55%] w-2 h-2 rounded-full bg-lime-400/50 blur-[1px]"></div>
          <div className="absolute top-[32%] left-[52%] w-1.5 h-1.5 rounded-full bg-lime-400/45 blur-[1px]"></div>
          <div className="absolute top-[42%] left-[54%] w-2 h-2 rounded-full bg-lime-400/50 blur-[1px]"></div>
          <div className="absolute top-[52%] left-[53%] w-1.5 h-1.5 rounded-full bg-lime-400/40 blur-[1px]"></div>
          <div className="absolute top-[62%] left-[55%] w-2 h-2 rounded-full bg-lime-400/45 blur-[1px]"></div>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-3 py-3 relative z-10">
        <div className="relative mb-3">
          <h1 className="text-lg font-bold text-foreground text-center">Oefenvragen Examen Radar</h1>
          {username && showAdminButton && (
            <Link href="/admin" className="absolute right-0 top-0">
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Settings className="w-4 h-4" />
                Admin
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Laden...</p>
          </div>
        ) : !username ? (
          <AuthForm />
        ) : (
          <>
            {isAnonymous && (
              <div className="mb-3">
                <Button onClick={signOut} variant="outline" className="bg-transparent text-sm">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Terug naar login
                </Button>
              </div>
            )}
            {!isAnonymous && !isQuizActive && (
              <UserStatsPanel refreshTrigger={statsRefreshTrigger} onDataReset={handleDataReset} />
            )}
            <Quiz key={quizKey} onQuizComplete={handleQuizComplete} onQuizStateChange={handleQuizStateChange} />
          </>
        )}
      </div>

      <div className="fixed bottom-4 right-4 z-50">
        <p className="text-xs text-muted-foreground/60">@LaurentStijn</p>
      </div>
    </main>
  )
}
