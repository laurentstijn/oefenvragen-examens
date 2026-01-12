"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Category, CategoryStatus } from "@/lib/categories-data"
import { getAllCategoryStatuses, getAllCategories, type SavedCategory } from "@/lib/firebase-service"
import { ChevronRight, Lock, FlaskConical } from "lucide-react"

interface TestCategorySelectorProps {
  onSelectCategory: (categoryId: string) => void
}

interface CategoryWithIcon extends Category {
  icon?: string
}

export function TestCategorySelector({ onSelectCategory }: TestCategorySelectorProps) {
  const [categories, setCategories] = useState<CategoryWithIcon[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const [savedCategories, statuses] = await Promise.all([getAllCategories(), getAllCategoryStatuses()])

        const convertedCategories: CategoryWithIcon[] = savedCategories.map((saved: SavedCategory) => ({
          id: saved.id,
          name: saved.name,
          description: saved.description,
          status: (statuses[saved.id] as CategoryStatus) || "actief",
          icon: saved.icon,
        }))

        setCategories(convertedCategories)

        console.log("[v0] TEST MODE - Loaded all categories:", convertedCategories.length)
      } catch (error) {
        console.error("[v0] Error loading categories:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadCategories()
  }, [])

  const handleSelectCategory = (category: CategoryWithIcon) => {
    onSelectCategory(category.id)
  }

  const getStatusBadge = (status: CategoryStatus) => {
    switch (status) {
      case "actief":
        return <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-medium">Actief</span>
      case "binnenkort":
        return <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 font-medium">Binnenkort</span>
      case "non-actief":
        return (
          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 font-medium flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Niet beschikbaar
          </span>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Categorieën laden...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
          <FlaskConical className="w-6 h-6 text-amber-600" />
          Kies een thema (TEST MODUS)
        </h2>
        <p className="text-muted-foreground">Alle categorieën zijn zichtbaar voor testing, inclusief niet-actieve</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {categories
          .sort((a, b) => {
            if (a.status === "actief" && b.status !== "actief") return -1
            if (a.status !== "actief" && b.status === "actief") return 1
            if (a.status === "binnenkort" && b.status === "non-actief") return -1
            if (a.status === "non-actief" && b.status === "binnenkort") return 1
            return 0
          })
          .map((category) => {
            return (
              <Card
                key={category.id}
                className="transition-all bg-white dark:bg-gray-900 cursor-pointer hover:border-primary hover:shadow-md"
                onClick={() => handleSelectCategory(category)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-3">
                      {category.icon && (
                        <img
                          src={category.icon || "/placeholder.svg"}
                          alt={`${category.name} icon`}
                          className="w-8 h-8 object-contain"
                        />
                      )}
                      {category.name}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>{getStatusBadge(category.status)}</CardContent>
              </Card>
            )
          })}
      </div>
    </div>
  )
}
