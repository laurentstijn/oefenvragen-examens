// All database operations now use REST API via firebase-rest.ts

export interface QuizResult {
  username: string
  setId: string
  setName: string
  score: number
  totalQuestions: number
  percentage: number
  answersGiven: (string | null)[]
  correctAnswers: string[]
  timestamp: string | number // Accept both string (ISO) and number (milliseconds)
  shuffleQuestions: boolean
  shuffleAnswers: boolean
}

export interface UserStats {
  totalQuizzes: number
  averageScore: number
  bestScore: number
  recentQuizzes: QuizResult[]
}

export interface QuizProgress {
  username: string
  setId: string
  setName: string
  currentQuestion: number
  answers: (string | null)[]
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  timestamp: string | number // Accept both string (ISO) and number (milliseconds)
}

export interface QuestionEdit {
  id: number
  question?: string
  options?: {
    a?: string
    b?: string
    c?: string
  }
  correct?: "a" | "b" | "c"
  timestamp: string | number // Accept both string (ISO) and number (milliseconds)
}

export interface SavedCategory {
  id: string
  name: string
  description: string
  createdAt: string
  questionSets: {
    [setId: string]: {
      name: string
      questionIds: number[]
    }
  }
  questions: {
    [questionId: number]: {
      id: number
      question: string
      options: {
        a: string
        b: string
        c: string
      }
      correct: "A" | "B" | "C"
    }
  }
  icon?: string
}

export interface CategoryStatus {
  status: string
  updatedAt: string
}

export interface QuestionFlag {
  questionId: string
  categoryId: string
  username: string
  reason?: string
  timestamp: string
  questionText: string
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function parseTimestamp(timestamp: string | number): Date {
  if (typeof timestamp === "number") {
    // Old format: milliseconds
    return new Date(timestamp)
  }
  // New format: ISO string
  return new Date(timestamp)
}

/**
 * Encodes an email or username to be safe for Firebase paths
 * Replaces dots (.) with commas (,) since Firebase doesn't allow dots in keys
 */
export function encodeUserKey(identifier: string): string {
  return identifier.replace(/\./g, ",")
}

/**
 * Decodes a Firebase-safe key back to the original email or username
 */
export function decodeUserKey(key: string): string {
  return key.replace(/,/g, ".")
}

export async function checkUsernameExists(username: string): Promise<boolean> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const userData = await firebaseGet(`users/${encodedUsername}`)
    return userData !== null
  } catch (error) {
    console.error("[v0] Error checking username:", error)
    return false
  }
}

export async function createUser(username: string, password: string): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    const hashedPassword = await hashPassword(password)
    const encodedUsername = encodeUserKey(username)
    await firebaseSet(`users/${encodedUsername}`, {
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      incorrectQuestions: {},
      quizProgress: {},
      quizResults: {},
    })
  } catch (error) {
    console.error("[v0] Error creating user:", error)
    throw error
  }
}

export async function verifyPassword(username: string, password: string): Promise<boolean> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const userData = await firebaseGet(`users/${encodedUsername}`)
    
    if (!userData) {
      return false
    }
    
    const hashedPassword = await hashPassword(password)
    return userData.password === hashedPassword
  } catch (error) {
    console.error("[v0] Error verifying password:", error)
    return false
  }
}

export async function saveQuizResult(result: QuizResult, category = "radar") {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(result.username)
    await firebaseSet(`users/${encodedUsername}/${category}/quizResults/${result.setId}`, {
      ...result,
      timestamp: typeof result.timestamp === "number" ? result.timestamp : new Date().getTime(),
    })
    return result.setId
  } catch (error) {
    console.error("[v0] Error saving quiz result:", error)
    throw error
  }
}

