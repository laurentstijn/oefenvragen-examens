import { db } from "./firebase-config"
import { ref, set, get, child, remove, update } from "firebase/database"

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
    const usersRef = ref(db, "users")
    const encodedUsername = encodeUserKey(username)
    const snapshot = await get(child(usersRef, encodedUsername))
    return snapshot.exists()
  } catch (error) {
    console.error("[v0] Error checking username:", error)
    return false
  }
}

export async function createUser(username: string, password: string): Promise<void> {
  try {
    const hashedPassword = await hashPassword(password)
    const encodedUsername = encodeUserKey(username)
    const userRef = ref(db, `users/${encodedUsername}`)
    await set(userRef, {
      username, // Store original username/email
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      incorrectQuestions: {},
      quizProgress: {},
      quizResults: {},
    })
    console.log("[v0] User created:", username)
  } catch (error) {
    console.error("[v0] Error creating user:", error)
    throw error
  }
}

export async function verifyPassword(username: string, password: string): Promise<boolean> {
  try {
    const encodedUsername = encodeUserKey(username)
    const userRef = ref(db, `users/${encodedUsername}`)
    const snapshot = await get(userRef)

    if (!snapshot.exists()) {
      return false
    }

    const userData = snapshot.val()
    const hashedPassword = await hashPassword(password)

    return userData.password === hashedPassword
  } catch (error) {
    console.error("[v0] Error verifying password:", error)
    return false
  }
}

export async function saveQuizResult(result: QuizResult, category = "radar") {
  try {
    const userRef = ref(db, `users/${encodeUserKey(result.username)}/${category}/quizResults/${result.setId}`)
    await set(userRef, {
      ...result,
      timestamp: typeof result.timestamp === "number" ? result.timestamp : new Date().getTime(),
    })

    console.log("[v0] Quiz result saved for user:", result.username, "category:", category)
    return result.setId
  } catch (error) {
    console.error("[v0] Error saving quiz result:", error)
    throw error
  }
}

export async function getUserStats(username: string, category = "radar"): Promise<UserStats> {
  try {
    const userRef = ref(db, `users/${encodeUserKey(username)}/${category}/quizResults`)
    const snapshot = await get(userRef)

    if (!snapshot.exists()) {
      return {
        totalQuizzes: 0,
        averageScore: 0,
        bestScore: 0,
        recentQuizzes: [],
      }
    }

    const results: QuizResult[] = []
    snapshot.forEach((childSnapshot) => {
      results.push({ ...childSnapshot.val(), id: childSnapshot.key } as QuizResult & { id: string })
    })

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
    throw error
  }
}

export async function getSetResults(username: string, setId: string, category = "radar") {
  try {
    const userRef = ref(db, `users/${encodeUserKey(username)}/${category}/quizResults/${setId}`)
    const snapshot = await get(userRef)

    if (!snapshot.exists()) {
      return []
    }

    const results: QuizResult[] = []
    snapshot.forEach((childSnapshot) => {
      results.push(childSnapshot.val() as QuizResult)
    })

    results.sort((a, b) => parseTimestamp(b.timestamp).getTime() - parseTimestamp(a.timestamp).getTime())
    return results.slice(0, 5)
  } catch (error) {
    console.error("[v0] Error getting set results:", error)
    return []
  }
}

export async function resetUserStats(username: string, category = "radar"): Promise<void> {
  try {
    const progressRef = ref(db, `users/${encodeUserKey(username)}/${category}/quizProgress`)
    const resultsRef = ref(db, `users/${encodeUserKey(username)}/${category}/quizResults`)
    const incorrectRef = ref(db, `users/${encodeUserKey(username)}/${category}/incorrectQuestions`)

    await remove(progressRef)
    await remove(resultsRef)
    await remove(incorrectRef)

    console.log("[v0] User stats and progress reset for:", username, "category:", category)
  } catch (error) {
    console.error("[v0] Error resetting user stats:", error)
    throw error
  }
}

export async function getSeriesAttempts(username: string, category = "radar"): Promise<Record<string, number>> {
  try {
    const userRef = ref(db, `users/${encodeUserKey(username)}/${category}/quizResults`)
    const snapshot = await get(userRef)

    if (!snapshot.exists()) {
      return {}
    }

    const attemptCounts: Record<string, number> = {}
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val()
      const setId = data.setId
      attemptCounts[setId] = (attemptCounts[setId] || 0) + 1
    })

    return attemptCounts
  } catch (error) {
    console.error("[v0] Error getting series attempts:", error)
    return {}
  }
}

