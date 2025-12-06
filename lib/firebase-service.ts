import { db } from "./firebase-config"
import { ref, set, get, child, remove } from "firebase/database"

export interface QuizResult {
  username: string
  setId: string
  setName: string
  score: number
  totalQuestions: number
  percentage: number
  answersGiven: (string | null)[]
  correctAnswers: string[]
  timestamp: number
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
  timestamp: number
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
  timestamp: number
}

export interface MigrationReport {
  usersFound: string[]
  progressMigrated: Record<string, number>
  resultsMigrated: Record<string, number>
  incorrectQuestionsMigrated: Record<string, number>
  errors: string[]
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function checkUsernameExists(username: string): Promise<boolean> {
  try {
    const usersRef = ref(db, "users")
    const snapshot = await get(child(usersRef, username))
    return snapshot.exists()
  } catch (error) {
    console.error("[v0] Error checking username:", error)
    return false
  }
}

export async function createUser(username: string, password: string): Promise<void> {
  try {
    const hashedPassword = await hashPassword(password)
    const userRef = ref(db, `users/${username}`)
    await set(userRef, {
      username,
      password: hashedPassword,
      createdAt: Date.now(),
      lastActive: Date.now(), // Track last activity
      incorrectQuestions: {},
      quizProgress: {}, // New field for quiz progress
      quizResults: {}, // New field for quiz results
    })
    console.log("[v0] User created:", username)
  } catch (error) {
    console.error("[v0] Error creating user:", error)
    throw error
  }
}

export async function verifyPassword(username: string, password: string): Promise<boolean> {
  try {
    const userRef = ref(db, `users/${username}`)
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

export async function saveQuizResult(result: QuizResult) {
  try {
    const userRef = ref(db, `users/${result.username}/quizResults/${result.setId}`)
    await set(userRef, {
      ...result,
      timestamp: Date.now(),
    })

    console.log("[v0] Quiz result saved for user:", result.username)
    return result.setId
  } catch (error) {
    console.error("[v0] Error saving quiz result:", error)
    throw error
  }
}

export async function getUserStats(username: string): Promise<UserStats> {
  try {
    const userRef = ref(db, `users/${username}/quizResults`)
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

    results.sort((a, b) => b.timestamp - a.timestamp)

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

export async function getSetResults(username: string, setId: string) {
  try {
    const userRef = ref(db, `users/${username}/quizResults/${setId}`)
    const snapshot = await get(userRef)

    if (!snapshot.exists()) {
      return []
    }

    const results: QuizResult[] = []
    snapshot.forEach((childSnapshot) => {
      results.push(childSnapshot.val() as QuizResult)
    })

    results.sort((a, b) => b.timestamp - a.timestamp)
    return results.slice(0, 5)
  } catch (error) {
    console.error("[v0] Error getting set results:", error)
    throw error
  }
}

export async function resetUserStats(username: string): Promise<void> {
  try {
    const progressRef = ref(db, `users/${username}/quizProgress`)
    const resultsRef = ref(db, `users/${username}/quizResults`)
    const incorrectRef = ref(db, `users/${username}/incorrectQuestions`)

    await remove(progressRef)
    await remove(resultsRef)
    await remove(incorrectRef)

    console.log("[v0] User stats and progress reset for:", username)
  } catch (error) {
    console.error("[v0] Error resetting user stats:", error)
    throw error
  }
}

export async function getSeriesAttempts(username: string): Promise<Record<string, number>> {
  try {
    const userRef = ref(db, `users/${username}/quizResults`)
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

export async function saveQuizProgress(progress: QuizProgress): Promise<void> {
  try {
    const progressRef = ref(db, `users/${progress.username}/quizProgress/${progress.setId}`)
    const cleanedProgress = {
      ...progress,
      answers: (progress.answers || []).map((answer) => (answer === null || answer === undefined ? "" : answer)),
      timestamp: Date.now(),
    }
    await set(progressRef, cleanedProgress)
    console.log("[v0] Quiz progress saved for user:", progress.username)
  } catch (error) {
    console.error("[v0] Error saving quiz progress:", error)
    throw error
  }
}

export async function getQuizProgress(username: string, setId: string): Promise<QuizProgress | null> {
  try {
    const progressRef = ref(db, `users/${username}/quizProgress/${setId}`)
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

export async function getAllQuizProgress(username: string): Promise<Record<string, QuizProgress>> {
  try {
    const progressRef = ref(db, `users/${username}/quizProgress`)
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

export async function clearQuizProgress(username: string, setId: string): Promise<void> {
  try {
    const progressRef = ref(db, `users/${username}/quizProgress/${setId}`)
    await remove(progressRef)
    console.log("[v0] Quiz progress cleared for user:", username)
  } catch (error) {
    console.error("[v0] Error clearing quiz progress:", error)
  }
}

export async function getWrongAnswers(username: string): Promise<{ questionId: number; correctAnswer: string }[]> {
  try {
    const incorrectIds = await getIncorrectQuestions(username)

    return incorrectIds.map((id) => ({
      questionId: id,
      correctAnswer: "", // Will be filled from questions data
    }))
  } catch (error) {
    console.error("[v0] Error getting wrong answers:", error)
    return []
  }
}

export async function addIncorrectQuestion(username: string, questionId: number): Promise<void> {
  try {
    const incorrectRef = ref(db, `users/${username}/incorrectQuestions/${questionId}`)
    await set(incorrectRef, {
      questionId,
      addedAt: Date.now(),
    })
    console.log("[v0] Added incorrect question:", questionId)
  } catch (error) {
    console.error("[v0] Error adding incorrect question:", error)
    throw error
  }
}

export async function removeIncorrectQuestion(username: string, questionId: number): Promise<void> {
  try {
    const incorrectRef = ref(db, `users/${username}/incorrectQuestions/${questionId}`)
    await remove(incorrectRef)
    console.log("[v0] Removed incorrect question:", questionId)
  } catch (error) {
    console.error("[v0] Error removing incorrect question:", error)
  }
}

export async function getIncorrectQuestions(username: string): Promise<number[]> {
  try {
    const incorrectRef = ref(db, `users/${username}/incorrectQuestions`)
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
    const userRef = ref(db, `users/${username}`)
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
    const userRef = ref(db, `users/${username}/password`)
    await set(userRef, hashedPassword)
    console.log("[v0] Password set for existing user:", username)
  } catch (error) {
    console.error("[v0] Error setting password for user:", error)
    throw error
  }
}

export async function saveQuestionEdit(questionId: number, edits: Partial<QuestionEdit>): Promise<void> {
  try {
    const editRef = ref(db, `questionEdits/${questionId}`)
    await set(editRef, {
      id: questionId,
      ...edits,
      timestamp: Date.now(),
    })
    console.log("[v0] Question edit saved:", questionId)
  } catch (error) {
    console.error("[v0] Error saving question edit:", error)
    throw error
  }
}

export async function getQuestionEdits(): Promise<Map<number, QuestionEdit>> {
  try {
    const editsRef = ref(db, "questionEdits")
    const snapshot = await get(editsRef)

    if (!snapshot.exists()) {
      return new Map()
    }

    const edits = new Map<number, QuestionEdit>()
    snapshot.forEach((childSnapshot) => {
      const edit = childSnapshot.val() as QuestionEdit
      edits.set(edit.id, edit)
    })

    console.log("[v0] Loaded", edits.size, "question edits from Firebase")
    return edits
  } catch (error) {
    console.error("[v0] Error getting question edits:", error)
    return new Map()
  }
}

export async function deleteQuestionEdit(questionId: number): Promise<void> {
  try {
    const editRef = ref(db, `questionEdits/${questionId}`)
    await remove(editRef)
    console.log("[v0] Question edit deleted:", questionId)
  } catch (error) {
    console.error("[v0] Error deleting question edit:", error)
  }
}

export async function updateLastActive(username: string): Promise<void> {
  try {
    const lastActiveRef = ref(db, `users/${username}/lastActive`)
    await set(lastActiveRef, Date.now())
  } catch (error) {
    console.error("[v0] Error updating last active:", error)
  }
}

export async function checkOldDataExists(): Promise<{
  hasOldProgress: boolean
  hasOldResults: boolean
  hasOldIncorrect: boolean
}> {
  try {
    const progressRef = ref(db, "quizProgress")
    const resultsRef = ref(db, "quizResults")
    const incorrectRef = ref(db, "incorrectQuestions")

    const [progressSnapshot, resultsSnapshot, incorrectSnapshot] = await Promise.all([
      get(progressRef).catch(() => null),
      get(resultsRef).catch(() => null),
      get(incorrectRef).catch(() => null),
    ])

    return {
      hasOldProgress: progressSnapshot?.exists() ?? false,
      hasOldResults: resultsSnapshot?.exists() ?? false,
      hasOldIncorrect: incorrectSnapshot?.exists() ?? false,
    }
  } catch (error) {
    console.error("[v0] Error checking old data:", error)
    return { hasOldProgress: false, hasOldResults: false, hasOldIncorrect: false }
  }
}

export async function inspectOldData(): Promise<{
  oldProgress: Record<string, any>
  oldResults: Record<string, any>
  oldIncorrect: Record<string, any>
}> {
  try {
    const progressRef = ref(db, "quizProgress")
    const resultsRef = ref(db, "quizResults")
    const incorrectRef = ref(db, "incorrectQuestions")

    const [progressSnapshot, resultsSnapshot, incorrectSnapshot] = await Promise.all([
      get(progressRef).catch(() => null),
      get(resultsRef).catch(() => null),
      get(incorrectRef).catch(() => null),
    ])

    return {
      oldProgress: progressSnapshot?.exists() ? progressSnapshot.val() : {},
      oldResults: resultsSnapshot?.exists() ? resultsSnapshot.val() : {},
      oldIncorrect: incorrectSnapshot?.exists() ? incorrectSnapshot.val() : {},
    }
  } catch (error) {
    console.error("[v0] Error inspecting old data:", error)
    return { oldProgress: {}, oldResults: {}, oldIncorrect: {} }
  }
}

export async function deleteOldDataNodes(): Promise<void> {
  try {
    const progressRef = ref(db, "quizProgress")
    const resultsRef = ref(db, "quizResults")
    const incorrectRef = ref(db, "incorrectQuestions")

    await Promise.all([remove(progressRef), remove(resultsRef), remove(incorrectRef)])

    console.log("[v0] Old data nodes deleted successfully")
  } catch (error) {
    console.error("[v0] Error deleting old data nodes:", error)
    throw error
  }
}

export async function migrateOldDataToNewStructure(): Promise<MigrationReport> {
  const report: MigrationReport = {
    usersFound: [],
    progressMigrated: {},
    resultsMigrated: {},
    incorrectQuestionsMigrated: {},
    errors: [],
  }

  try {
    console.log("[v0] Starting migration...")

    // Get all existing users first
    const usersRef = ref(db, "users")
    const usersSnapshot = await get(usersRef)
    const existingUsers: string[] = []

    if (usersSnapshot.exists()) {
      usersSnapshot.forEach((child) => {
        existingUsers.push(child.key as string)
      })
    }

    console.log("[v0] Existing users found:", existingUsers)

    // Get old data
    const oldData = await inspectOldData()
    console.log("[v0] Old data found:", {
      progress: Object.keys(oldData.oldProgress),
      results: Object.keys(oldData.oldResults),
      incorrect: Object.keys(oldData.oldIncorrect),
    })

    // Migrate quizProgress
    if (Object.keys(oldData.oldProgress).length > 0) {
      for (const [username, progressData] of Object.entries(oldData.oldProgress)) {
        if (!existingUsers.includes(username)) {
          report.errors.push(`User ${username} not found in users/ node, skipping progress migration`)
          continue
        }

        try {
          report.usersFound.push(username)
          let count = 0

          for (const [setId, progress] of Object.entries(progressData as Record<string, any>)) {
            const newProgressRef = ref(db, `users/${username}/quizProgress/${setId}`)
            await set(newProgressRef, progress)
            console.log(`[v0] Migrated progress for ${username}/${setId}`)
            count++
          }

          report.progressMigrated[username] = count
        } catch (error) {
          report.errors.push(`Error migrating progress for ${username}: ${error}`)
        }
      }
    }

    // Migrate quizResults
    if (Object.keys(oldData.oldResults).length > 0) {
      for (const [resultId, resultData] of Object.entries(oldData.oldResults)) {
        try {
          const result = resultData as any
          const username = result.username

          if (!username) {
            report.errors.push(`Result ${resultId} has no username field, skipping`)
            continue
          }

          if (!existingUsers.includes(username)) {
            report.errors.push(`User ${username} not found in users/ node, skipping result ${resultId}`)
            continue
          }

          if (!report.usersFound.includes(username)) {
            report.usersFound.push(username)
          }

          // Copy result to users/[username]/quizResults/[resultId]
          const newResultRef = ref(db, `users/${username}/quizResults/${resultId}`)
          await set(newResultRef, result)
          console.log(`[v0] Migrated result ${resultId} for ${username}`)

          report.resultsMigrated[username] = (report.resultsMigrated[username] || 0) + 1
        } catch (error) {
          report.errors.push(`Error migrating result ${resultId}: ${error}`)
        }
      }
    }

    // Migrate incorrectQuestions
    if (Object.keys(oldData.oldIncorrect).length > 0) {
      for (const [username, incorrectData] of Object.entries(oldData.oldIncorrect)) {
        if (!existingUsers.includes(username)) {
          report.errors.push(`User ${username} not found in users/ node, skipping incorrect questions migration`)
          continue
        }

        try {
          if (!report.usersFound.includes(username)) {
            report.usersFound.push(username)
          }
          let count = 0

          for (const [questionId, data] of Object.entries(incorrectData as Record<string, any>)) {
            const newIncorrectRef = ref(db, `users/${username}/incorrectQuestions/${questionId}`)
            await set(newIncorrectRef, data)
            console.log(`[v0] Migrated incorrect question for ${username}/${questionId}`)
            count++
          }

          report.incorrectQuestionsMigrated[username] = count
        } catch (error) {
          report.errors.push(`Error migrating incorrect questions for ${username}: ${error}`)
        }
      }
    }

    console.log("[v0] Migration completed:", report)
    return report
  } catch (error) {
    console.error("[v0] Error during migration:", error)
    report.errors.push(`Fatal error: ${error}`)
    return report
  }
}