export async function getUserStats(username: string, category = "radar"): Promise<UserStats> {
  const defaultStats = {
    totalQuizzes: 0,
    averageScore: 0,
    bestScore: 0,
    recentQuizzes: [],
  }
  
  try {
    // Try REST API first
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const data = await firebaseGet(`users/${encodedUsername}/${category}/quizResults`)
    
    if (!data) {
      return defaultStats
    }
    
    const results: QuizResult[] = Object.entries(data).map(([key, value]) => ({
      ...(value as any),
      id: key
    }))

    console.log("[v0] Found quiz results:", { count: results.length, keys: Object.keys(data) })

    results.sort((a, b) => parseTimestamp(b.timestamp).getTime() - parseTimestamp(a.timestamp).getTime())

    const totalQuizzes = results.length
    const averageScore = results.reduce((acc, r) => acc + r.percentage, 0) / totalQuizzes
    const bestScore = Math.max(...results.map((r) => r.percentage))
    const recentQuizzes = results.slice(0, 10)

    return {
      totalQuizzes,
      averageScore: Math.round(averageScore),
      bestScore,
      recentQuizzes,
    }
  } catch (error) {
    console.error("[v0] Error getting user stats:", error)
    return defaultStats
  }
}

export async function getSetResults(username: string, setId: string, category = "radar") {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const data = await firebaseGet(`users/${encodedUsername}/${category}/quizResults/${setId}`)
    
    if (!data) {
      return []
    }
    
    const results: QuizResult[] = typeof data === 'object' && !Array.isArray(data) 
      ? Object.values(data) 
      : [data]
    
    results.sort((a, b) => parseTimestamp(b.timestamp).getTime() - parseTimestamp(a.timestamp).getTime())
    return results.slice(0, 5)
  } catch (error) {
    console.error("[v0] Error getting set results:", error)
    return []
  }
}

export async function resetUserStats(username: string, category = "radar"): Promise<void> {
  try {
    const { firebaseRemove } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    
    await firebaseRemove(`users/${encodedUsername}/${category}/quizProgress`)
    await firebaseRemove(`users/${encodedUsername}/${category}/quizResults`)
    await firebaseRemove(`users/${encodedUsername}/${category}/incorrectQuestions`)
  } catch (error) {
    console.error("[v0] Error resetting user stats:", error)
    throw error
  }
}

export async function getSeriesAttempts(username: string, category = "radar"): Promise<Record<string, number>> {
  try {
    // Try REST API first
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const data = await firebaseGet(`users/${encodedUsername}/${category}/quizResults`)
    
    if (!data) {
      return {}
    }
    
    const attemptCounts: Record<string, number> = {}
    for (const value of Object.values(data)) {
      const setId = (value as any).setId
      attemptCounts[setId] = (attemptCounts[setId] || 0) + 1
    }
    
    return attemptCounts
  } catch (error) {
    console.error("[v0] Error getting series attempts:", error)
    return {}
  }
}

export async function saveQuizProgress(progress: QuizProgress, category = "radar"): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(progress.username)
    const cleanedProgress = {
      ...progress,
      answers: (progress.answers || []).map((answer) => (answer === null || answer === undefined ? "" : answer)),
      timestamp: typeof progress.timestamp === "number" ? progress.timestamp : new Date().getTime(),
    }
    await firebaseSet(`users/${encodedUsername}/${category}/quizProgress/${progress.setId}`, cleanedProgress)
  } catch (error) {
    console.error("[v0] Error saving quiz progress:", error)
    throw error
  }
}

export async function getQuizProgress(
  username: string,
  setId: string,
  category = "radar",
): Promise<QuizProgress | null> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const data = await firebaseGet(`users/${encodedUsername}/${category}/quizProgress/${setId}`)
    return data as QuizProgress | null
  } catch (error) {
    console.error("[v0] Error getting quiz progress:", error)
    return null
  }
}

export async function getAllQuizProgress(username: string, category = "radar"): Promise<Record<string, QuizProgress>> {
  try {
    // Try REST API first
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const data = await firebaseGet(`users/${encodedUsername}/${category}/quizProgress`)
    
    if (!data) {
      return {}
    }
    
    return data as Record<string, QuizProgress>
  } catch (error) {
    console.error("[v0] Error getting all quiz progress:", error)
    return {}
  }
}

export async function clearQuizProgress(username: string, setId: string, category = "radar"): Promise<void> {
  try {
    const { firebaseRemove } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    await firebaseRemove(`users/${encodedUsername}/${category}/quizProgress/${setId}`)
  } catch (error) {
    console.error("[v0] Error clearing quiz progress:", error)
  }
}

export async function getWrongAnswers(
  username: string,
  category = "radar",
): Promise<{ questionId: number; correctAnswer: string }[]> {
  try {
    const incorrectIds = await getIncorrectQuestions(username, category)

    return incorrectIds.map((id) => ({
      questionId: id,
      correctAnswer: "", // Will be filled from questions data
    }))
  } catch (error) {
    console.error("[v0] Error getting wrong answers:", error)
    return []
  }
}

