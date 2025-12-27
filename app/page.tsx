"use client"
import { useState, useEffect } from "react"
import Quiz from "@/components/quiz"
import { AuthForm } from "@/components/auth-form"
import { UserStatsPanel } from "@/components/user-stats"
import { CategorySelector } from "@/components/category-selector"
import { useAuth } from "@/contexts/auth-context"
import { ChevronLeft, Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getCategoryById } from "@/lib/categories-data"
import type { Category } from "@/lib/categories-data"
import { checkAdminAccess } from "@/lib/firebase-service"

export default function Page() {
  const { username, email, loading, isAnonymous, signOut } = useAuth()
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0)
  const [quizKey, setQuizKey] = useState(0)
  const [isQuizActive, setIsQuizActive] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const loadCategory = async () => {
      if (selectedCategory) {
        const category = await getCategoryById(selectedCategory)
        setCurrentCategory(category || null)
      } else {
        setCurrentCategory(null)
      }
    }
    loadCategory()
  }, [selectedCategory])

  useEffect(() => {
    const checkAdmin = async () => {
      if (email && !isAnonymous) {
        const adminStatus = await checkAdminAccess(email)
        setIsAdmin(adminStatus)
      } else {
        setIsAdmin(false)
      }
    }
    checkAdmin()
  }, [email, isAnonymous])

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

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId)
  }

  const handleBackToCategories = () => {
    console.log("[v0] Back to categories clicked")
    setSelectedCategory(null)
    setCurrentCategory(null)
    setQuizKey((prev) => prev + 1)
    console.log("[v0] Category reset completed")
  }

  const getCategoryTitle = () => {
    if (!selectedCategory || !currentCategory) return "Oefenvragen"
    return `Oefenvragen ${currentCategory.name}`
  }

  return (
    <main className="w-full min-h-screen relative">
      <div className="w-full max-w-4xl mx-auto px-3 py-3 relative z-10">
        <div className="relative mb-3">
          <h1 className="text-lg font-bold text-foreground text-center">{getCategoryTitle()}</h1>
          {!selectedCategory && username && !isAnonymous && (
            <div className="absolute right-0 top-0 flex gap-2">
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <Settings className="w-4 h-4" />
                    Admin
                  </Button>
                </Link>
              )}
              <Button onClick={signOut} variant="outline" size="sm" className="gap-2 bg-transparent">
                <LogOut className="w-4 h-4" />
                Uitloggen
              </Button>
            </div>
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
            {!selectedCategory ? (
              <CategorySelector onSelectCategory={handleCategorySelect} />
            ) : (
              <>
                <div className="mb-3">
                  <Button onClick={handleBackToCategories} variant="outline" className="bg-transparent text-sm">
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Terug naar thema's
                  </Button>
                </div>
                {!isAnonymous && !isQuizActive && (
                  <UserStatsPanel
                    refreshTrigger={statsRefreshTrigger}
                    onDataReset={handleDataReset}
                    category={selectedCategory}
                  />
                )}
                <Quiz
                  key={quizKey}
                  onQuizComplete={handleQuizComplete}
                  onQuizStateChange={handleQuizStateChange}
                  category={selectedCategory}
                />
              </>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-4 right-4 z-50">
        <p className="text-xs text-muted-foreground/60">@LaurentStijn</p>
      </div>
    </main>
  )
}
