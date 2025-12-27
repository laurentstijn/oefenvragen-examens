"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Category, CategoryStatus } from "@/lib/categories-data"
import { getAllCategoryStatuses, getAllCategories, type SavedCategory } from "@/lib/firebase-service"
import { ChevronRight, Lock } from "lucide-react"

interface CategorySelectorProps {
  onSelectCategory: (categoryId: string) => void
}

interface CategoryWithIcon extends Category {
  icon?: string
}

export function CategorySelector({ onSelectCategory }: CategorySelectorProps) {
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
          icon: saved.icon, // Include icon from Firebase
        }))

        setCategories(convertedCategories)

        console.log("[v0] Loaded all dynamic categories:", convertedCategories.length)
      } catch (error) {
        console.error("[v0] Error loading categories:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadCategories()
  }, [])

  const handleSelectCategory = (category: CategoryWithIcon) => {
    if (category.status === "actief") {
      onSelectCategory(category.id)
    }
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
        <h2 className="text-2xl font-bold text-foreground mb-2">Kies een thema </h2>
        <p className="text-muted-foreground">Selecteer welk thema je wilt oefenen</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {categories
          .filter((category) => category.status === "actief" || category.status === "binnenkort")
          .map((category) => {
            const isActive = category.status === "actief"

            return (
              <Card
                key={category.id}
                className={`transition-all bg-white dark:bg-gray-900 ${
                  isActive ? "cursor-pointer hover:border-primary hover:shadow-md" : "cursor-not-allowed"
                }`}
                onClick={() => handleSelectCategory(category)}
              >
                <CardHeader className={!isActive ? "opacity-60" : ""}>
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
                    {isActive ? (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent className={!isActive ? "opacity-60" : ""}>{getStatusBadge(category.status)}</CardContent>
              </Card>
            )
          })}
      </div>
    </div>
  )
}