export async function addIncorrectQuestion(username: string, questionId: number, category = "radar"): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    await firebaseSet(`users/${encodedUsername}/${category}/incorrectQuestions/${questionId}`, {
      questionId,
      addedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error adding incorrect question:", error)
    throw error
  }
}

export async function removeIncorrectQuestion(username: string, questionId: number, category = "radar"): Promise<void> {
  try {
    const { firebaseRemove } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    await firebaseRemove(`users/${encodedUsername}/${category}/incorrectQuestions/${questionId}`)
  } catch (error) {
    console.error("[v0] Error removing incorrect question:", error)
  }
}

export async function getIncorrectQuestions(username: string, category = "radar"): Promise<number[]> {
  try {
    // Try REST API first
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const data = await firebaseGet(`users/${encodedUsername}/${category}/incorrectQuestions`)
    
    if (!data) {
      return []
    }
    
    const incorrectIds: number[] = Object.values(data).map((item: any) => item.questionId)
    return incorrectIds.sort((a, b) => a - b)
  } catch (error) {
    console.error("[v0] Error getting incorrect questions:", error)
    return []
  }
}

export async function userHasPassword(username: string): Promise<boolean> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const userData = await firebaseGet(`users/${encodedUsername}`)
    
    if (!userData) {
      return false
    }
    
    return !!userData.password
  } catch (error) {
    console.error("[v0] Error checking if user has password:", error)
    return false
  }
}

export async function setPasswordForUser(username: string, password: string): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    const hashedPassword = await hashPassword(password)
    const encodedUsername = encodeUserKey(username)
    await firebaseSet(`users/${encodedUsername}/password`, hashedPassword)
  } catch (error) {
    console.error("[v0] Error setting password for user:", error)
    throw error
  }
}

export async function updateLastActive(username: string): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    await firebaseSet(`users/${encodedUsername}/lastActive`, new Date().toISOString())
  } catch {
    // Silently fail - not critical
  }
}

export async function checkAdminAccess(email: string): Promise<boolean> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const encodedEmail = email.replace(/\./g, ",")
    const isAdmin = await firebaseGet(`admins/${encodedEmail}`)
    return isAdmin === true
  } catch (error) {
    console.error("[v0] Error checking admin access:", error)
    return false
  }
}

const FALLBACK_CATEGORIES: SavedCategory[] = [
  {
    id: "radar",
    name: "Radar",
    description: "Radar vragen voor het examen",
  },
  {
    id: "matroos",
    name: "Matroos",
    description: "Matroos vragen voor het examen",
  },
  {
    id: "matroos-2",
    name: "Matroos 2",
    description: "Matroos 2 vragen voor het examen",
  },
]

export async function getAllCategories(): Promise<SavedCategory[]> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const data = await firebaseGet("categories")
    
    if (!data) {
      return []
    }
    
    const categories: SavedCategory[] = Object.values(data)
    return categories
  } catch (error) {
    console.error("[v0] Error getting all categories:", error)
    return []
  }
}

export async function deleteCategory(categoryId: string): Promise<void> {
  try {
    const { firebaseRemove, firebaseGet } = await import("./firebase-rest")
    
    // Delete category metadata
    await firebaseRemove(`categories/${categoryId}`)
    
    // Delete category status
    await firebaseRemove(`categoryStatus/${categoryId}`)
    
    // Delete all questions for this category
    await firebaseRemove(`questions/${categoryId}`)
    
    // Delete related questionEdits
    const edits = await firebaseGet("questionEdits")
    if (edits) {
      for (const editKey of Object.keys(edits)) {
        if (editKey.startsWith(`${categoryId}-`)) {
          await firebaseRemove(`questionEdits/${editKey}`)
        }
      }
    }
  } catch (error) {
    console.error("[v0] Error deleting category:", error)
    throw error
  }
}

export async function saveCategoryStatus(categoryId: string, status: string): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    await firebaseSet(`categoryStatus/${categoryId}`, status)
    console.log("[v0] Category status saved:", categoryId, status)
  } catch (error) {
    console.error("[v0] Error saving category status:", error)
    throw error
  }
}