export async function saveQuizProgress(progress: QuizProgress, category = "radar"): Promise<void> {
  try {
    const progressRef = ref(db, `users/${encodeUserKey(progress.username)}/${category}/quizProgress/${progress.setId}`)
    const cleanedProgress = {
      ...progress,
      answers: (progress.answers || []).map((answer) => (answer === null || answer === undefined ? "" : answer)),
      timestamp: typeof progress.timestamp === "number" ? progress.timestamp : new Date().getTime(),
    }
    await set(progressRef, cleanedProgress)
    console.log("[v0] Quiz progress saved for user:", progress.username, "category:", category)
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
    const progressRef = ref(db, `users/${encodeUserKey(username)}/${category}/quizProgress/${setId}`)
    const snapshot = await get(progressRef)

    if (!snapshot.exists()) {
      return null
    }

    return snapshot.val() as QuizProgress
  } catch (error) {
    console.error("[v0] Error getting quiz progress:", error)
    return null
  }
}

export async function getAllQuizProgress(username: string, category = "radar"): Promise<Record<string, QuizProgress>> {
  try {
    const progressRef = ref(db, `users/${encodeUserKey(username)}/${category}/quizProgress`)
    const snapshot = await get(progressRef)

    if (!snapshot.exists()) {
      return {}
    }

    return snapshot.val() as Record<string, QuizProgress>
  } catch (error) {
    console.error("[v0] Error getting all quiz progress:", error)
    return {}
  }
}

export async function clearQuizProgress(username: string, setId: string, category = "radar"): Promise<void> {
  try {
    const progressRef = ref(db, `users/${encodeUserKey(username)}/${category}/quizProgress/${setId}`)
    await remove(progressRef)
    console.log("[v0] Quiz progress cleared for user:", username, "category:", category)
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
    const incorrectRef = ref(db, `users/${encodeUserKey(username)}/${category}/incorrectQuestions/${questionId}`)
    await set(incorrectRef, {
      questionId,
      addedAt: new Date().toISOString(),
    })
    console.log("[v0] Added incorrect question:", questionId, "category:", category)
  } catch (error) {
    console.error("[v0] Error adding incorrect question:", error)
    throw error
  }
}

export async function removeIncorrectQuestion(username: string, questionId: number, category = "radar"): Promise<void> {
  try {
    const incorrectRef = ref(db, `users/${encodeUserKey(username)}/${category}/incorrectQuestions/${questionId}`)
    await remove(incorrectRef)
    console.log("[v0] Removed incorrect question:", questionId, "category:", category)
  } catch (error) {
    console.error("[v0] Error removing incorrect question:", error)
  }
}

export async function getIncorrectQuestions(username: string, category = "radar"): Promise<number[]> {
  try {
    const incorrectRef = ref(db, `users/${encodeUserKey(username)}/${category}/incorrectQuestions`)
    const snapshot = await get(incorrectRef)

    if (!snapshot.exists()) {
      return []
    }

    const incorrectIds: number[] = []
    snapshot.forEach((childSnapshot) => {
      incorrectIds.push(childSnapshot.val().questionId)
    })

    return incorrectIds.sort((a, b) => a - b)
  } catch (error) {
    console.error("[v0] Error getting incorrect questions:", error)
    return []
  }
}

export async function userHasPassword(username: string): Promise<boolean> {
  try {
    const userRef = ref(db, `users/${encodeUserKey(username)}`)
    const snapshot = await get(userRef)

    if (!snapshot.exists()) {
      return false
    }

    const userData = snapshot.val()
    return !!userData.password
  } catch (error) {
    console.error("[v0] Error checking if user has password:", error)
    return false
  }
}

export async function setPasswordForUser(username: string, password: string): Promise<void> {
  try {
    const hashedPassword = await hashPassword(password)
    const userRef = ref(db, `users/${encodeUserKey(username)}/password`)
    await set(userRef, hashedPassword)
    console.log("[v0] Password set for existing user:", username)
  } catch (error) {
    console.error("[v0] Error setting password for user:", error)
    throw error
  }
}

