export type CategoryStatus = "actief" | "non-actief" | "binnenkort"

export interface Category {
  id: string
  name: string
  description: string
  icon?: string
  status: CategoryStatus
}

export async function getAllAvailableCategories(): Promise<Category[]> {
  try {
    const { getAllCategories, getAllCategoryStatuses } = await import("./firebase-service")

    const [dynamicCategories, statuses] = await Promise.all([getAllCategories(), getAllCategoryStatuses()])

    const converted: Category[] = dynamicCategories.map((saved) => ({
      id: saved.id,
      name: saved.name,
      description: saved.description,
      status: (statuses[saved.id] as CategoryStatus) || "actief",
    }))

    return converted
  } catch (error) {
    console.error("[v0] Error loading categories:", error)
    return []
  }
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  try {
    const allCategories = await getAllAvailableCategories()
    return allCategories.find((cat) => cat.id === id)
  } catch (error) {
    console.error("[v0] Error getting category by id:", error)
    return undefined
  }
}