export async function getCategoryStatus(categoryId: string): Promise<string | null> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const data = await firebaseGet(`categoryStatus/${categoryId}`)
    
    if (!data) {
      return null
    }
    
    return typeof data === "string" ? data : data.status
  } catch (error) {
    console.error("[v0] Error getting category status:", error)
    return null
  }
}

export async function getAllCategoryStatuses(): Promise<{ [key: string]: string }> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const data = await firebaseGet("categoryStatus")
    
    if (!data) {
      return {}
    }
    
    const statuses: { [key: string]: string } = {}
    for (const [key, value] of Object.entries(data)) {
      statuses[key] = typeof value === "string" ? value : (value as any)?.status || "actief"
    }
    
    return statuses
  } catch (error) {
    console.error("[v0] Error getting all category statuses:", error)
    return {}
  }
}

export async function getAllQuestions(category: string): Promise<Record<string, any>> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const data = await firebaseGet(`questions/${category}`)
    return data as Record<string, any> || {}
  } catch (error) {
    console.error("[v0] Error getting Firebase questions:", error)
    return {}
  }
}

export async function getDeletedQuestions(category: string): Promise<string[]> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const data = await firebaseGet(`deletedQuestions/${category}`)
    
    if (!data) {
      return []
    }
    
    return Object.keys(data)
  } catch (error) {
    console.error("[v0] Error getting deleted questions:", error)
    return []
  }
}

export async function migrateTimestamps(): Promise<{
  success: boolean
  message: string
  details: Record<string, any>
}> {
  try {
    const { firebaseGet, firebaseSet } = await import("./firebase-rest")
    const users = await firebaseGet("users")

    if (!users) {
      return {
        success: true,
        message: "Geen gebruikers gevonden om te migreren",
        details: {},
      }
    }

    const migrationDetails: Record<string, any> = {}
    let totalMigrated = 0

    for (const userSnapshot of Object.values(users as Record<string, any>)) {
      const username = userSnapshot.username
      if (!username) continue

      const userDetails: any = {
        createdAt: false,
        lastActive: false,
        quizResults: 0,
        quizProgress: 0,
      }

      if (userSnapshot.createdAt && typeof userSnapshot.createdAt === "number") {
        await firebaseSet(`users/${encodeUserKey(username)}/createdAt`, new Date(userSnapshot.createdAt).toISOString())
        userDetails.createdAt = true
        totalMigrated++
      }

      if (userSnapshot.lastActive && typeof userSnapshot.lastActive === "number") {
        await firebaseSet(`users/${encodeUserKey(username)}/lastActive`, new Date(userSnapshot.lastActive).toISOString())
        userDetails.lastActive = true
        totalMigrated++
      }

      if (Object.values(userDetails).some((v) => v !== false && v !== 0)) {
        migrationDetails[username] = userDetails
      }
    }

    return {
      success: true,
      message: `Succesvol ${totalMigrated} timestamps geconverteerd`,
      details: migrationDetails,
    }
  } catch (error) {
    console.error("[v0] Error during timestamp migration:", error)
    return {
      success: false,
      message: "Fout tijdens migratie: " + (error instanceof Error ? error.message : "Onbekende fout"),
      details: {},
    }
  }
}