export async function updateLastActive(username: string): Promise<void> {
  try {
    const lastActiveRef = ref(db, `users/${encodeUserKey(username)}/lastActive`)
    await set(lastActiveRef, new Date().toISOString())
  } catch (error) {
    console.error("[v0] Error updating last active:", error)
  }
}

export async function checkAdminAccess(email: string): Promise<boolean> {
  try {
    const encodedEmail = email.replace(/\./g, ",")
    const adminRef = ref(db, `admins/${encodedEmail}`)
    console.log("[v0] Checking admin access for email:", email)
    console.log("[v0] Encoded Firebase key:", encodedEmail)

    const snapshot = await get(adminRef)
    console.log("[v0] Firebase snapshot exists:", snapshot.exists())
    console.log("[v0] Firebase snapshot value:", snapshot.val())

    const isAdmin = snapshot.exists() && snapshot.val() === true

    if (isAdmin) {
      console.log("[v0] Admin access granted from Firebase:", email)
    } else {
      console.log("[v0] Admin access denied for:", email)
    }

    return isAdmin
  } catch (error) {
    console.error("[v0] Error checking admin access from database:", error)
    return false
  }
}

export async function addAdminEmail(email: string): Promise<void> {
  try {
    const adminRef = ref(db, `admins/${email.replace(/\./g, ",")}`)
    await set(adminRef, true)
    console.log("[v0] Admin email added:", email)
  } catch (error) {
    console.error("[v0] Error adding admin email:", error)
    throw error
  }
}

export async function removeAdminEmail(email: string): Promise<void> {
  try {
    const adminRef = ref(db, `admins/${email.replace(/\./g, ",")}`)
    await remove(adminRef)
    console.log("[v0] Admin email removed:", email)
  } catch (error) {
    console.error("[v0] Error removing admin email:", error)
  }
}

export async function getAllAdminEmails(): Promise<string[]> {
  try {
    const adminsRef = ref(db, "admins")
    const snapshot = await get(adminsRef)
    if (!snapshot.exists()) {
      return []
    }
    const admins = snapshot.val()
    return Object.keys(admins).map((key) => key.replace(/,/g, "."))
  } catch (error) {
    console.error("[v0] Error getting admin emails:", error)
    return []
  }
}

export async function initializeFirstAdmin(email: string): Promise<boolean> {
  try {
    const adminsRef = ref(db, "admins")
    const snapshot = await get(adminsRef)

    // If no admins exist, add this user as the first admin
    if (!snapshot.exists()) {
      console.log("[v0] No admins found, initializing first admin:", email)
      await addAdminEmail(email)
      return true
    }

    return false
  } catch (error) {
    console.error("[v0] Error initializing first admin:", error)
    return false
  }
}

export async function saveQuestionToFirebase(category: string, question: any): Promise<void> {
  try {
    const questionKey = `${category}-${question.id}`
    const questionRef = ref(db, `questions/${category}/${questionKey}`)
    await set(questionRef, question)
    console.log("[v0] Question saved to Firebase:", questionKey)
  } catch (error) {
    console.error("[v0] Error saving question to Firebase:", error)
    throw error
  }
}

export async function loadQuestionsFromFirebase(category: string): Promise<Record<string, any>> {
  try {
    const questionsRef = ref(db, `questions/${category}`)
    const snapshot = await get(questionsRef)

    if (!snapshot.exists()) {
      console.log("[v0] No Firebase questions found for", category)
      return {}
    }

    const questions: Record<string, any> = {}
    snapshot.forEach((childSnapshot) => {
      console.log("[v0] Loading question with Firebase key:", childSnapshot.key)
      questions[childSnapshot.key as string] = childSnapshot.val()
    })

    console.log("[v0] Loaded", Object.keys(questions).length, "Firebase questions for", category)
    console.log("[v0] Firebase keys loaded:", Object.keys(questions).join(", "))
    return questions
  } catch (error) {
    console.error("[v0] Error loading questions from Firebase:", error)
    throw error
  }
}

export async function saveCategory(
  categoryId: string,
  name: string,
  description: string,
  icon?: string,
): Promise<void> {
  try {
    const categoryRef = ref(db, `categories/${categoryId}`)
    await set(categoryRef, {
      id: categoryId,
      name,
      description,
      ...(icon && { icon }), // Only include icon if provided
      createdAt: new Date().toISOString(),
    })
    console.log("[v0] Category metadata saved:", categoryId)
  } catch (error) {
    console.error("[v0] Error saving category:", error)
    throw error
  }
}

