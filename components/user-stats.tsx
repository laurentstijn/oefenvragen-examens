"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getUserStats, resetUserStats, type UserStats } from "@/lib/firebase-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LogOut, Trophy, TrendingUp, BookOpen, RotateCcw } from "lucide-react"

interface UserStatsPanelProps {
  refreshTrigger?: number
  onDataReset?: () => void
}

export function UserStatsPanel({ refreshTrigger, onDataReset }: UserStatsPanelProps) {
  const { username, signOut } = useAuth()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (username) {
      loadStats()
    }
  }, [username, refreshTrigger])

  const loadStats = async () => {
    if (!username) return

    console.log("[v0] Loading user stats for:", username)
    try {
      const userStats = await getUserStats(username)
      console.log("[v0] User stats loaded:", userStats)
      setStats(userStats)
    } catch (error) {
      console.error("[v0] Error loading stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetStats = async () => {
    if (!username) return

    const confirmed = window.confirm(
      "Weet je zeker dat je al je statistieken wilt resetten? Dit verwijdert alle quiz resultaten en opgeslagen voortgang. Dit kan niet ongedaan worden gemaakt.",
    )

    if (!confirmed) return

    setResetting(true)
    try {
      await resetUserStats(username)
      await loadStats()
      if (onDataReset) {
        onDataReset()
      }
    } catch (error) {
      console.error("[v0] Error resetting stats:", error)
      alert("Er is een fout opgetreden bij het resetten van je statistieken.")
    } finally {
      setResetting(false)
    }
  }

  if (!username) return null

  return (
    <Card className="border-2 mb-2 sm:mb-4">
      <CardHeader className="pb-2 sm:pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg lg:text-xl">Welkom terug, {username}!</CardTitle>
          <div className="flex gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetStats}
              disabled={resetting}
              className="text-xs sm:text-sm px-2 sm:px-3 bg-transparent"
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{resetting ? "Resetten..." : "Reset Stats"}</span>
              <span className="sm:hidden">Reset</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut()} className="text-xs sm:text-sm px-2 sm:px-3">
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Uitloggen</span>
              <span className="sm:hidden">Uit</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 sm:pt-4">
        {loading ? (
          <p className="text-muted-foreground text-sm">Statistieken laden...</p>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
              <BookOpen className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2 text-primary" />
              <p className="text-lg sm:text-2xl font-bold">{stats.totalQuizzes}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Reeksen gemaakt</p>
            </div>
            <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
              <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2 text-primary" />
              <p className="text-lg sm:text-2xl font-bold">{stats.averageScore}%</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Gemiddeld</p>
            </div>
            <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
              <Trophy className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2 text-primary" />
              <p className="text-lg sm:text-2xl font-bold">{stats.bestScore}%</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Beste score</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Geen statistieken beschikbaar</p>
        )}
      </CardContent>
    </Card>
  )
}