export async function migrateStaticQuestionsToFirebase() {
  try {
    const { firebaseGet, firebaseSet } = await import("./firebase-rest")
    const { radarQuestionSets } = await import("@/lib/radar-data")
    const { matrozenQuestionSets } = await import("@/lib/matrozen-data")

    let radarMigrated = 0
    let radarSkipped = 0
    let matrozenMigrated = 0
    let matrozenSkipped = 0
    const errors: string[] = []

    await saveCategory("radar", "Radar", "Oefenvragen voor Radar")
    await saveCategory("matrozen", "Matroos", "Oefenvragen voor Matroos")

    for (const questionSet of radarQuestionSets) {
      for (const question of questionSet.questions) {
        try {
          const questionId = `radar-${question.id}`
          const existing = await firebaseGet(`questions/radar/${questionId}`)
          if (existing) {
            radarSkipped++
            continue
          }
          await firebaseSet(`questions/radar/${questionId}`, {
            id: questionId,
            question: question.question,
            options: question.options,
            correctAnswer: question.correct.toUpperCase(),
            reeks: normalizeReeks(questionSet.setId),
            image: question.image || null,
            optionImages: question.optionImages || {},
          })
          radarMigrated++
        } catch (error) {
          errors.push(`Radar ${question.id}: ${error}`)
        }
      }
    }

    for (const questionSet of matrozenQuestionSets) {
      for (const question of questionSet.questions) {
        try {
          const questionId = `matrozen-${question.id}`
          const existing = await firebaseGet(`questions/matrozen/${questionId}`)
          if (existing) {
            matrozenSkipped++
            continue
          }
          await firebaseSet(`questions/matrozen/${questionId}`, {
            id: questionId,
            question: question.question,
            options: question.options,
            correctAnswer: question.correct.toUpperCase(),
            reeks: normalizeReeks(questionSet.setId),
            image: question.image || null,
            optionImages: question.optionImages || {},
          })
          matrozenMigrated++
        } catch (error) {
          errors.push(`Matrozen ${question.id}: ${error}`)
        }
      }
    }

    return { success: errors.length === 0, radarMigrated, radarSkipped, matrozenMigrated, matrozenSkipped, errors }
  } catch (error) {
    console.error("[v0] Migration failed:", error)
    throw error
  }
}

export async function updateExistingQuestionsWithReeks() {
  try {
    const { firebaseGet, firebaseSet } = await import("./firebase-rest")

    let radarUpdated = 0
    let matrozenUpdated = 0
    const errors: string[] = []

    const radarQuestions = await firebaseGet("questions/radar")
    if (radarQuestions) {
      for (const [questionId, questionData] of Object.entries(radarQuestions)) {
        try {
          const match = questionId.match(/radar-(\d+)/)
          if (!match) continue

          const questionNum = Number.parseInt(match[1])
          let reeks = "1"
          if (questionNum >= 51 && questionNum <= 100) reeks = "2"
          else if (questionNum >= 101 && questionNum <= 150) reeks = "3"
          else if (questionNum >= 151 && questionNum <= 200) reeks = "4"
          else if (questionNum >= 201) reeks = "5"

          await firebaseSet(`questions/radar/${questionId}`, { ...(questionData as Record<string, unknown>), reeks })
          radarUpdated++
        } catch (error) {
          errors.push(`Radar ${questionId}: ${error}`)
        }
      }
    }

    const matrozenQuestions = await firebaseGet("questions/matrozen")
    if (matrozenQuestions) {
      for (const [questionId, questionData] of Object.entries(matrozenQuestions)) {
        try {
          await firebaseSet(`questions/matrozen/${questionId}`, { ...(questionData as Record<string, unknown>), reeks: "1" })
          matrozenUpdated++
        } catch (error) {
          errors.push(`Matrozen ${questionId}: ${error}`)
        }
      }
    }

    return { success: errors.length === 0, radarUpdated, matrozenUpdated, errors }
  } catch (error) {
    console.error("[v0] Update failed:", error)
    throw error
  }
}

function normalizeReeks(reeks: string | number | undefined): string {
  if (!reeks) return "1"
  const reeksStr = String(reeks).toLowerCase()
  const cleaned = reeksStr
    .replace(/^.*-reeks-/, "")
    .replace(/^reeks-?/, "")
    .replace(/^set-?/, "")
    .trim()
  return cleaned || "1"
}

export async function renameSeriesInCategory(
  categoryId: string,
  oldSeriesName: string,
  newSeriesName: string,
): Promise<{ success: boolean; updatedCount: number }> {
  try {
    const { firebaseGet, firebaseUpdate } = await import("./firebase-rest")
    const questions = await firebaseGet(`questions/${categoryId}`)

    if (!questions) {
      return { success: false, updatedCount: 0 }
    }

    let updatedCount = 0
    const updates: Record<string, any> = {}

    for (const [key, questionData] of Object.entries(questions)) {
      if ((questionData as any).reeks === oldSeriesName) {
        updates[`${key}/reeks`] = newSeriesName
        updatedCount++
      }
    }

    if (updatedCount > 0) {
      await firebaseUpdate(`questions/${categoryId}`, updates)
    }

    return { success: true, updatedCount }
  } catch (error) {
    console.error("[v0] Error renaming series:", error)
    throw error
  }
}