export const addCategoryToFirebase = saveCategory

export async function getCategory(categoryId: string): Promise<SavedCategory | null> {
  try {
    const categoryRef = ref(db, `categories/${categoryId}`)
    const snapshot = await get(categoryRef)

    if (!snapshot.exists()) {
      return null
    }

    return snapshot.val() as SavedCategory
  } catch (error) {
    console.error("[v0] Error getting category:", error)
    return null
  }
}

export async function getAllCategories(): Promise<SavedCategory[]> {
  try {
    const categoriesRef = ref(db, "categories")
    const snapshot = await get(categoriesRef)

    if (!snapshot.exists()) {
      return []
    }

    const categories: SavedCategory[] = []
    snapshot.forEach((childSnapshot) => {
      categories.push(childSnapshot.val() as SavedCategory)
    })

    return categories
  } catch (error) {
    console.error("[v0] Error getting all categories:", error)
    return []
  }
}

export async function deleteCategory(categoryId: string): Promise<void> {
  try {
    console.log("[v0] Starting category deletion for:", categoryId)

    const categoryRef = ref(db, `categories/${categoryId}`)
    await remove(categoryRef)
    console.log("[v0] Deleted category metadata at:", `categories/${categoryId}`)

    const statusRef = ref(db, `categoryStatus/${categoryId}`)
    await remove(statusRef)
    console.log("[v0] Deleted category status at:", `categoryStatus/${categoryId}`)

    const questionsRef = ref(db, `questions/${categoryId}`)

    const questionsSnapshot = await get(questionsRef)
    if (questionsSnapshot.exists()) {
      const questionCount = Object.keys(questionsSnapshot.val()).length
      console.log("[v0] Found", questionCount, "questions to delete at:", `questions/${categoryId}`)
    } else {
      console.log("[v0] No questions found at:", `questions/${categoryId}`)
    }

    await remove(questionsRef)
    console.log("[v0] Deleted all questions at:", `questions/${categoryId}`)

    const editsRef = ref(db, "questionEdits")
    const editsSnapshot = await get(editsRef)

    if (editsSnapshot.exists()) {
      const edits = editsSnapshot.val()
      const editsToDelete: string[] = []

      // Find all edits that belong to this category (keys like "categoryId-1", "categoryId-2", etc.)
      Object.keys(edits).forEach((editKey) => {
        if (editKey.startsWith(`${categoryId}-`)) {
          editsToDelete.push(editKey)
        }
      })

      if (editsToDelete.length > 0) {
        console.log("[v0] Found", editsToDelete.length, "questionEdits to delete for category:", categoryId)

        // Delete each edit
        for (const editKey of editsToDelete) {
          const editRef = ref(db, `questionEdits/${editKey}`)
          await remove(editRef)
        }

        console.log("[v0] Deleted all questionEdits for category:", categoryId)
      } else {
        console.log("[v0] No questionEdits found for category:", categoryId)
      }
    }

    console.log("[v0] Category and all its questions deleted:", categoryId)
  } catch (error) {
    console.error("[v0] Error deleting category:", error)
    throw error
  }
}

export async function saveCategoryStatus(categoryId: string, status: string): Promise<void> {
  try {
    const statusRef = ref(db, `categoryStatus/${categoryId}`)
    await set(statusRef, {
      status,
      updatedAt: new Date().toISOString(),
    })
    console.log("[v0] Category status saved:", categoryId, status)
  } catch (error) {
    console.error("[v0] Error saving category status:", error)
    throw error
  }
}

export async function getCategoryStatus(categoryId: string): Promise<string | null> {
  try {
    const statusRef = ref(db, `categoryStatus/${categoryId}`)
    const snapshot = await get(statusRef)

    if (!snapshot.exists()) {
      return null
    }

    return snapshot.val().status
  } catch (error) {
    console.error("[v0] Error getting category status:", error)
    return null
  }
}

export async function getAllCategoryStatuses(): Promise<Record<string, string>> {
  try {
    const statusRef = ref(db, "categoryStatus")
    const snapshot = await get(statusRef)

    if (!snapshot.exists()) {
      return {}
    }

    const statuses: Record<string, string> = {}
    snapshot.forEach((childSnapshot) => {
      const statusValue = childSnapshot.val()
      statuses[childSnapshot.key as string] =
        typeof statusValue === "string" ? statusValue : statusValue?.status || "actief"
    })

    return statuses
  } catch (error) {
    console.error("[v0] Error getting all category statuses:", error)
    return {}
  }
}

