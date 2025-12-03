import { db } from "./firebase-config"
import { ref, push, set, get, query, orderByChild, equalTo, child, remove } from "firebase/database"

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
      incorrectQuestions: {},
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
    const quizResultsRef = ref(db, "quizResults")
    const newResultRef = push(quizResultsRef)

    await set(newResultRef, {
      ...result,
      timestamp: Date.now(),
    })

    console.log("[v0] Quiz result saved with ID:", newResultRef.key)
    return newResultRef.key
  } catch (error) {
    console.error("[v0] Error saving quiz result:", error)
    throw error
  }
}

export async function getUserStats(username: string): Promise<UserStats> {
  try {
    const quizResultsRef = ref(db, "quizResults")
    const userQuery = query(quizResultsRef, orderByChild("username"), equalTo(username))

    const snapshot = await get(userQuery)

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
    const quizResultsRef = ref(db, "quizResults")
    const setQuery = query(quizResultsRef, orderByChild("username"), equalTo(username))

    const snapshot = await get(setQuery)

    if (!snapshot.exists()) {
      return []
    }

    const results: QuizResult[] = []
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val()
      if (data.setId === setId) {
        results.push(data as QuizResult)
      }
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
    const quizResultsRef = ref(db, "quizResults")
    const userQuery = query(quizResultsRef, orderByChild("username"), equalTo(username))

    const snapshot = await get(userQuery)

    const deletePromises: Promise<void>[] = []

    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const resultRef = ref(db, `quizResults/${childSnapshot.key}`)
        deletePromises.push(remove(resultRef))
      })
    }

    const progressRef = ref(db, `quizProgress/${username}`)
    deletePromises.push(remove(progressRef))

    const userRef = ref(db, `users/${username}/incorrectQuestions`)
    deletePromises.push(remove(userRef))

    await Promise.all(deletePromises)
    console.log("[v0] User stats and progress reset for:", username)
  } catch (error) {
    console.error("[v0] Error resetting user stats:", error)
    throw error
  }
}

export async function getSeriesAttempts(username: string): Promise<Record<string, number>> {
  try {
    const quizResultsRef = ref(db, "quizResults")
    const userQuery = query(quizResultsRef, orderByChild("username"), equalTo(username))

    const snapshot = await get(userQuery)

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
    const progressRef = ref(db, `quizProgress/${progress.username}/${progress.setId}`)
    const cleanedProgress = {
      ...progress,
      answers: progress.answers.map((answer) => (answer === null || answer === undefined ? "" : answer)),
      timestamp: Date.now(),
    }
    await set(progressRef, cleanedProgress)
    console.log("[v0] Quiz progress saved")
  } catch (error) {
    console.error("[v0] Error saving quiz progress:", error)
    throw error
  }
}

export async function getQuizProgress(username: string, setId: string): Promise<QuizProgress | null> {
  try {
    const progressRef = ref(db, `quizProgress/${username}/${setId}`)
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
    const progressRef = ref(db, `quizProgress/${username}`)
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
    const progressRef = ref(db, `quizProgress/${username}/${setId}`)
    await remove(progressRef)
    console.log("[v0] Quiz progress cleared")
  } catch (error) {
    console.error("[v0] Error clearing quiz progress:", error)
    throw error
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
    throw error
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