export async function deleteSeriesFromCategory(
  categoryId: string,
  seriesName: string,
): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const { firebaseGet, firebaseUpdate } = await import("./firebase-rest")
    const questions = await firebaseGet(`questions/${categoryId}`)

    if (!questions) {
      return { success: false, deletedCount: 0 }
    }

    let deletedCount = 0
    const updates: Record<string, null> = {}

    for (const [key, questionData] of Object.entries(questions)) {
      if ((questionData as any).reeks === seriesName) {
        updates[key] = null
        deletedCount++
      }
    }

    if (deletedCount > 0) {
      await firebaseUpdate(`questions/${categoryId}`, updates)
    }

    return { success: true, deletedCount }
  } catch (error) {
    console.error("[v0] Error deleting series:", error)
    return { success: false, deletedCount: 0 }
  }
}

export async function renameCategoryId(
  oldCategoryId: string,
  newCategoryId: string,
): Promise<{ success: boolean; movedQuestionsCount: number }> {
  try {
    const { firebaseGet, firebaseSet, firebaseRemove } = await import("./firebase-rest")
    const oldQuestions = await firebaseGet(`questions/${oldCategoryId}`)

    let movedCount = 0

    if (oldQuestions) {
      const questions: Record<string, any> = {}

      for (const [oldId, questionData] of Object.entries(oldQuestions)) {
        const newId = oldId.replace(new RegExp(`^${oldCategoryId}-`), `${newCategoryId}-`)
        questions[newId] = questionData
        movedCount++
      }

      await firebaseSet(`questions/${newCategoryId}`, questions)
      await firebaseRemove(`questions/${oldCategoryId}`)
    }

    // Also remove the old category entry (ignore errors if it doesn't exist)
    try {
      await firebaseRemove(`categories/${oldCategoryId}`)
    } catch (e) {
      // Ignore - category may not exist
    }

    // Move flagged questions if any (ignore auth errors)
    try {
      const oldFlagged = await firebaseGet(`flaggedQuestions/${oldCategoryId}`)
      if (oldFlagged) {
        await firebaseSet(`flaggedQuestions/${newCategoryId}`, oldFlagged)
        await firebaseRemove(`flaggedQuestions/${oldCategoryId}`)
      }
    } catch (e) {
      // Ignore - flagged questions may not exist or not accessible
    }

    // Move deleted questions markers if any (ignore auth errors)
    try {
      const oldDeleted = await firebaseGet(`deletedQuestions/${oldCategoryId}`)
      if (oldDeleted) {
        await firebaseSet(`deletedQuestions/${newCategoryId}`, oldDeleted)
        await firebaseRemove(`deletedQuestions/${oldCategoryId}`)
      }
    } catch (e) {
      // Ignore - deleted questions may not exist or not accessible
    }

    return { success: true, movedQuestionsCount: movedCount }
  } catch (error) {
    console.error("Error renaming category ID:", error)
    return { success: false, movedQuestionsCount: 0 }
  }
}

export async function flagQuestion(
  username: string,
  questionId: string,
  categoryId: string,
  questionText?: string,
  reason?: string,
): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    await firebaseSet(`questionFlags/${categoryId}/${questionId}/${encodedUsername}`, {
      questionId,
      categoryId,
      username,
      questionText: questionText ? questionText.substring(0, 200) : "",
      reason: reason || "",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error flagging question:", error)
    throw error
  }
}

export async function unflagQuestion(username: string, questionId: string, categoryId: string): Promise<void> {
  try {
    const { firebaseRemove } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    await firebaseRemove(`questionFlags/${categoryId}/${questionId}/${encodedUsername}`)
  } catch (error) {
    console.error("[v0] Error unflagging question:", error)
  }
}

export async function isQuestionFlagged(questionId: string, categoryId: string, username: string): Promise<boolean> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const encodedUsername = encodeUserKey(username)
    const data = await firebaseGet(`questionFlags/${categoryId}/${questionId}/${encodedUsername}`)
    return data !== null
  } catch (error) {
    console.error("[v0] Error checking if question is flagged:", error)
    return false
  }
}