export async function getAllQuestions(category: string): Promise<Record<string, any>> {
  try {
    const questionsRef = ref(db, `questions/${category}`)
    const snapshot = await get(questionsRef)

    if (!snapshot.exists()) {
      console.log("[v0] No Firebase questions found for", category)
      return {}
    }

    const questions: Record<string, any> = {}
    snapshot.forEach((childSnapshot) => {
      questions[childSnapshot.key as string] = childSnapshot.val()
    })

    console.log("[v0] Loaded", Object.keys(questions).length, "Firebase questions for", category)
    return questions
  } catch (error) {
    console.error("[v0] Error getting Firebase questions:", error)
    return {}
  }
}

export async function getDeletedQuestions(category: string): Promise<string[]> {
  try {
    const deletedRef = ref(db, `deletedQuestions/${category}`)
    const snapshot = await get(deletedRef)

    if (!snapshot.exists()) {
      return []
    }

    const deletedIds: string[] = []
    snapshot.forEach((childSnapshot) => {
      deletedIds.push(childSnapshot.key as string)
    })

    console.log("[v0] Loaded", deletedIds.length, "deleted question markers for", category)
    return deletedIds
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
    console.log("[v0] Starting timestamp migration...")
    const usersRef = ref(db, "users")
    const snapshot = await get(usersRef)

    if (!snapshot.exists()) {
      return {
        success: true,
        message: "Geen gebruikers gevonden om te migreren",
        details: {},
      }
    }

    const migrationDetails: Record<string, any> = {}
    let totalMigrated = 0

    for (const userSnapshot of Object.values(snapshot.val() as Record<string, any>)) {
      const username = userSnapshot.username
      if (!username) continue

      const userDetails: any = {
        createdAt: false,
        lastActive: false,
        quizResults: 0,
        quizProgress: 0,
      }

      // Migrate createdAt
      if (userSnapshot.createdAt && typeof userSnapshot.createdAt === "number") {
        const userRef = ref(db, `users/${encodeUserKey(username)}/createdAt`)
        await set(userRef, new Date(userSnapshot.createdAt).toISOString())
        userDetails.createdAt = true
        totalMigrated++
      }

      // Migrate lastActive
      if (userSnapshot.lastActive && typeof userSnapshot.lastActive === "number") {
        const userRef = ref(db, `users/${encodeUserKey(username)}/lastActive`)
        await set(userRef, new Date(userSnapshot.lastActive).toISOString())
        userDetails.lastActive = true
        totalMigrated++
      }

      // Migrate quiz results timestamps
      if (userSnapshot.quizResults) {
        for (const [categoryId, categoryData] of Object.entries(userSnapshot.quizResults as Record<string, any>)) {
          if (categoryData && typeof categoryData === "object") {
            for (const [resultId, result] of Object.entries(categoryData as Record<string, any>)) {
              if (result && typeof result === "object" && typeof result.timestamp === "number") {
                const resultRef = ref(
                  db,
                  `users/${encodeUserKey(username)}/quizResults/${categoryId}/${resultId}/timestamp`,
                )
                await set(resultRef, new Date(result.timestamp).toISOString())
                userDetails.quizResults++
                totalMigrated++
              }
            }
          }
        }
      }

      // Migrate quiz progress timestamps
      if (userSnapshot.quizProgress) {
        for (const [categoryId, categoryData] of Object.entries(userSnapshot.quizProgress as Record<string, any>)) {
          if (categoryData && typeof categoryData === "object") {
            for (const [progressId, progress] of Object.entries(categoryData as Record<string, any>)) {
              if (progress && typeof progress === "object" && typeof progress.timestamp === "number") {
                const progressRef = ref(
                  db,
                  `users/${encodeUserKey(username)}/quizProgress/${categoryId}/${progressId}/timestamp`,
                )
                await set(progressRef, new Date(progress.timestamp).toISOString())
                userDetails.quizProgress++
                totalMigrated++
              }
            }
          }
        }
      }

      if (Object.values(userDetails).some((v) => v !== false && v !== 0)) {
        migrationDetails[username] = userDetails
      }
    }

    console.log("[v0] Timestamp migration completed:", totalMigrated, "timestamps converted")

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
    console.log("[v0] Starting migration of static questions to Firebase...")

    const { radarQuestionSets } = await import("@/lib/radar-data")
    const { matrozenQuestionSets } = await import("@/lib/matrozen-data")

    let radarMigrated = 0
    let radarSkipped = 0
    let matrozenMigrated = 0
    let matrozenSkipped = 0
    const errors: string[] = []

    try {
      await saveCategory("radar", "Radar", "Oefenvragen voor Radar")
      await saveCategory("matrozen", "Matroos", "Oefenvragen voor Matroos")
      console.log("[v0] Categories registered in Firebase")
    } catch (error) {
      console.error("[v0] Error registering categories:", error)
    }

    // Migrate radar questions
    console.log("[v0] Migrating radar questions...")
    for (const questionSet of radarQuestionSets) {
      for (const question of questionSet.questions) {
        try {
          const questionId = `radar-${question.id}`
          const questionRef = ref(db, `questions/radar/${questionId}`)

          // Check if already exists
          const snapshot = await get(questionRef)
          if (snapshot.exists()) {
            radarSkipped++
            continue
          }

          const questionData = {
            id: questionId,
            question: question.question,
            options: question.options,
            correctAnswer: question.correct.toUpperCase(), // Convert 'correct' to 'correctAnswer' and uppercase
            reeks: normalizeReeks(questionSet.setId),
            image: question.image || null,
            optionImages: question.optionImages || {},
          }

          await set(questionRef, questionData)
          radarMigrated++
        } catch (error) {
          errors.push(`Radar ${question.id}: ${error}`)
        }
      }
    }

    // Migrate matrozen questions
    console.log("[v0] Migrating matrozen questions...")
    for (const questionSet of matrozenQuestionSets) {
      for (const question of questionSet.questions) {
        try {
          const questionId = `matrozen-${question.id}`
          const questionRef = ref(db, `questions/matrozen/${questionId}`)

          // Check if already exists
          const snapshot = await get(questionRef)
          if (snapshot.exists()) {
            matrozenSkipped++
            continue
          }

          const questionData = {
            id: questionId,
            question: question.question,
            options: question.options,
            correctAnswer: question.correct.toUpperCase(), // Convert 'correct' to 'correctAnswer' and uppercase
            reeks: normalizeReeks(questionSet.setId),
            image: question.image || null,
            optionImages: question.optionImages || {},
          }

          await set(questionRef, questionData)
          matrozenMigrated++
        } catch (error) {
          errors.push(`Matrozen ${question.id}: ${error}`)
        }
      }
    }

    const result = {
      success: errors.length === 0,
      radarMigrated,
      radarSkipped,
      matrozenMigrated,
      matrozenSkipped,
      errors,
    }

    console.log("[v0] Migration completed!", result)
    return result
  } catch (error) {
    console.error("[v0] Migration failed:", error)
    throw error
  }
}