export async function getAllFlaggedQuestions(categoryId?: string): Promise<QuestionFlag[]> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const path = categoryId ? `questionFlags/${categoryId}` : "questionFlags"
    const data = await firebaseGet(path)

    if (!data) {
      return []
    }

    const flags: QuestionFlag[] = []

    if (categoryId) {
      // If category is specified: questionFlags/categoryId/questionId/username
      for (const questionData of Object.values(data)) {
        if (questionData && typeof questionData === 'object') {
          for (const flagData of Object.values(questionData)) {
            if (flagData && typeof flagData === 'object') {
              flags.push(flagData as QuestionFlag)
            }
          }
        }
      }
    } else {
      // If no category: questionFlags/categoryId/questionId/username
      for (const categoryData of Object.values(data)) {
        if (categoryData && typeof categoryData === 'object') {
          for (const questionData of Object.values(categoryData)) {
            if (questionData && typeof questionData === 'object') {
              for (const flagData of Object.values(questionData)) {
                if (flagData && typeof flagData === 'object') {
                  flags.push(flagData as QuestionFlag)
                }
              }
            }
          }
        }
      }
    }

    return flags.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  } catch (error) {
    console.error("[v0] Error getting flagged questions:", error)
    return []
  }
}

export async function getUserFlaggedQuestions(username: string, categoryId: string): Promise<string[]> {
  try {
    // Try REST API first
    const { firebaseGet } = await import("./firebase-rest")
    const data = await firebaseGet(`questionFlags/${categoryId}`)
    
    if (!data) {
      return []
    }
    
    const flaggedIds: string[] = []
    const encodedUsername = encodeUserKey(username)
    
    for (const [questionId, flags] of Object.entries(data)) {
      if (flags && typeof flags === 'object' && encodedUsername in flags) {
        flaggedIds.push(questionId)
      }
    }
    
    return flaggedIds
  } catch (error) {
    console.error("[v0] Error getting user flagged questions:", error)
    return []
  }
}

export async function getAllAdminEmails(): Promise<string[]> {
  try {
    // Try REST API first
    const { firebaseGet } = await import("./firebase-rest")
    const data = await firebaseGet("admins")
    
    if (!data) {
      return []
    }
    
    // Admins are stored as { "email,com": true } - decode the keys
    return Object.keys(data).map(key => key.replace(/,/g, "."))
  } catch (error) {
    console.error("[v0] Error getting admin emails:", error)
    return []
  }
}

export async function initializeFirstAdmin(email: string): Promise<boolean> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const admins = await firebaseGet("admins")

    if (!admins) {
      await addAdminEmail(email)
      return true
    }

    return false
  } catch (error) {
    console.error("[v0] Error initializing first admin:", error)
    return false
  }
}

export async function addAdminEmail(email: string): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    await firebaseSet(`admins/${email.replace(/\./g, ",")}`, true)
  } catch (error) {
    console.error("[v0] Error adding admin email:", error)
    throw error
  }
}

export async function removeAdminEmail(email: string): Promise<void> {
  try {
    const { firebaseRemove } = await import("./firebase-rest")
    await firebaseRemove(`admins/${email.replace(/\./g, ",")}`)
  } catch (error) {
    console.error("[v0] Error removing admin email:", error)
  }
}

export async function saveCategory(
  categoryId: string,
  name: string,
  description: string,
  icon?: string,
): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    await firebaseSet(`categories/${categoryId}`, {
      id: categoryId,
      name,
      description,
      ...(icon && { icon }),
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error saving category:", error)
    throw error
  }
}

export const addCategoryToFirebase = saveCategory

export async function getCategory(categoryId: string): Promise<SavedCategory | null> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const data = await firebaseGet(`categories/${categoryId}`)
    return data as SavedCategory | null
  } catch (error) {
    console.error("[v0] Error getting category:", error)
    return null
  }
}

export async function saveQuestionToFirebase(category: string, question: any): Promise<void> {
  try {
    const { firebaseSet } = await import("./firebase-rest")
    const questionKey = `${category}-${question.id}`
    await firebaseSet(`questions/${category}/${questionKey}`, question)
  } catch (error) {
    console.error("[v0] Error saving question to Firebase:", error)
    throw error
  }
}

export async function loadQuestionsFromFirebase(category: string): Promise<Record<string, any>> {
  try {
    const { firebaseGet } = await import("./firebase-rest")
    const data = await firebaseGet(`questions/${category}`)
    return data as Record<string, any> || {}
  } catch (error) {
    console.error("[v0] Error loading questions from Firebase:", error)
    return {}
  }
}