export async function updateExistingQuestionsWithReeks() {
  try {
    console.log("[v0] Starting update of existing questions with reeks...")

    let radarUpdated = 0
    let matrozenUpdated = 0
    const errors: string[] = []

    // Update radar questions - 251 total across 5 sets
    // set1: 1-50, set2: 51-100, set3: 101-150, set4: 151-200, set5: 201-251
    console.log("[v0] Updating radar questions with reeks...")
    const radarQuestionsRef = ref(db, "questions/radar")
    const radarSnapshot = await get(radarQuestionsRef)

    if (radarSnapshot.exists()) {
      const radarQuestions = radarSnapshot.val()

      for (const [questionId, questionData] of Object.entries(radarQuestions)) {
        try {
          // Extract question number from ID (e.g., "radar-1" -> 1)
          const match = questionId.match(/radar-(\d+)/)
          if (!match) continue

          const questionNum = Number.parseInt(match[1])

          // Determine reeks based on question number
          let reeks = "1"
          if (questionNum >= 1 && questionNum <= 50) {
            reeks = "1"
          } else if (questionNum >= 51 && questionNum <= 100) {
            reeks = "2"
          } else if (questionNum >= 101 && questionNum <= 150) {
            reeks = "3"
          } else if (questionNum >= 151 && questionNum <= 200) {
            reeks = "4"
          } else if (questionNum >= 201 && questionNum <= 251) {
            reeks = "5"
          }

          console.log(`[v0] Updating ${questionId} (question ${questionNum}) → reeks ${reeks}`)

          const questionRef = ref(db, `questions/radar/${questionId}`)
          await set(questionRef, {
            ...(questionData as Record<string, unknown>),
            reeks,
          })
          radarUpdated++
        } catch (error) {
          errors.push(`Radar ${questionId}: ${error}`)
        }
      }
    }

    // Update matrozen questions - currently only a few, all go to reeks 1
    console.log("[v0] Updating matrozen questions with reeks...")
    const matrozenQuestionsRef = ref(db, "questions/matrozen")
    const matrozenSnapshot = await get(matrozenQuestionsRef)

    if (matrozenSnapshot.exists()) {
      const matrozenQuestions = matrozenSnapshot.val()

      for (const [questionId, questionData] of Object.entries(matrozenQuestions)) {
        try {
          const questionRef = ref(db, `questions/matrozen/${questionId}`)
          await set(questionRef, {
            ...(questionData as Record<string, unknown>),
            reeks: "1",
          })
          matrozenUpdated++
        } catch (error) {
          errors.push(`Matrozen ${questionId}: ${error}`)
        }
      }
    }

    const result = {
      success: errors.length === 0,
      radarUpdated,
      matrozenUpdated,
      errors,
    }

    console.log("[v0] Update completed!", result)
    return result
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
    console.log(`[v0] Renaming series "${oldSeriesName}" to "${newSeriesName}" in category ${categoryId}`)

    const questionsRef = ref(db, `questions/${categoryId}`)
    const snapshot = await get(questionsRef)

    if (!snapshot.exists()) {
      return { success: false, updatedCount: 0 }
    }

    let updatedCount = 0
    const updates: Record<string, any> = {}

    snapshot.forEach((childSnapshot) => {
      const questionData = childSnapshot.val()
      if (questionData.reeks === oldSeriesName) {
        updates[`${childSnapshot.key}/reeks`] = newSeriesName
        updatedCount++
      }
    })

    if (updatedCount > 0) {
      await update(questionsRef, updates)
      console.log(`[v0] Successfully renamed series. Updated ${updatedCount} questions.`)
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
    console.log(`[v0] Deleting series "${seriesName}" from category ${categoryId}`)

    const questionsRef = ref(db, `questions/${categoryId}`)
    const snapshot = await get(questionsRef)

    if (!snapshot.exists()) {
      return { success: false, deletedCount: 0 }
    }

    let deletedCount = 0
    const keysToDelete: string[] = []

    snapshot.forEach((childSnapshot) => {
      const questionData = childSnapshot.val()
      if (questionData.reeks === seriesName) {
        keysToDelete.push(childSnapshot.key as string)
        deletedCount++
      }
    })

    if (keysToDelete.length > 0) {
      const updates: Record<string, null> = {}
      for (const key of keysToDelete) {
        updates[key] = null
      }
      await update(questionsRef, updates)
      console.log(`[v0] Successfully deleted series. Removed ${deletedCount} questions.`)
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
    console.log(`[v0] Renaming category ID from "${oldCategoryId}" to "${newCategoryId}"`)

    const oldQuestionsRef = ref(db, `questions/${oldCategoryId}`)
    const snapshot = await get(oldQuestionsRef)

    if (!snapshot.exists()) {
      console.log(`[v0] No questions found for category ${oldCategoryId}`)
      return { success: true, movedQuestionsCount: 0 }
    }

    const questions: Record<string, any> = {}
    let movedCount = 0

    snapshot.forEach((childSnapshot) => {
      const questionData = childSnapshot.val()
      const oldId = childSnapshot.key as string

      // Update the question ID to use the new category ID
      const newId = oldId.replace(new RegExp(`^${oldCategoryId}-`), `${newCategoryId}-`)

      questions[newId] = {
        ...questionData,
        // Keep the numeric id field as is, only update the Firebase key
      }
      movedCount++
    })

    // Write questions to new category path
    const newQuestionsRef = ref(db, `questions/${newCategoryId}`)
    await set(newQuestionsRef, questions)

    // Delete old category questions
    await remove(oldQuestionsRef)

    console.log(`[v0] Successfully moved ${movedCount} questions from ${oldCategoryId} to ${newCategoryId}`)
    return { success: true, movedQuestionsCount: movedCount }
  } catch (error) {
    console.error("[v0] Error renaming category ID:", error)
    return { success: false, movedQuestionsCount: 0 }
  }
}
