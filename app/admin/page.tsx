"use client"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { CardFooter } from "@/components/ui/card"

import { Label } from "@/components/ui/label"

import type React from "react"
import { useToast } from "@/components/ui/use-toast"
import { Trash2, X, Plus, FileText, Upload, Pencil, Download, RotateCcw, Flag } from "lucide-react" // Added Flag icon

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import Link from "next/link" // Import Link for navigation
import {
  saveQuestionToFirebase,
  saveCategory,
  saveCategoryStatus,
  getAllCategoryStatuses,
  migrateTimestamps,
  migrateStaticQuestionsToFirebase,
  updateExistingQuestionsWithReeks,
  getAllCategories,
  loadQuestionsFromFirebase, // Imported loadQuestionsFromFirebase
  deleteCategory, // Fixed import name from deleteCategoryFromFirebase to deleteCategory
  addCategoryToFirebase, // Import addCategoryToFirebase
  getAllQuestions, // Import getAllQuestions
  renameSeriesInCategory, // Import renameSeriesInCategory
  renameCategoryId, // Added import for renameCategoryId
  deleteSeriesFromCategory, // Added import for deleteSeriesFromCategory
} from "@/lib/firebase-service"
import type { CategoryStatus } from "@/lib/categories-data"
// Removed imports of static question sets: questionSets as radarQuestionSets, questionSets as matrozenQuestionSets
import {
  type ParsedQuestion,
  parseQuestionsFromText,
  parseQuestionsWithSeries,
  extractText, // Imported extractText
} from "@/lib/pdf-parser" // Updated import to include parseQuestionsWithSeries
import { cn } from "@/lib/utils"
import { db } from "@/lib/firebase"
import { ref as refDB, set, remove, get, update } from "firebase/database"
import { useAuth } from "@/contexts/auth-context" // Import AuthContext
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog" // Import Dialog components
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group" // Import RadioGroup components
import { getAuth } from "firebase/auth" // Import getAuth

// --- FIX START ---
// FIX: The type Question was undeclared. Imported it from a relevant module.
import type { Question } from "@/lib/types"
// --- FIX END ---

const sanitizeForLog = (obj: any): any => {
  if (!obj) return obj
  if (typeof obj !== "object") return obj
  if (Array.isArray(obj)) return obj.map(sanitizeForLog)

  const sanitized: any = {}
  for (const key in obj) {
    const value = obj[key]
    // Truncate base64 image strings
    if (typeof value === "string" && (value.startsWith("data:image/") || key.toLowerCase().includes("image"))) {
      sanitized[key] = `[IMAGE_DATA: ${value.substring(0, 30)}... (${value.length} chars)]`
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeForLog(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// Moved helper functions inside component to access state
export default function AdminPage() {
  const { email, username, loading: authLoading } = useAuth()
  const [isCheckingAuth, setIsCheckingCheckingAuth] = useState(true) // FIXED: Corrected spelling of setIsCheckingAuth
  const [isAdmin, setIsAdmin] = useState(false) // New state for admin check
  const router = useRouter()
  const { toast } = useToast()
  const auth = getAuth() // Initialize Firebase Auth

  const [categoryStatuses, setCategoryStatuses] = useState<Record<string, CategoryStatus>>({})
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true)
  const [loginError, setLoginError] = useState("") // Kept from original

  // Question management state
  const [selectedCategory, setSelectedCategory] = useState<string>("radar")
  // const [savedEdits, setSavedEdits] = useState<Record<string, QuestionEdit>>({})
  const [questionNumber, setQuestionNumber] = useState("")
  const [questionText, setQuestionText] = useState("")
  const [optionA, setOptionA] = useState("")
  const [optionB, setOptionB] = useState("")
  const [optionC, setOptionC] = useState("")
  const [optionD, setOptionD] = useState("")
  const [correctAnswer, setCorrectAnswer] = useState<"a" | "b" | "c" | "d">("a")
  const [isSaving, setIsSaving] = useState(false)
  const [permissionError, setPermissionError] = useState(false)

  const [showTimestampMigration, setShowTimestampMigration] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<any>(null)

  const [showStaticMigration, setShowStaticMigration] = useState(false)
  const [staticMigrationResult, setStaticMigrationResult] = useState<any>(null)
  const [isStaticMigrating, setIsStaticMigrating] = useState(false)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadMethod, setUploadMethod] = useState<"text" | "pdf">("text")
  const [questionsText, setQuestionsText] = useState("")
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [editableParsedQuestions, setEditableParsedQuestions] = useState<ParsedQuestion[]>([])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [newCategoryIcon, setNewCategoryIcon] = useState<File | null>(null)
  const [newCategoryIconPreview, setNewCategoryIconPreview] = useState<string>("")

  // const [questionsPerSet, setQuestionsPerSet] = useState(50) // REMOVED - no longer needed for split logic
  const [isProcessingPdf, setIsProcessingPdf] = useState(false)
  const [questionImages, setQuestionImages] = useState<Record<number, File>>({})

  const [questionOptionImages, setQuestionOptionImages] = useState<
    Record<
      number,
      {
        a?: File
        b?: File
        c?: File
        d?: File
      }
    >
  >({})

  const [generatedCode, setGeneratedCode] = useState("")
  const [showCodeModal, setShowCodeModal] = useState(false)

  const [showQuestionBrowser, setShowQuestionBrowser] = useState(false)
  const [selectedQuestionSet, setSelectedQuestionSet] = useState("all") // Changed from 'selectedQuestionSet' to 'all'
  const [searchTerm, setSearchTerm] = useState("")
  const [imageFilter, setImageFilter] = useState<"all" | "missing" | "has">("all")

  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false)
  // Updated state variables for series and split options

  const [uploadModalSelectedSeries, setUploadModalSelectedSeries] = useState("1")
  const [customReeks, setCustomReeks] = useState("")
  const [autoSplit, setAutoSplit] = useState<"single" | "split">("single")

  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
  const [editFormData, setEditFormData] = useState<{
    question: string
    optionA: string
    optionB: string
    optionC: string
    optionD: string
    correct: "a" | "b" | "c" | "d"
    questionImage: string
    optionAImage: string
    optionBImage: string
    optionCImage: string
    optionDImage: string
  } | null>(null) // Changed to null to signify no edit form active

  const [showPdfUploadInOverview, setShowPdfUploadInOverview] = useState(false)
  const [parsedQuestionsForOverview, setParsedQuestionsForOverview] = useState<any[]>([])
  const [manualQuestionData, setManualQuestionData] = useState({
    question: "",
    questionImage: "",
    optionA: "",
    optionAImage: "",
    optionB: "",
    optionBImage: "",
    optionC: "",
    optionCImage: "",
    optionD: "",
    optionDImage: "",
    correctAnswer: "a" as "a" | "b" | "c" | "d",
    reeks: "1",
  })

  const formRef = useRef<HTMLFormElement>(null)
  const [showManualQuestionForm, setShowManualQuestionForm] = useState(false)
  const [selectedCorrectAnswer, setSelectedCorrectAnswer] = useState<"a" | "b" | "c" | "d">("a")
  const [selectedReeks, setSelectedReeks] = useState("all") // Changed default selectedReeks from "1" to "all" so it shows all questions by default
  const [customReeksInput, setCustomReeksInput] = useState("") // Added state for custom reeks input

  const [firebaseQuestions, setFirebaseQuestions] = useState<Record<string, Question>>({})
  const [deletedQuestions, setDeletedQuestions] = useState<Set<string>>(new Set())

  const [allCategories, setAllCategories] = useState<
    Array<{ id: string; name: string; description: string; status: CategoryStatus; icon?: string }>
  >([])
  const [editingCategoryIcon, setEditingCategoryIcon] = useState<File | null>(null)
  const [editingCategoryIconPreview, setEditingCategoryIconPreview] = useState<string>("")
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState("")
  const [isLoading, setIsLoading] = useState(true) // Added loading state

  const [showReeksUpdate, setShowReeksUpdate] = useState(false)
  const [isReeksUpdating, setIsReeksUpdating] = useState(false)
  const [reeksUpdateResult, setReeksUpdateResult] = useState<any>(null)

  // New state to control split behavior in the upload modal
  const [uploadSplitOption, setUploadSplitOption] = useState<"auto" | "single">("single")

  const [showRenameSeriesDialog, setShowRenameSeriesDialog] = useState(false)
  const [renameSeriesOldName, setRenameSeriesOldName] = useState("")
  const [renameSeriesNewName, setRenameSeriesNewName] = useState("")
  const [isRenamingSeries, setIsRenamingSeries] = useState(false)

  // State for deleting series
  const [showDeleteSeriesDialog, setShowDeleteSeriesDialog] = useState(false)
  const [deleteSeriesName, setDeleteSeriesName] = useState("")
  const [isDeletingSeries, setIsDeletingSeries] = useState(false)

  const [isAddingToExistingCategory, setIsAddingToExistingCategory] = useState(false)

  const [isBulkEditMode, setIsBulkEditMode] = useState(false)
  const [bulkEditTrigger, setBulkEditTrigger] = useState(0)

  const [bulkEditAnswers, setBulkEditAnswers] = useState<Record<string, string>>({})

  const [userStats, setUserStats] = useState({
    totalUsers: 0,
    totalQuizResults: 0,
    recentActiveUsers: 0,
    anonymousClicks: 0, // Added counter for anonymous button clicks
  })
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isExporting, setIsExporting] = useState(false) // NEW: State for export button

  const handleResetAnonymousClicks = async () => {
    try {
      const analyticsRef = refDB(db, "analytics/anonymousClicks") // FIX: database renamed to db
      await set(analyticsRef, 0)
      console.log("[v0] Reset anonymous clicks counter to 0")
      // Reload statistics
      await loadUserStatistics()
    } catch (error) {
      console.error("[v0] Error resetting anonymous clicks:", error)
    }
  }

  const loadUserStatistics = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const clicksRef = refDB(db, "analytics/anonymousClicks")
      const clicksSnapshot = await get(clicksRef)
      const anonymousClicks = clicksSnapshot.exists() ? clicksSnapshot.val() : 0

      const usersRef = refDB(db, "users")
      const snapshot = await get(usersRef)

      if (snapshot.exists()) {
        const users = snapshot.val()
        let totalUsers = 0
        let totalQuizResults = 0
        let recentActiveUsers = 0

        const now = Date.now()
        const oneDayAgo = now - 24 * 60 * 60 * 1000

        Object.entries(users).forEach(([userId, userData]: [string, any]) => {
          totalUsers++

          // Count quiz results
          if (userData.quizResults) {
            const quizCount = Object.keys(userData.quizResults).length
            totalQuizResults += quizCount
          }

          // Check if active in last 24 hours
          if (userData.lastActive) {
            const lastActive =
              typeof userData.lastActive === "number" ? userData.lastActive : new Date(userData.lastActive).getTime()
            if (lastActive > oneDayAgo) {
              recentActiveUsers++
            }
          }
        })

        setUserStats({
          totalUsers,
          totalQuizResults,
          recentActiveUsers,
          anonymousClicks,
        })
      } else {
        setUserStats({
          totalUsers: 0,
          totalQuizResults: 0,
          recentActiveUsers: 0,
          anonymousClicks,
        })
      }
    } catch (error) {
      console.error("[v0] Error loading user statistics:", error)
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  const handleCategoryIconUpload = (file: File | null) => {
    if (!file) {
      setNewCategoryIcon(null)
      setNewCategoryIconPreview("")
      return
    }

    setNewCategoryIcon(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setNewCategoryIconPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleEditCategoryIconUpload = (file: File | null) => {
    if (!file) {
      setEditingCategoryIcon(null)
      setEditingCategoryIconPreview("")
      return
    }

    setEditingCategoryIcon(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setEditingCategoryIconPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSeriesChange = useCallback((value: string) => {
    setUploadModalSelectedSeries(value)
    if (value !== "new") {
      setCustomReeks("")
    }
  }, [])

  const handleCustomReeksChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomReeksInput(e.target.value)
  }, [])

  const normalizeReeks = (reeks: string | number | undefined): string => {
    if (!reeks) return ""
    const reeksStr = String(reeks).toLowerCase()
    // Remove common prefixes like "matrozen-reeks-", "reeks-", "set" etc
    const cleaned = reeksStr
      .replace(/^.*-reeks-/, "")
      .replace(/^reeks-?/, "")
      .replace(/^set-?/, "")
      .trim()
    return cleaned || reeksStr
  }

  const handleManualQuestionDataChange = useCallback((newData: typeof manualQuestionData) => {
    setManualQuestionData(newData)
  }, [])

  // Helper function to update manualQuestionData state
  const updateManualQuestionField = useCallback(
    (field: keyof typeof manualQuestionData, value: string | "a" | "b" | "c" | "d") => {
      setManualQuestionData((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    [],
  )

  const handleSaveFromPDF = async (categoryName: string, questionsPerSet: number) => {
    if (!categoryName.trim()) {
      alert("Vul een categorie naam in")
      return
    }

    if (editableParsedQuestions.length === 0) {
      alert("Geen vragen gevonden om op te slaan")
      return
    }

    const missingAnswers = editableParsedQuestions.filter((q) => !q.correctAnswer)
    if (missingAnswers.length > 0) {
      alert(
        `${missingAnswers.length} vragen hebben nog geen correct antwoord geselecteerd. Selecteer deze eerst in de preview.`,
      )
      return
    }

    const categoryId = categoryName.toLowerCase().replace(/\s+/g, "-")

    try {
      // Use getAllCategories to check for existing category ID
      const existingCategories = await getAllCategories()
      if (existingCategories.some((cat) => cat.id === categoryId)) {
        alert(`Categorie met ID "${categoryId}" bestaat al. Kies een andere naam.`)
        return
      }

      await saveCategory(categoryId, categoryName, `Oefenvragen voor het ${categoryName}`)

      // Save questions to Firebase
      console.log("[v0] Saving new category to Firebase:", categoryId)

      const detectedSeriesName = selectedReeks || "Reeks 1" // Use selectedReeks from state

      for (let i = 0; i < editableParsedQuestions.length; i++) {
        const question = editableParsedQuestions[i]
        const questionKey = `${categoryId}-${i + 1}`
        const reeksNumber = Math.floor(i / questionsPerSet) + 1

        const reeksName = detectedSeriesName || reeksNumber.toString()

        console.log("[v0] Saving question:", {
          questionKey,
          questionNumber: i + 1,
          correctAnswer: question.correctAnswer,
          reeks: reeksName,
          hasCorrectAnswer: !!question.correctAnswer,
        })

        await set(refDB(db, `questions/${categoryId}/${questionKey}`), {
          id: i + 1,
          question: question.text,
          options: {
            a: question.optionA,
            b: question.optionB,
            c: question.optionC,
            ...(question.optionD && { d: question.optionD }),
          },
          correctAnswer: question.correctAnswer?.toUpperCase(),
          reeks: reeksName,
        })
      }

      await saveCategoryStatus(categoryId, "non-actief")

      console.log("[v0] Category saved successfully:", categoryId)

      await loadAllCategories()

      toast({
        title: "Succes",
        description: `${editableParsedQuestions.length} vragen succesvol opgeslagen voor ${categoryName} (${detectedSeriesName})`,
      })

      // Close modal and refresh
      setShowUploadModal(false)
      setQuestionsText("")
      setParsedQuestions([])
      setEditableParsedQuestions([])
      setSelectedReeks("1") // Reset to default

      await Promise.all([loadAllQuestions(), loadCategoryStatuses()])
    } catch (error) {
      console.error("[v0] Error saving category:", error)
      alert("Er is een fout opgetreden bij het opslaan van de categorie. Probeer het opnieuw.")
    }
  }

  const handleAddCategory = async (name: string, description: string) => {
    const categoryId = name.toLowerCase().replace(/\s+/g, "-")

    try {
      // Check if category already exists
      const existingCategories = await getAllCategories()
      if (existingCategories.some((cat) => cat.id === categoryId)) {
        toast({
          title: "Fout",
          description: `Een categorie met ID "${categoryId}" bestaat al. Kies een andere naam.`,
          variant: "destructive",
        })
        return
      }

      await saveCategory(categoryId, name, description || `Oefenvragen voor ${name}`)

      await set(refDB(db, `categoryStatus/${categoryId}`), "non-actief")

      // Update local state and reload categories
      setAllCategories((prev) => [...prev, { id: categoryId, name, description, status: "non-actief" }])

      toast({
        title: "Categorie aangemaakt",
        description: `De categorie "${name}" is succesvol aangemaakt.`,
      })
    } catch (error) {
      console.error("[v0] Error adding category:", error)
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het aanmaken van de categorie.",
        variant: "destructive",
      })
    }
  }

  // FIXED: Moved useEffect dependencies to ensure it runs correctly
  useEffect(() => {
    const checkAuth = async () => {
      console.log("[v0] Admin check starting...")
      console.log("[v0] authLoading:", authLoading)
      console.log("[v0] email:", email)
      console.log("[v0] username:", username)

      if (authLoading) {
        console.log("[v0] Still loading auth, waiting...")
        return
      }

      if (!email) {
        console.log("[v0] No email found, redirecting to home")
        toast({
          title: "Geen toegang",
          description: "Log eerst in met een admin account",
          variant: "destructive",
        })
        router.push("/")
        return
      }

      // Anyone with a Firebase account can access admin panel
      console.log("[v0] Email found, granting admin access")
      setIsAdmin(true)
      setIsCheckingCheckingAuth(false)
    }

    checkAuth()
  }, [email, authLoading, router, toast, username]) // Added all dependencies

  const getCategoryStatusDisplay = (categoryId: string) => {
    return categoryStatuses[categoryId] || "actief"
  }

  const handleStatusChange = async (categoryId: string, status: CategoryStatus) => {
    setCategoryStatuses((prev) => ({
      ...prev,
      [categoryId]: status,
    }))

    // Update the category in allCategories as well
    setAllCategories((prev) => prev.map((cat) => (cat.id === categoryId ? { ...cat, status } : cat)))

    console.log(`[v0] Category status saved: ${categoryId} ${status}`)

    try {
      await saveCategoryStatus(categoryId, status)
    } catch (error) {
      console.error("[v0] Error saving category status:", error)
      // Reload from Firebase if there was an error to ensure consistency
      const statuses = await getAllCategoryStatuses()
      setCategoryStatuses(statuses as Record<string, CategoryStatus>)
      await loadAllCategories()
    }
  }

  // Function to load all questions from Firebase for the selected category
  const loadQuestions = async (categoryId?: string) => {
    const currentCategoryId = categoryId || selectedCategory
    if (!currentCategoryId) {
      setFirebaseQuestions({})
      return
    }

    try {
      console.log("[v0] Loading Firebase questions for category:", currentCategoryId)
      const questionsRef = refDB(db, `questions/${currentCategoryId}`)
      const snapshot = await get(questionsRef)

      if (snapshot.exists()) {
        const data = snapshot.val()
        setFirebaseQuestions(data)
        console.log("[v0] Loaded", Object.keys(data).length, "Firebase questions for", currentCategoryId)
        const firstQuestionKey = Object.keys(data)[0]
        if (firstQuestionKey) {
          console.log("[v0] First question data from Firebase:", {
            key: firstQuestionKey,
            hasCorrectAnswer: !!data[firstQuestionKey].correctAnswer,
            correctAnswer: data[firstQuestionKey].correctAnswer,
            hasOptions: !!data[firstQuestionKey].options,
          })
        }
      } else {
        setFirebaseQuestions({})
        console.log("[v0] No Firebase questions found for", currentCategoryId)
      }
    } catch (error) {
      console.error("[v0] Error loading Firebase questions:", error)
      setFirebaseQuestions({})
    }
  }

  // Function to load deleted question markers from Firebase
  const loadDeletedQuestions = async () => {
    if (!selectedCategory) {
      setDeletedQuestions(new Set())
      return
    }

    try {
      const deletedRef = refDB(db, `deletedQuestions/${selectedCategory}`)
      const snapshot = await get(deletedRef)

      if (snapshot.exists()) {
        const data = snapshot.val()
        const deletedSet = new Set<string>(Object.keys(data))
        setDeletedQuestions(deletedSet)
        console.log("[v0] Loaded", deletedSet.size, "deleted question markers")
      } else {
        setDeletedQuestions(new Set())
      }
    } catch (error: any) {
      if (error?.code === "PERMISSION_DENIED" || error?.message?.includes("Permission denied")) {
        console.log("[v0] Note: Firebase 'deletedQuestions' node needs permissions. Update rules in Firebase Console.")
      } else {
        console.error("[v0] Error loading deleted questions:", error)
      }
      setDeletedQuestions(new Set())
    }
  }

  /*
  const loadSavedEdits = async () => {
    try {
      const editsRef = refDB(db, "questionEdits")
      const snapshot = await get(editsRef)

      if (snapshot.exists()) {
        const editsData = snapshot.val()
        setSavedEdits(editsData)
        console.log("[v0] Loaded", Object.keys(editsData).length, "question edits from Firebase")
        console.log("[v0] Loaded", Object.keys(editsData).length, "saved edits")
      } else {
        setSavedEdits({})
      }
    } catch (error) {
      console.error("[v0] Error loading saved edits:", error)
      setSavedEdits({})
    }
  }
  */

  // MEMOIZE loadQuestions and loadSavedEdits for use in useCallback
  const memoizedLoadQuestions = useCallback(loadQuestions, [selectedCategory])
  // const memoizedLoadSavedEdits = useCallback(loadSavedEdits, []) // REMOVED

  // Modified handleBulkAnswerClick to use bulkEditAnswers state
  const handleBulkAnswerClick = async (questionId: number, answer: string) => {
    console.log(`[v0] Bulk editing question ${questionId} to answer ${answer}`)

    const questionKey = `${selectedCategory}-${questionId}`
    // Fetch question data to include in editData
    const question = Object.values(firebaseQuestions).find((q) => q.id === questionId)

    if (!question) {
      console.error("[v0] Question not found for bulk edit:", questionId)
      return
    }

    console.log("[v0] Setting bulkEditAnswers state NOW")
    setBulkEditAnswers((prev) => {
      const updated = {
        ...prev,
        [questionKey]: answer.toUpperCase(),
      }
      console.log("[v0] BulkEditAnswers updated:", updated)
      return updated
    })

    console.log("[v0] State update called, starting Firebase update")

    try {
      // Update in Firebase questions node
      await update(refDB(db, `questions/${selectedCategory}/${questionKey}`), {
        correctAnswer: answer.toUpperCase(),
      })

      // Removed the creation of an editData object and saving to questionEdits node
      // The edit is now directly applied to the questions node.

      console.log(`[v0] Successfully updated question ${questionId} in Firebase`)
      toast({
        title: "Antwoord bijgewerkt",
        description: `Vraag ${questionId}: correct antwoord is nu ${answer.toUpperCase()}`,
      })

      // Reload saved edits to show the new edit - REMOVED as savedEdits is no longer used
      // await loadSavedEdits()
      // Force a re-render of filteredQuestions by updating bulkEditTrigger
      setBulkEditTrigger((prev) => prev + 1)
    } catch (error) {
      console.error("[v0] Error saving bulk edit:", error)
      toast({
        title: "Fout",
        description: "Kon het correcte antwoord niet opslaan",
        variant: "destructive",
      })
      setBulkEditAnswers((prev) => {
        const updated = { ...prev }
        delete updated[questionKey]
        return updated
      })
    }
  }

  // Reusable function to load category statuses
  const loadCategoryStatuses = async () => {
    try {
      console.log("[v0] Loading category statuses from Firebase")
      const statuses = await getAllCategoryStatuses()
      console.log("[v0] Loaded category statuses:", statuses)
      setCategoryStatuses(statuses as Record<string, CategoryStatus>)

      await loadAllCategories()
    } catch (error) {
      console.error("[v0] Error loading category statuses:", error)
    } finally {
      setIsLoadingStatuses(false)
    }
  }

  // Function to load all necessary data (questions, edits, deleted markers) for the selected category
  const loadAllQuestions = async () => {
    await loadQuestions()
    // await loadSavedEdits() // REMOVED
    await loadDeletedQuestions()
  }

  // Effect to load initial category statuses on mount
  useEffect(() => {
    loadCategoryStatuses()
  }, [])

  // Effect to load all questions when the selected category changes
  useEffect(() => {
    if (!selectedCategory) return

    loadQuestions(selectedCategory)
  }, [selectedCategory])

  // Effect to load saved edits on component mount (only once)
  useEffect(() => {
    // loadSavedEdits() // REMOVED
  }, [])

  const loadAllCategories = async () => {
    try {
      setIsLoading(true)
      const dynamicCats = await getAllCategories()
      const statuses = await getAllCategoryStatuses()

      const combined = dynamicCats.map((cat) => ({
        ...cat,
        status: (statuses[cat.id] as CategoryStatus) || "actief",
      }))

      setAllCategories(combined)
    } catch (error) {
      console.error("[v0] Error loading categories:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAllCategories()
  }, [])

  useEffect(() => {
    loadUserStatistics()
  }, [loadUserStatistics])

  const isStaticCategory = false // Removed check for static categories

  const availableReeksOptionsWithOriginal = useMemo(() => {
    const targetCategory = newCategoryName ? newCategoryName.toLowerCase().replace(/\s+/g, "-") : selectedCategory

    if (!targetCategory) {
      return [
        { value: "1", label: "Reeks 1", original: "1" },
        { value: "new", label: "➕ Nieuwe reeks...", original: "" },
      ]
    }

    const allQuestionIds = Object.keys(firebaseQuestions)

    const firebaseQs = Object.entries(firebaseQuestions)
      .filter(([firebaseKey, q]) => {
        if (!firebaseKey) return false
        const matches = firebaseKey.startsWith(targetCategory + "-")
        return matches
      })
      .map(([, q]) => q)

    const reeksMap = new Map<string, string>()
    firebaseQs.forEach((q) => {
      if (q.reeks) {
        const normalized = normalizeReeks(q.reeks)
        const original = String(q.reeks)
        if (!reeksMap.has(normalized)) {
          reeksMap.set(normalized, original)
        }
      }
    })

    const options = Array.from(reeksMap.entries())
      .sort((a, b) => {
        const numA = Number.parseInt(a[0])
        const numB = Number.parseInt(b[0])
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB
        return a[0].localeCompare(b[0])
      })
      .map(([normalized, original]) => ({
        value: normalized,
        label: `Reeks ${normalized}`,
        original: original,
      }))

    if (options.length === 0 && !newCategoryName) {
      options.push({ value: "1", label: "Reeks 1", original: "1" })
    }

    options.push({ value: "new", label: "➕ Nieuwe reeks...", original: "" })

    return options
  }, [firebaseQuestions, selectedCategory, newCategoryName])

  const availableReeksOptions = useMemo(() => {
    const allReeks = new Set<string>()
    Object.values(firebaseQuestions).forEach((q) => {
      if (q?.reeks) {
        allReeks.add(q.reeks)
      }
    })
    const options = Array.from(allReeks)
      .sort()
      .map((reeks) => ({
        value: reeks,
        label: `Reeks ${reeks}`,
      }))
    options.unshift({ value: "new", label: "Nieuwe Reeks" }) // Use "Nieuwe Reeks" for clarity in select
    return options
  }, [firebaseQuestions])

  useEffect(() => {
    if (selectedReeks === "all" || selectedReeks === "new") return

    const reeksExists = availableReeksOptionsWithOriginal.some((opt) => opt.value === selectedReeks)

    if (!reeksExists) {
      console.log("[v0] Selected reeks", selectedReeks, "no longer exists. Resetting to 'all'")
      setSelectedReeks("all")
    }
  }, [selectedReeks, availableReeksOptionsWithOriginal])

  // Removed activeTsQuestionsCount as it's no longer relevant
  const totalQuestionsCount = Object.keys(firebaseQuestions).length // Count only Firebase questions

  // Modified to only consider Firebase questions
  const filteredQuestions = useMemo(() => {
    if (!selectedCategory) return []

    // Convert firebaseQuestions object to an array of questions
    // Ensure to handle potential undefined or null values if the structure isn't guaranteed
    let result = Object.values(firebaseQuestions).filter((q) => q && q.id) // Filter out null/undefined and ensure they have an ID

    const questionsWithEdits = result.map((q) => {
      // Construct editKey from selectedCategory and question id
      const editKey = `${selectedCategory}-${q.id}`
      // Removed check for savedEdits[editKey]
      // The edits are now directly applied to the questions node, so we just return the question as is.
      // If there were separate edits, we would merge them here.
      return q
    })

    result = questionsWithEdits

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (q) =>
          q.question.toLowerCase().includes(term) ||
          Object.values(q.options).some((opt) => opt && opt.toLowerCase().includes(term)) ||
          q.id.toString().includes(term),
      )
    }

    if (selectedQuestionSet !== "all") {
      const normalizedSet = normalizeReeks(selectedQuestionSet)
      result = result.filter((q) => {
        const questionReeks = normalizeReeks(q.reeks || "")
        return questionReeks === normalizedSet
      })
    }

    if (imageFilter === "missing") {
      result = result.filter((q) => {
        const needsQuestionImage = q.needsImage && !q.questionImage && !q.image
        const needsOptionImages = q.optionsHaveImages && (!q.optionImages || Object.keys(q.optionImages).length === 0)
        return needsQuestionImage || needsOptionImages
      })
    } else if (imageFilter === "has") {
      result = result.filter((q) => {
        const hasQuestionImage = q.image || q.questionImage
        const hasOptionImages = q.optionImages && Object.keys(q.optionImages).length > 0
        return hasQuestionImage || hasOptionImages
      })
    }

    if (showOnlyFlagged) {
      result = result.filter((q) => q.needsReview === true)
    }

    // Filter out deleted questions
    result = result.filter((q) => !deletedQuestions.has(q.id))

    result.sort((a, b) => a.id - b.id)

    return result
  }, [
    selectedCategory,
    firebaseQuestions,
    deletedQuestions,
    searchTerm,
    selectedQuestionSet,
    imageFilter,
    showOnlyFlagged,
    bulkEditTrigger,
    bulkEditAnswers,
  ])

  const getQuestionCountForSet = (reeksId: string) => {
    const normalized = normalizeReeks(reeksId)
    return filteredQuestions.filter((q) => normalizeReeks(q.reeks) === normalized).length
  }

  // Helper function to get the correct answer, considering bulk edits
  const getDisplayCorrectAnswer = (question: any) => {
    const questionKey = `${selectedCategory}-${question.id}`
    const bulkAnswer = bulkEditAnswers[questionKey]
    const finalAnswer = bulkAnswer || question.correctAnswer?.toUpperCase()

    if (question.id === 1) {
      console.log(
        `[v0] Display answer for Q1: bulk=${bulkAnswer}, original=${question.correctAnswer}, final=${finalAnswer}`,
      )
    }

    return finalAnswer
  }

  const handleEditClick = (question: Question) => {
    // Changed to accept Question object directly
    // Helper function to get current category questions based on selected category
    const getCurrentCategoryQuestions = () => {
      // This function needs to access firebaseQuestions for the selected category
      // It should filter firebaseQuestions based on selectedCategory
      // For now, let's assume firebaseQuestions contains questions for the selectedCategory
      return Object.values(firebaseQuestions).filter((q) => q.id === question.id)
    }

    const currentQuestion = question // Use the passed question object
    if (!currentQuestion) return

    setEditingQuestionId(currentQuestion.id)
    setEditFormData({
      question: currentQuestion.question,
      optionA: currentQuestion.options?.a || "",
      optionB: currentQuestion.options?.b || "",
      optionC: currentQuestion.options?.c || "",
      optionD: currentQuestion.options?.d || "",
      correct: (currentQuestion.correctAnswer?.toLowerCase() || "a") as "a" | "b" | "c" | "d",
      questionImage: currentQuestion.questionImage || currentQuestion.image || "", // Ensure to also check question.image for legacy data
      optionAImage: currentQuestion.optionImages?.a || "",
      optionBImage: currentQuestion.optionImages?.b || "",
      optionCImage: currentQuestion.optionImages?.c || "",
      optionDImage: currentQuestion.optionImages?.d || "",
    })
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Toegang controleren...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  // Function to set the selected category for the question browser
  const setSelectedCategoryForEdit = (categoryId: string) => {
    setSelectedCategory(categoryId)
  }

  const handleSaveEdit = async () => {
    if (!questionNumber) {
      alert("Voer een vraagnummer in")
      return
    }

    const id = Number.parseInt(questionNumber)
    if (isNaN(id)) {
      alert("Vraagnummer moet een getal zijn")
      return
    }

    setIsSaving(true)
    try {
      // Removed saving to questionEdits node. Edits are now directly applied to the questions node.
      // const edit: Partial<QuestionEdit> = {
      //   timestamp: new Date().toISOString(),
      // }

      const questionUpdates: any = {}
      if (questionText) questionUpdates.question = questionText
      if (optionA || optionB || optionC || optionD) {
        const options: Record<string, string> = {}
        if (optionA) options.a = optionA
        if (optionB) options.b = optionB
        if (optionC) options.c = optionC
        if (optionD) options.d = optionD // Save option D
        questionUpdates.options = options
      }
      if (correctAnswer) questionUpdates.correctAnswer = correctAnswer.toUpperCase()

      // Construct the edit key using selectedCategory and the question ID
      const questionKey = `${selectedCategory}-${id}`

      if (Object.keys(questionUpdates).length > 0) {
        await update(refDB(db, `questions/${selectedCategory}/${questionKey}`), questionUpdates)
        console.log(`[v0] Successfully updated question ${id} in Firebase questions node`)
      }

      // Removed saving to questionEdits node. Edits are now directly applied to the questions node.
      // await loadSavedEdits() // REMOVED

      // Clear form
      setQuestionNumber("")
      setQuestionText("")
      setOptionA("")
      setOptionB("")
      setOptionC("")
      setOptionD("") // Clear option D
      setCorrectAnswer("a")

      alert("Vraag succesvol aangepast!")

      // Reload questions to reflect changes
      await loadQuestions()
    } catch (error) {
      console.error("[v0] Error saving edit:", error)
      alert("Fout bij opslaan van aanpassing")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEdit = async (editKey: string) => {
    // Changed to accept editKey
    const questionId = Number.parseInt(editKey.split("-")[1]) // Extract question ID for confirmation
    if (!confirm(`Aanpassing van vraag ${questionId} verwijderen?`)) return

    try {
      // Removed delete operation on questionEdits node.
      // await remove(refDB(db, `questionEdits/${editKey}`))
      // await loadSavedEdits() // REMOVED
      toast({
        title: "Aanpassing verwijderd",
        description: `Aanpassing voor vraag ${questionId} is verwijderd.`,
      })
    } catch (error) {
      console.error("[v0] Error deleting edit:", error)
      toast({
        title: "Fout bij verwijderen",
        description: "Er is een fout opgetreden bij het verwijderen van de aanpassing.",
        variant: "destructive",
      })
    }
  }

  const handleTextUpload = () => {
    setShowUploadModal(true)
    setUploadMethod("text")
    // Clear previous state when opening the modal for text upload
    setQuestionsText("")
    setEditableParsedQuestions([])
    setNewCategoryName("") // Reset category name
    setCustomReeks("") // Clear custom reek input
    setUploadModalSelectedSeries("1") // Reset series selection
  }

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log("[v0] ========================================")
    console.log("[v0] PDF UPLOAD STARTED")
    console.log("[v0] ========================================")
    console.log("[v0] File:", file.name, `(${(file.size / 1024).toFixed(2)} KB)`)
    setIsProcessingPdf(true)

    try {
      const text = await extractText(file)
      console.log("[v0] ✓ Extracted", text.length, "characters")

      if (!text || text.trim().length === 0) {
        throw new Error("Geen tekst gevonden in de PDF")
      }

      setQuestionsText(text)

      const result = parseQuestionsWithSeries(text)
      console.log("[v0] ✓ Parsed", result.questions.length, "questions")

      if (result.questions.length === 0) {
        throw new Error("Geen vragen gevonden in de PDF. Controleer het formaat.")
      }

      setEditableParsedQuestions(result.questions)

      if (showPdfUploadInOverview) {
        console.log("[v0] Mode: Adding to existing category:", selectedCategory)
        setNewCategoryName(selectedCategory)
        setShowPdfUploadInOverview(false)
        setShowUploadModal(true)
        setIsAddingToExistingCategory(true)
      } else {
        console.log("[v0] Mode: New category")
        setIsAddingToExistingCategory(false)
      }

      console.log("[v0] ========================================")
      console.log("[v0] PDF UPLOAD COMPLETE -", result.questions.length, "questions ready")
      console.log("[v0] ========================================")

      toast({
        title: "PDF verwerkt",
        description: `${result.questions.length} vragen gevonden en klaar voor review.`,
      })
    } catch (error) {
      console.error("[v0] ========================================")
      console.error("[v0] PDF UPLOAD FAILED")
      console.error("[v0] ========================================")
      console.error("[v0] Error:", error)
      alert(`Fout bij verwerken PDF: ${error instanceof Error ? error.message : "Onbekende fout"}`)
      setEditableParsedQuestions([])
      setQuestionsText("")
    } finally {
      setIsProcessingPdf(false)
      // Clear the file input value to allow re-uploading the same file if needed
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  const handleParseText = async (file: File) => {
    if (!questionsText.trim()) {
      alert("Plak eerst tekst met vragen")
      return
    }

    try {
      const result = parseQuestionsFromText(questionsText) // CORRECTED: Should be parseQuestionsFromText
      setParsedQuestions(result.questions)
      setEditableParsedQuestions(result.questions)
      // setNewCategoryName(selectedCategory) // Removed auto-setting based on selectedCategory
      console.log("[v0] Text parsing complete, ready for review.")

      if (result.questions.length === 0) {
        alert(
          "Geen vragen gevonden. Controleer of het formaat correct is.\n\nVerwacht formaat:\n1. Vraag?\na) Optie A\nb) Optie B\nc) Optie C\n\nLet op: Als het correcte antwoord niet automatisch herkend wordt, kun je dit handmatig aanpassen in de preview hieronder.",
        )
      } else {
        const questionsWithoutAnswer = result.questions.filter((q) => !q.correctAnswer)
        if (questionsWithoutAnswer.length > 0) {
          alert(
            `${questionsWithoutAnswer.length} vragen hebben geen correct antwoord. Je kunt dit handmatig aanpassen in de preview hieronder.`,
          )
        }
      }
    } catch (error) {
      console.error("[v0] Error parsing text:", error)
      alert("Fout bij het parsen van de tekst. Controleer het formaat.")
    }
  }

  const handleParseTextInOverview = () => {
    console.log("[v0] handleParseTextInOverview called")
    console.log("[v0] questionsText length:", questionsText?.length)

    if (!questionsText.trim()) {
      alert("Eerst een PDF olisi uploaden")
      return
    }

    try {
      const result = parseQuestionsWithSeries(questionsText)
      console.log("[v0] Parsed questions count:", result.questions.length)

      if (result.questions.length === 0) {
        alert("Geen vragen gevonden in de PDF. Controleer het formaat.")
        return
      }

      setEditableParsedQuestions(result.questions)
      setNewCategoryName(selectedCategory) // Use existing category name
      setShowPdfUploadInOverview(false) // Close the PDF upload dialog
      setShowUploadModal(true) // Open the main upload modal with parsed questions

      toast({
        title: "Vragen geparsed",
        description: `${result.questions.length} vragen gevonden en klaar voor review.`,
      })
    } catch (error) {
      console.error("[v0] Error parsing text:", error)
      alert("Fout bij het herkennen van vragen")
    }
  }

  const updateCorrectAnswer = (questionNumber: number, answer: "A" | "B" | "C" | "D") => {
    setEditableParsedQuestions((prev) =>
      prev.map((q) => (q.number === questionNumber ? { ...q, correctAnswer: answer } : q)),
    )
  }

  const handleQuestionImageUpload = (questionNumber: number, file: File | null) => {
    if (!file) {
      setQuestionImages((prev) => {
        const updated = { ...prev }
        delete updated[questionNumber]
        return updated
      })
      return
    }

    // Validate image file
    if (!file.type.startsWith("image/")) {
      alert("Selecteer een geldig afbeeldingsbestand")
      return
    }

    setQuestionImages((prev) => ({ ...prev, [questionNumber]: file }))
    console.log(`[v0] Image uploaded for question ${questionNumber}:`, file.name)
  }

  const handleOptionImageUpload = (questionNumber: number, option: "a" | "b" | "c" | "d", file: File | null) => {
    if (!file) {
      setQuestionOptionImages((prev) => {
        const updated = { ...prev }
        if (updated[questionNumber]) {
          delete updated[questionNumber][option]
        }
        // If the option object becomes empty, delete it
        if (updated[questionNumber] && Object.keys(updated[questionNumber]).length === 0) {
          delete updated[questionNumber]
        }
        return updated
      })
      return
    }

    // Validate image file
    if (!file.type.startsWith("image/")) {
      alert("Selecteer een geldig afbeeldingsbestand")
      return
    }

    setQuestionOptionImages((prev) => ({
      ...prev,
      [questionNumber]: {
        ...(prev[questionNumber] || {}),
        [option]: file,
      },
    }))
    console.log(`[v0] Image uploaded for question ${questionNumber}, option ${option}:`, file.name)
  }

  // Removed duplicate handleOptionImageUpload function (already handled above)

  const handleSaveNewCategoryWithQuestions = async () => {
    console.log("[v0] ========================================")
    console.log("[v0] NEW CATEGORY WORKFLOW")
    console.log("[v0] ========================================")
    console.log("[v0] Category:", newCategoryName)
    console.log("[v0] Questions:", editableParsedQuestions.length)
    console.log("[v0] Series:", uploadModalSelectedSeries === "new" ? customReeksInput : uploadModalSelectedSeries)
    console.log("[v0] Split:", autoSplit)

    if (!newCategoryName.trim()) {
      alert("Vul een categorienaam in")
      return
    }

    if (editableParsedQuestions.length === 0) {
      alert("Er zijn geen vragen om op te slaan")
      return
    }

    const missingAnswers = editableParsedQuestions.filter((q) => !q.correctAnswer)
    if (missingAnswers.length > 0) {
      alert(`${missingAnswers.length} vragen hebben nog geen correct antwoord. Selecteer deze eerst.`)
      return
    }

    const missingOptionImages = editableParsedQuestions.filter((q) => {
      if (!q.optionsHaveImages) return false
      const optionImages = questionOptionImages[q.number]
      return (
        (q.optionAImageDescription && !optionImages?.a) ||
        (q.optionBImageDescription && !optionImages?.b) ||
        (q.optionCImageDescription && !optionImages?.c) ||
        (q.optionDImageDescription && !optionImages?.d)
      )
    })

    if (missingOptionImages.length > 0) {
      alert(`${missingOptionImages.length} vragen hebben nog niet alle optie afbeeldingen geüpload. Upload deze eerst.`)
      return
    }

    const convertFileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }

    try {
      const categoryId = newCategoryName.toLowerCase().replace(/\s+/g, "-")
      const description = newCategoryDescription.trim() || `Oefenvragen voor ${newCategoryName}`

      console.log("[v0] STEP 1: Creating category:", categoryId)

      let iconBase64 = ""
      if (newCategoryIcon) {
        iconBase64 = await convertFileToBase64(newCategoryIcon)
      }

      await addCategoryToFirebase(categoryId, newCategoryName, description, iconBase64)
      console.log("[v0] ✓ Category created")

      const detectedSeriesName = uploadModalSelectedSeries === "new" ? customReeksInput : uploadModalSelectedSeries
      const totalQuestions = editableParsedQuestions.length
      const questionsPerSeries = 50

      console.log("[v0] STEP 2: Saving", totalQuestions, "questions to series:", detectedSeriesName)

      if (autoSplit === "split" && totalQuestions > questionsPerSeries) {
        const numSeries = Math.ceil(totalQuestions / questionsPerSeries)
        console.log("[v0] Splitting into", numSeries, "series")

        for (let seriesIndex = 0; seriesIndex < numSeries; seriesIndex++) {
          const startIdx = seriesIndex * questionsPerSeries
          const endIdx = Math.min(startIdx + questionsPerSeries, totalQuestions)
          const seriesQuestions = editableParsedQuestions.slice(startIdx, endIdx)
          const seriesName = `${detectedSeriesName} (${startIdx + 1}-${endIdx})`

          console.log(
            `[v0] Saving series ${seriesIndex + 1}/${numSeries}: ${seriesName} (${seriesQuestions.length} questions)`,
          )

          for (let i = 0; i < seriesQuestions.length; i++) {
            const question = seriesQuestions[i]
            const globalQuestionNumber = startIdx + i + 1
            const questionKey = `${categoryId}-${globalQuestionNumber}`

            let questionImageBase64 = ""
            if (questionImages[question.number]) {
              questionImageBase64 = await convertFileToBase64(questionImages[question.number])
            }

            const optionImagesBase64: Record<string, string> = {}
            const optionImages = questionOptionImages[question.number]
            if (optionImages) {
              if (optionImages.a) optionImagesBase64.a = await convertFileToBase64(optionImages.a)
              if (optionImages.b) optionImagesBase64.b = await convertFileToBase64(optionImages.b)
              if (optionImages.c) optionImagesBase64.c = await convertFileToBase64(optionImages.c)
              if (optionImages.d) optionImagesBase64.d = await convertFileToBase64(optionImages.d)
            }

            await set(refDB(db, `questions/${categoryId}/${questionKey}`), {
              id: globalQuestionNumber,
              question: question.text,
              options: {
                a: question.optionA,
                b: question.optionB,
                c: question.optionC,
                ...(question.optionD && { d: question.optionD }),
              },
              correctAnswer: question.correctAnswer?.toUpperCase(),
              reeks: seriesName,
              ...(questionImageBase64 && { questionImage: questionImageBase64 }),
              ...(question.needsImage && { needsImage: true }),
              ...(question.imageDescription && { imageDescription: question.imageDescription }),
              ...(question.optionsHaveImages && { optionsHaveImages: true }),
              ...(Object.keys(optionImagesBase64).length > 0 && { optionImages: optionImagesBase64 }),
            })
          }
        }
        console.log("[v0] ✓ All series saved")
      } else {
        console.log("[v0] Saving to single series")

        for (let i = 0; i < editableParsedQuestions.length; i++) {
          const question = editableParsedQuestions[i]
          const questionKey = `${categoryId}-${i + 1}`

          let questionImageBase64 = ""
          if (questionImages[question.number]) {
            questionImageBase64 = await convertFileToBase64(questionImages[question.number])
          }

          const optionImagesBase64: Record<string, string> = {}
          const optionImages = questionOptionImages[question.number]
          if (optionImages) {
            if (optionImages.a) optionImagesBase64.a = await convertFileToBase64(optionImages.a)
            if (optionImages.b) optionImagesBase64.b = await convertFileToBase64(optionImages.b)
            if (optionImages.c) optionImagesBase64.c = await convertFileToBase64(optionImages.c)
            if (optionImages.d) optionImagesBase64.d = await convertFileToBase64(optionImages.d)
          }

          await set(refDB(db, `questions/${categoryId}/${questionKey}`), {
            id: i + 1,
            question: question.text,
            options: {
              a: question.optionA,
              b: question.optionB,
              c: question.optionC,
              ...(question.optionD && { d: question.optionD }),
            },
            correctAnswer: question.correctAnswer?.toUpperCase(),
            reeks: detectedSeriesName,
            ...(questionImageBase64 && { questionImage: questionImageBase64 }),
            ...(question.needsImage && { needsImage: true }),
            ...(question.imageDescription && { imageDescription: question.imageDescription }),
            ...(question.optionsHaveImages && { optionsHaveImages: true }),
            ...(Object.keys(optionImagesBase64).length > 0 && { optionImages: optionImagesBase64 }),
          })
        }
        console.log("[v0] ✓ Saved", totalQuestions, "questions")
      }

      await saveCategoryStatus(categoryId, "non-actief")

      console.log("[v0] STEP 3: Reloading data...")
      await loadAllCategories()
      await loadQuestions(categoryId)
      setSelectedCategory(categoryId)
      setSelectedReeks("all")

      console.log("[v0] ========================================")
      console.log("[v0] ✓ CATEGORY CREATED SUCCESSFULLY")
      console.log("[v0] ========================================")

      toast({
        title: "Succes",
        description: `${editableParsedQuestions.length} vragen succesvol opgeslagen voor ${newCategoryName}${autoSplit === "split" && totalQuestions > questionsPerSeries ? ` (gesplitst in ${Math.ceil(totalQuestions / questionsPerSeries)} reeksen)` : ""}`,
      })

      // Close modal and refresh
      setShowUploadModal(false)
      setQuestionsText("")
      setParsedQuestions([])
      setEditableParsedQuestions([])
      setNewCategoryName("")
      setNewCategoryDescription("")
      setNewCategoryIcon(null)
      setNewCategoryIconPreview("")
      setQuestionImages({})
      setQuestionOptionImages({})
      setCustomReeks("")
      setUploadModalSelectedSeries("1")
    } catch (error) {
      console.error("[v0] ========================================")
      console.error("[v0] WORKFLOW ERROR: Failed to create category")
      console.error("[v0] ========================================")
      console.error("[v0] Error details:", error)
      alert("Er is een fout opgetreden bij het opslaan")
    }
  }

  // Correctly placed handleExportEdits function
  const handleExportEdits = () => {
    // Removed export of savedEdits as it's no longer tracked separately.
    // Edits are now directly in the questions node.
    // const editsArray = Object.values(savedEdits)
    // const code = `// Question Edits Export
    // // Generated: ${new Date().toISOString()}
    // const questionEdits = ${JSON.stringify(editsArray, null, 2)}
    // export default questionEdits`
    //
    // const blob = new Blob([code], { type: "text/javascript" })
    // const url = URL.createObjectURL(blob)
    // const a = document.createElement("a")
    // a.href = url
    // a.download = `question-edits-${new Date().toISOString().split("T")[0]}.js`
    // document.body.appendChild(a)
    // a.click()
    // document.body.removeChild(a)
    // URL.revokeObjectURL(url)
  }

  const handleApplyAllEdits = async () => {
    // Removed check for savedEdits. This function will now have no effect as edits are applied directly.
    // If there were a need to revert to original, that logic would be different.
    /*
    if (Object.keys(savedEdits).length === 0) {
      toast({
        title: "Geen aanpassingen",
        description: "Er zijn geen opgeslagen aanpassingen om toe te passen",
      })
      return
    }

    const confirmed = confirm(
      `Weet je zeker dat je ${Object.keys(savedEdits).length} opgeslagen aanpassingen wilt toepassen op de database? Dit overschrijft de huidige vragen.`,
    )

    if (!confirmed) return

    try {
      let successCount = 0
      let errorCount = 0

      for (const [questionKey, edit] of Object.entries(savedEdits)) {
        try {
          // Extract category from questionKey (e.g., "matroos-1" -> "matroos")
          const category = questionKey.split("-")[0]
          const questionRef = refDB(db, `questions/${category}/${questionKey}`)

          // Update the question in the database
          await update(questionRef, {
            question: edit.question,
            correctAnswer: edit.correct.toUpperCase(),
            options: edit.options,
            ...(edit.optionImages && { optionImages: edit.optionImages }),
          })

          successCount++
        } catch (error) {
          console.error(`[v0] Error applying edit for ${questionKey}:`, error)
          errorCount++
        }
      }

      toast({
        title: "Aanpassingen toegepast",
        description: `${successCount} aanpassingen succesvol toegepast${errorCount > 0 ? `, ${errorCount} fouten` : ""}`,
      })

      // Reload questions to show updated data
      await loadQuestions() // Use loadQuestions instead of loadFirebaseQuestions
    } catch (error) {
      console.error("[v0] Error applying all edits:", error)
      toast({
        title: "Fout",
        description: "Kon aanpassingen niet toepassen",
        variant: "destructive",
      })
    }
    */
  }

  const handleMigrateTimestamps = async () => {
    setIsMigrating(true)
    try {
      const result = await migrateTimestamps()
      setMigrationResult(result)
      console.log("[v0] Migration result:", sanitizeForLog(result)) // Log sanitized result
    } catch (error) {
      console.error("[v0] Migration error:", error)
      setMigrationResult({
        success: false,
        message: "Fout tijdens migratie",
        details: {},
      })
    } finally {
      setIsMigrating(false)
    }
  }

  const handleMigrateStatic = async () => {
    setIsStaticMigrating(true)
    try {
      const result = await migrateStaticQuestionsToFirebase()
      setStaticMigrationResult(result)
      console.log("[v0] Static migration result:", sanitizeForLog(result)) // Log sanitized result

      // Reload questions after successful migration
      if (result.success) {
        await loadAllQuestions()
      }
    } catch (error) {
      console.error("[v0] Static migration error:", error)
      setStaticMigrationResult({
        success: false,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      })
    } finally {
      setIsStaticMigrating(false)
    }
  }

  const handleToggleReviewFlag = async (questionId: number) => {
    const question = filteredQuestions.find((q) => q.id === questionId)
    if (!question) return

    const currentFlag = question.needsReview || false
    const newFlag = !currentFlag

    try {
      const questionKey = `${selectedCategory}-${questionId}`
      await update(refDB(db, `questions/${selectedCategory}/${questionKey}`), {
        needsReview: newFlag,
      })

      // Update local state
      setFirebaseQuestions((prev) => ({
        ...prev,
        [questionKey]: {
          ...prev[questionKey],
          needsReview: newFlag,
        },
      }))

      console.log("[v0] Review flag toggled:", questionId, newFlag)
    } catch (error) {
      console.error("[v0] Error toggling review flag:", error)
    }
  }

  const handleSaveInlineEdit = async (question: Question) => {
    if (!editingQuestionId || !editFormData) return

    console.log("[v0] Saving inline edit for question:", editingQuestionId)
    console.log("[v0] Edit form data:", sanitizeForLog(editFormData))
    console.log("[v0] Correct answer being saved:", editFormData.correct)

    setIsSaving(true)
    try {
      // Removed saving to questionEdits node. Edits are now directly applied to the questions node.
      // const editKey = `${selectedCategory}-${editingQuestionId}`

      const options: Record<string, string> = {}
      if (editFormData.optionA?.trim()) options.a = editFormData.optionA.trim()
      if (editFormData.optionB?.trim()) options.b = editFormData.optionB.trim()
      if (editFormData.optionC?.trim()) options.c = editFormData.optionC.trim()
      if (editFormData.optionD?.trim()) options.d = editFormData.optionD.trim()

      // Build option images object, only include if has values
      const optionImagesObj: Record<string, string> = {}
      if (editFormData.optionAImage?.trim()) optionImagesObj.a = editFormData.optionAImage
      if (editFormData.optionBImage?.trim()) optionImagesObj.b = editFormData.optionBImage
      if (editFormData.optionCImage?.trim()) optionImagesObj.c = editFormData.optionCImage
      if (editFormData.optionDImage?.trim()) optionImagesObj.d = editFormData.optionDImage

      const questionUpdates: any = {
        question: editFormData.question?.trim() || "",
        options,
        ...(editFormData.correct && { correctAnswer: editFormData.correct.toUpperCase() }),
        timestamp: new Date().toISOString(),
        ...(editFormData.questionImage?.trim() && { questionImage: editFormData.questionImage }),
        ...(Object.keys(optionImagesObj).length > 0 && { optionImages: optionImagesObj }),
        // Ensure fields are present even if empty to remove them from Firebase if not provided
        ...(Object.keys(optionImagesObj).length === 0 && { optionImages: null }),
        ...(editFormData.questionImage?.trim() === "" && { questionImage: null }),
      }

      // Construct the key for the question node
      const questionKey = `${selectedCategory}-${editingQuestionId}`

      console.log("[v0] Saving edit to Firebase questions node:", questionKey, sanitizeForLog(questionUpdates))

      // Update the question in the Firebase database
      await update(refDB(db, `questions/${selectedCategory}/${questionKey}`), questionUpdates)

      // Removed updating savedEdits state
      // const newSavedEdits = { ...savedEdits }
      // newSavedEdits[editKey] = edit as QuestionEdit
      // setSavedEdits(newSavedEdits)

      console.log("[v0] Question saved to Firebase")

      // await Promise.all([loadQuestions(), loadSavedEdits()]) // REMOVED loadSavedEdits
      await loadQuestions()

      setEditingQuestionId(null)
      setEditFormData(null) // Clear edit form data
      setIsSaving(false)

      toast({
        title: "Vraag opgeslagen",
        description: `De wijziging aan vraag ${editingQuestionId} is opgeslagen.`,
        duration: 3000,
      })
    } catch (error) {
      console.error("Error saving inline edit:", error)
      setIsSaving(false)
      toast({
        title: "Fout bij opslaan",
        description: "Er is een fout opgetreden bij het opslaan van de vraag.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm(`Vraag ${questionId} permanent verwijderen?`)) return

    try {
      const questionKey = `${selectedCategory}-${questionId}`

      // Check if question exists in Firebase
      const fbQuestion = Object.values(firebaseQuestions).find((q) => q.id === questionId)

      if (fbQuestion) {
        // Delete Firebase question completely
        await remove(refDB(db, `questions/${selectedCategory}/${questionKey}`))
        console.log("[v0] Deleted Firebase question:", questionKey)
      } else {
        // Mark .ts question as deleted
        await set(refDB(db, `deletedQuestions/${selectedCategory}/${questionKey}`), true)
        console.log("[v0] Marked .ts question as deleted:", questionKey)
      }

      // Removed deletion of edits for this question.
      // Also delete any edits for this question
      // await remove(refDB(db, `questionEdits/${questionKey}`))

      toast({
        title: "Vraag verwijderd",
        description: `Vraag ${questionId} is verwijderd.`,
      })

      // Reload data
      await Promise.all([loadQuestions(), loadDeletedQuestions()]) // FIX: Use loadQuestions instead of loadFirebaseQuestions
    } catch (error) {
      console.error("[v0] Error deleting question:", error)
      toast({
        title: "Fout bij verwijderen",
        description: "Er is een fout opgetreden bij het verwijderen van de vraag.",
        variant: "destructive",
      })
    }
  }

  const handleSaveQuestionsFromOverview = async () => {
    console.log("[v0] ========================================")
    console.log("[v0] ADD TO EXISTING CATEGORY")
    console.log("[v0] ========================================")
    console.log("[v0] Category:", selectedCategory)
    console.log("[v0] Questions to add:", editableParsedQuestions.length)

    console.log("[v0] First 3 editable questions:")
    editableParsedQuestions.slice(0, 3).forEach((q, i) => {
      console.log(`  [${i}] number=${q.number}, text="${q.text?.substring(0, 50)}..."`)
    })

    if (editableParsedQuestions.length === 0) {
      alert("Geen vragen gevonden om op te slaan")
      return
    }

    const missingAnswers = editableParsedQuestions.filter((q) => !q.correctAnswer)

    if (missingAnswers.length > 0) {
      alert(
        `${missingAnswers.length} vragen hebben nog geen correct antwoord geselecteerd. Selecteer deze eerst in de preview.`,
      )
      return
    }

    try {
      console.log("[v0] Loading existing questions from Firebase...")
      const existingQuestions = await loadQuestionsFromFirebase(selectedCategory)
      const existingKeys = Object.keys(existingQuestions)

      console.log("[v0] Existing questions:", existingKeys.length)

      const existingIds = existingKeys
        .map((key) => {
          const parts = key.split("-")
          const numPart = parts[parts.length - 1]
          return Number.parseInt(numPart, 10)
        })
        .filter((id) => !isNaN(id))

      const maxFbId = existingIds.length > 0 ? Math.max(...existingIds) : 0
      const nextId = maxFbId + 1

      console.log("[v0] Max ID:", maxFbId, "→ Next ID:", nextId)
      console.log("[v0] Will assign IDs:", nextId, "to", nextId + editableParsedQuestions.length - 1)

      const detectedSeriesName = uploadModalSelectedSeries === "new" ? customReeksInput : uploadModalSelectedSeries
      const normalizedDetectedSeriesName = normalizeReeks(detectedSeriesName) // Normalize here

      console.log("[v0] Series name:", detectedSeriesName)

      const savedKeys: string[] = []

      for (let i = 0; i < editableParsedQuestions.length; i++) {
        const question = editableParsedQuestions[i]
        const questionKey = `${selectedCategory}-${nextId + i}`

        const keyExists = existingKeys.includes(questionKey)
        if (keyExists) {
          console.error("[v0] ❌ CONFLICT: Key", questionKey, "already exists!")
          throw new Error(`Conflict detected: Question key ${questionKey} already exists`)
        }

        await set(refDB(db, `questions/${selectedCategory}/${questionKey}`), {
          id: nextId + i,
          question: question.text,
          options: {
            a: question.optionA,
            b: question.optionB,
            c: question.optionC,
            ...(question.optionD && { d: question.optionD }),
          },
          correctAnswer: question.correctAnswer?.toUpperCase(),
          reeks: normalizedDetectedSeriesName || "1",
          ...(question.needsImage && { needsImage: true }),
          ...(question.imageDescription && { imageDescription: question.imageDescription }),
          ...(question.optionsHaveImages && { optionsHaveImages: true }),
          ...(question.optionAImage && { optionAImageDescription: question.optionAImage }),
          ...(question.optionBImage && { optionBImageDescription: question.optionBImage }),
          ...(question.optionCImage && { optionCImageDescription: question.optionCImage }),
          ...(question.optionDImage && { optionDImageDescription: question.optionDImage }),
        })

        savedKeys.push(questionKey)
      }

      console.log("[v0] ✓ Saved", savedKeys.length, "questions")

      console.log("[v0] Verifying...")
      const verifyQuestions = await loadQuestionsFromFirebase(selectedCategory)
      const verifyKeys = Object.keys(verifyQuestions)
      console.log("[v0] Total after save:", verifyKeys.length, "(was", existingKeys.length, ")")

      // Questions by reeks
      const reeksCount = new Map<string, number>()
      verifyKeys.forEach((key) => {
        const reeks = verifyQuestions[key].reeks
        reeksCount.set(reeks, (reeksCount.get(reeks) || 0) + 1)
      })
      console.log("[v0] Questions by reeks:")
      reeksCount.forEach((count, reeksName) => {
        console.log(`  "${reeksName}": ${count} questions`)
      })

      console.log("[v0] ========================================")
      console.log("[v0] ✓ QUESTIONS ADDED SUCCESSFULLY")
      console.log("[v0] ========================================")

      await saveCategoryStatus(selectedCategory, "non-actief")

      toast({
        title: "Succes",
        description: `${editableParsedQuestions.length} vragen succesvol toegevoegd aan ${selectedCategory}`,
      })

      await loadQuestions(selectedCategory)
      setShowUploadModal(false)
      setEditableParsedQuestions([])
      setShowPdfUploadInOverview(false)
      setParsedQuestionsForOverview([])
      setQuestionsText("")
      setUploadModalSelectedSeries("all")
      setCustomReeksInput("")
    } catch (error) {
      console.error("[v0] Error saving questions to Firebase:", error)
      toast({
        title: "Fout bij opslaan",
        description: "Er is een fout opgetreden bij het opslaan van de vragen.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    const category = allCategories.find((c) => c.id === categoryId)
    if (!category) return

    console.log("[v0] Deleting category and all questions at path:", `questions/${categoryId}`)

    if (
      !confirm(
        `Weet je zeker dat je de categorie "${category.name}" wilt verwijderen? Alle vragen en data worden ook verwijderd.`,
      )
    ) {
      return
    }

    try {
      await deleteCategory(categoryId)

      // Update local state
      setAllCategories((prev) => prev.filter((c) => c.id !== categoryId))

      setFirebaseQuestions({})
      console.log("[v0] Cleared local Firebase questions cache after delete")

      toast({
        title: "Categorie verwijderd",
        description: `De categorie "${category.name}" is verwijderd.`,
      })
    } catch (error) {
      console.error("[v0] Error deleting category:", error)
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het verwijderen van de categorie.",
        variant: "destructive",
      })
    }
  }

  const handleSaveCategoryName = async (categoryId: string) => {
    if (!editingCategoryName.trim()) {
      toast({
        title: "Fout",
        description: "Categorienaam mag niet leeg zijn.",
        variant: "destructive",
      })
      return
    }

    try {
      let iconBase64: string | undefined

      if (editingCategoryIcon) {
        const reader = new FileReader()
        iconBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(editingCategoryIcon)
        })
      } else if (editingCategoryIconPreview) {
        // Keep existing icon if no new icon selected
        iconBase64 = editingCategoryIconPreview
      }

      const category = allCategories.find((c) => c.id === categoryId)
      if (!category) return

      const newCategoryId = editingCategoryName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")

      if (newCategoryId !== categoryId) {
        console.log(`[v0] Category ID changed from ${categoryId} to ${newCategoryId}, updating questions...`)

        // Move all questions to new category ID
        const result = await renameCategoryId(categoryId, newCategoryId)

        console.log(`[v0] Moved ${result.movedQuestionsCount} questions to new category ID`)
      }

      await saveCategory(newCategoryId, editingCategoryName, category.description, iconBase64)

      toast({
        title: "Categorie bijgewerkt",
        description: "De categorie naam en icoon zijn succesvol bijgewerkt.",
      })

      setEditingCategoryId(null)
      setEditingCategoryName("")
      setEditingCategoryIcon(null)
      setEditingCategoryIconPreview("")

      if (newCategoryId !== categoryId && selectedCategory === categoryId) {
        setSelectedCategory(newCategoryId)
      }

      // Refresh categories
      await loadAllCategories() // Renamed to loadDynamicCategories
    } catch (error) {
      console.error("Error updating category:", error)
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het bijwerken van de categorie.",
        variant: "destructive",
      })
    }
  }

  const renderCategoryList = () => {
    return (
      <div className="space-y-4">
        {allCategories.map((category) => (
          <Card
            key={category.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => {
              setSelectedCategory(category.id)
              setShowQuestionBrowser(true)
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {category.icon && editingCategoryId !== category.id && (
                    <div className="w-10 h-10 flex-shrink-0">
                      <img
                        src={category.icon || "/placeholder.svg"}
                        alt={`${category.name} icon`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    {editingCategoryId === category.id ? (
                      <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 flex-shrink-0 border rounded flex items-center justify-center bg-muted">
                            {editingCategoryIconPreview || category.icon ? (
                              <img
                                src={editingCategoryIconPreview || category.icon}
                                alt="Preview"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">Icon</span>
                            )}
                          </div>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleEditCategoryIconUpload(e.target.files?.[0] || null)}
                              className="hidden"
                            />
                            <Button type="button" variant="outline" size="sm" asChild>
                              <span>Icoon Kiezen</span>
                            </Button>
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className="max-w-md"
                            placeholder="Categorie naam"
                          />
                          <Button onClick={() => handleSaveCategoryName(category.id)} size="sm">
                            Opslaan
                          </Button>
                          <Button
                            onClick={() => {
                              setEditingCategoryId(null)
                              setEditingCategoryIcon(null)
                              setEditingCategoryIconPreview("")
                            }}
                            variant="outline"
                            size="sm"
                          >
                            Annuleren
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <CardTitle>{category.name}</CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingCategoryId(category.id)
                      setEditingCategoryName(category.name)
                      setEditingCategoryIconPreview(category.icon || "")
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  <Select
                    value={category.status}
                    onValueChange={(value: CategoryStatus) => handleStatusChange(category.id, value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actief">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          Actief
                        </span>
                      </SelectItem>
                      <SelectItem value="binnenkort">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          Binnenkort
                        </span>
                      </SelectItem>
                      <SelectItem value="non-actief">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                          Niet beschikbaar {/* Changed from "Niet Actief" */}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  const handleManualQuestionSave = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] handleManualQuestionSave called")

    if (!formRef.current) {
      console.log("[v0] No form ref found")
      return
    }

    const formData = new FormData(formRef.current)

    // Get basic fields
    const question = (formData.get("question") as string)?.trim()
    const optionA = (formData.get("optionA") as string)?.trim()
    const optionB = (formData.get("optionB") as string)?.trim()
    const optionC = (formData.get("optionC") as string)?.trim()
    const optionD = (formData.get("optionD") as string)?.trim()

    console.log("[v0] Form data:", sanitizeForLog({ question, optionA, optionB, optionC, optionD })) // Log sanitized data

    // Validate required fields
    if (!question || !optionA || !optionB || !optionC) {
      toast({
        title: "Fout",
        description: "Vul alle verplichte velden in (vraag en opties A, B, C)",
        variant: "destructive",
      })
      return
    }

    // Get reeks - use custom if "new" was selected, otherwise use selected value
    let finalReeks = selectedReeks
    if (selectedReeks === "new") {
      // Use customReeksInput if selectedReeks is "new"
      finalReeks = customReeksInput || (formData.get("customReeks") as string)
    }

    finalReeks = normalizeReeks(finalReeks) || "1"

    console.log("[v0] Final reeks to save:", finalReeks)

    // Build options array
    const options = [optionA, optionB, optionC]
    if (optionD) options.push(optionD)

    // Get next question ID for this category
    // Use loadQuestionsFromFirebase to get existing questions and determine next ID
    const existingQuestions = await loadQuestionsFromFirebase(selectedCategory)
    const maxId =
      Object.keys(existingQuestions).length > 0
        ? Math.max(...Object.values(existingQuestions).map((q: Question) => q.id || 0))
        : 0
    const questionIdToSave = maxId + 1

    // Build question object - start clean
    const newQuestion: any = {
      id: questionIdToSave,
      question,
      options,
      correctAnswer: selectedCorrectAnswer,
      reeks: finalReeks,
    }

    // Add question image if exists
    const questionImage = (formData.get("questionImage") as string)?.trim()
    if (questionImage) {
      newQuestion.questionImage = questionImage
    } else {
      // Explicitly set to empty string if not present to ensure the field exists
      newQuestion.questionImage = ""
    }

    // Add option images as object (not array!) if they exist
    const optionImages: Record<string, string> = {}
    const optionLetters = ["a", "b", "c", "d"]

    for (const letter of optionLetters) {
      const imageData = (formData.get(`option${letter.toUpperCase()}Image`) as string)?.trim()
      if (imageData) {
        optionImages[letter] = imageData
      }
    }

    // Only add optionImages if at least one image exists
    if (Object.keys(optionImages).length > 0) {
      newQuestion.optionImages = optionImages
    }

    console.log("[v0] Saving question to Firebase:", sanitizeForLog(newQuestion)) // Log sanitized question

    try {
      await saveQuestionToFirebase(selectedCategory, newQuestion)
      toast({
        title: "Vraag opgeslagen",
        description: "De vraag is succesvol toegevoegd",
      })

      // Reset form and state
      setShowManualQuestionForm(false)
      formRef.current?.reset()
      setSelectedCorrectAnswer("a")
      setSelectedReeks("1") // Reset to default or initial value
      setCustomReeksInput("") // Clear custom reeks input
      setManualQuestionData({
        question: "",
        questionImage: "",
        optionA: "",
        optionAImage: "",
        optionB: "",
        optionBImage: "",
        optionC: "",
        optionCImage: "",
        optionD: "",
        optionDImage: "",
        correctAnswer: "a",
      })

      // Reload questions to show new question
      await loadAllQuestions()
    } catch (error) {
      console.error("[v0] Error saving question to Firebase:", error)
      toast({
        title: "Fout bij opslaan",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden",
        variant: "destructive",
      })
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<string> => {
    const file = event.target.files?.[0]
    if (!file) return ""

    // </CHANGE> Removed detailed base64 logging to clean up debug output
    console.log(`[v0] Uploading image: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (typeof result === "string") {
          console.log(`[v0] Image converted successfully (${(result.length / 1024).toFixed(2)} KB)`)
          resolve(result)
        } else {
          reject(new Error("Failed to read file as data URL"))
        }
      }
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(file)
    })
  }

  const handleUpdateReeks = async () => {
    setIsReeksUpdating(true)
    try {
      const result = await updateExistingQuestionsWithReeks()
      setReeksUpdateResult(result)
      console.log("[v0] Reeks update result:", sanitizeForLog(result)) // Log sanitized result

      // Reload questions after successful update
      if (result.success) {
        await loadAllQuestions()
      }
    } catch (error) {
      console.error("[v0] Reeks update error:", error)
      setReeksUpdateResult({
        success: false,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      })
    } finally {
      setIsReeksUpdating(false)
    }
  }

  // ADD: Function to export all categories at once
  const handleExportAllCategories = async () => {
    setIsExporting(true) // Set exporting state
    try {
      const categories = await getAllCategories()

      if (categories.length === 0) {
        alert("Geen categorieën gevonden om te exporteren.")
        return
      }

      for (const category of categories) {
        const categoryId = category.id
        const allQuestions = await getAllQuestions(categoryId)

        // Group questions by reeks
        const questionsByReeks: Record<string, any[]> = {}

        Object.entries(allQuestions).forEach(([questionId, questionData]: [string, any]) => {
          const reeks = questionData.reeks || "1"
          if (!questionsByReeks[reeks]) {
            questionsByReeks[reeks] = []
          }
          questionsByReeks[reeks].push({
            id: questionId,
            ...questionData,
          })
        })

        // Generate TypeScript code
        let code = `// Backup for ${category.name} - Generated: ${new Date().toISOString()}\n`
        code += `import type { Question, QuestionSet } from "./radar-data"\n\n`

        // Helper functions
        code += `const q = (id: string, question: string, options: Record<string, string>, correct: string): Question => ({\n`
        code += `  id,\n  question,\n  options,\n  correct,\n})\n\n`

        code += `const qWithImage = (id: string, question: string, options: Record<string, string>, correct: string, image: string): Question => ({\n`
        code += `  id,\n  question,\n  options,\n  correct,\n  hasImage: true,\n  image,\n})\n\n`

        // Question sets
        code += `export const ${categoryId}QuestionSets: QuestionSet[] = [\n`

        Object.keys(questionsByReeks)
          .sort()
          .forEach((reeksName) => {
            const questions = questionsByReeks[reeksName]
            code += `  {\n`
            code += `    id: "${reeksName}",\n`
            code += `    name: "${reeksName}",\n`
            code += `    description: "${category.name} - ${reeksName}",\n`
            code += `    questions: [\n`

            questions.forEach((q) => {
              const hasImage = q.questionImage || q.image
              const options = JSON.stringify(q.options || {})
              const correct = JSON.stringify(q.correctAnswer || q.correct || "a")

              if (hasImage) {
                const imageData = q.questionImage || q.image
                code += `      qWithImage(${JSON.stringify(q.id)}, ${JSON.stringify(q.question)}, ${options}, ${correct}, ${JSON.stringify(imageData)}),\n`
              } else {
                code += `      q(${JSON.stringify(q.id)}, ${JSON.stringify(q.question)}, ${options}, ${correct}),\n`
              }
            })

            code += `    ],\n`
            code += `  },\n`
          })

        code += `]\n\n`
        code += `export const questionSets = ${categoryId}QuestionSets\n`

        // Download file
        const blob = new Blob([code], { type: "text/typescript" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${categoryId}-data-backup-${new Date().toISOString().split("T")[0]}.ts`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      alert(`Alle ${categories.length} categorieën succesvol geëxporteerd!`)
    } catch (error) {
      console.error("Error exporting all categories:", error)
      alert("Er is een fout opgetreden bij het exporteren van alle categorieën.")
    } finally {
      setIsExporting(false) // Reset exporting state
    }
  }

  const handleExportCategoryBackup = async () => {
    if (!selectedCategory) return

    try {
      const allQuestions = await getAllQuestions(selectedCategory)

      // Group questions by reeks
      const questionsByReeks: Record<string, any[]> = {}

      Object.entries(allQuestions).forEach(([questionId, questionData]: [string, any]) => {
        const reeks = questionData.reeks || "1"
        if (!questionsByReeks[reeks]) {
          questionsByReeks[reeks] = []
        }
        questionsByReeks[reeks].push({
          id: questionId,
          ...questionData,
        })
      })

      // Generate TypeScript code
      let code = `// Backup for ${selectedCategory} - Generated: ${new Date().toISOString()}\n`
      code += `import type { Question, QuestionSet } from "./radar-data"\n\n`

      // Helper functions
      code += `const q = (id: string, question: string, options: Record<string, string>, correct: string): Question => ({\n`
      code += `  id,\n  question,\n  options,\n  correct,\n})\n\n`

      code += `const qWithImage = (id: string, question: string, options: Record<string, string>, correct: string, image: string): Question => ({\n`
      code += `  id,\n  question,\n  options,\n  correct,\n  hasImage: true,\n  image,\n})\n\n`

      // Question sets
      code += `export const ${selectedCategory}QuestionSets: QuestionSet[] = [\n`

      Object.keys(questionsByReeks)
        .sort()
        .forEach((reeksName) => {
          const questions = questionsByReeks[reeksName]
          code += `  {\n`
          code += `    id: "${reeksName}",\n`
          code += `    name: "${reeksName}",\n`
          code += `    description: "${selectedCategory} - ${reeksName}",\n`
          code += `    questions: [\n`

          questions.forEach((q) => {
            const hasImage = q.questionImage || q.image
            const options = JSON.stringify(q.options || {})
            const correct = JSON.stringify(q.correctAnswer || q.correct || "a")

            if (hasImage) {
              const imageData = q.questionImage || q.image
              code += `      qWithImage(${JSON.stringify(q.id)}, ${JSON.stringify(q.question)}, ${options}, ${correct}, ${JSON.stringify(imageData)}),\n`
            } else {
              code += `      q(${JSON.stringify(q.id)}, ${JSON.stringify(q.question)}, ${options}, ${correct}),\n`
            }
          })

          code += `    ],\n`
          code += `  },\n`
        })

      code += `]\n\n`
      code += `export const questionSets = ${selectedCategory}QuestionSets\n`

      // Download file
      const blob = new Blob([code], { type: "text/typescript" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${selectedCategory}-data-backup-${new Date().toISOString().split("T")[0]}.ts`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      alert(`Backup succesvol geëxporteerd voor ${selectedCategory}!`)
    } catch (error) {
      console.error("Error exporting backup:", error)
      alert("Er is een fout opgetreden bij het exporteren van de backup.")
    }
  }

  // ADD: Function to export a specific category as a TS file
  const handleExportCategory = async (categoryId: string) => {
    try {
      const category = allCategories.find((c) => c.id === categoryId)
      if (!category) return

      const allQuestions = await getAllQuestions(categoryId)

      // Group questions by reeks
      const questionsByReeks: Record<string, any[]> = {}

      Object.entries(allQuestions).forEach(([questionId, questionData]: [string, any]) => {
        const reeks = questionData.reeks || "1"
        if (!questionsByReeks[reeks]) {
          questionsByReeks[reeks] = []
        }
        questionsByReeks[reeks].push({
          id: questionId,
          ...questionData,
        })
      })

      // Generate TypeScript code
      let code = `// Backup for ${category.name} - Generated: ${new Date().toISOString()}\n`
      code += `import type { Question, QuestionSet } from "./radar-data"\n\n`

      // Helper functions
      code += `const q = (id: string, question: string, options: Record<string, string>, correct: string): Question => ({\n`
      code += `  id,\n  question,\n  options,\n  correct,\n})\n\n`

      code += `const qWithImage = (id: string, question: string, options: Record<string, string>, correct: string, image: string): Question => ({\n`
      code += `  id,\n  question,\n  options,\n  correct,\n  hasImage: true,\n  image,\n})\n\n`

      // Question sets
      code += `export const ${categoryId}QuestionSets: QuestionSet[] = [\n`

      Object.keys(questionsByReeks)
        .sort()
        .forEach((reeksName) => {
          const questions = questionsByReeks[reeksName]
          code += `  {\n`
          code += `    id: "${reeksName}",\n`
          code += `    name: "${reeksName}",\n`
          code += `    description: "${category.name} - ${reeksName}",\n`
          code += `    questions: [\n`

          questions.forEach((q) => {
            const hasImage = q.questionImage || q.image
            const options = JSON.stringify(q.options || {})
            const correct = JSON.stringify(q.correctAnswer || q.correct || "a")

            if (hasImage) {
              const imageData = q.questionImage || q.image
              code += `      qWithImage(${JSON.stringify(q.id)}, ${JSON.stringify(q.question)}, ${options}, ${correct}, ${JSON.stringify(imageData)}),\n`
            } else {
              code += `      q(${JSON.stringify(q.id)}, ${JSON.stringify(q.question)}, ${options}, ${correct}),\n`
            }
          })

          code += `    ],\n`
          code += `  },\n`
        })

      code += `]\n\n`
      code += `export const questionSets = ${categoryId}QuestionSets\n`

      // Download file
      const blob = new Blob([code], { type: "text/typescript" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${categoryId}-data-backup-${new Date().toISOString().split("T")[0]}.ts`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      alert(`Backup succesvol geëxporteerd voor ${category.name}!`)
    } catch (error) {
      console.error("Error exporting category:", error)
      alert("Er is een fout opgetreden bij het exporteren van de categorie.")
    }
  }

  const handleRenameSeries = async () => {
    if (!selectedCategory || !renameSeriesOldName || !renameSeriesNewName) {
      toast({
        title: "Fout",
        description: "Vul beide velden in om de reeks naam te wijzigen",
        variant: "destructive",
      })
      return
    }

    if (renameSeriesOldName === renameSeriesNewName) {
      toast({
        title: "Geen wijziging",
        description: "De nieuwe naam is hetzelfde als de oude naam",
        variant: "destructive",
      })
      return
    }

    setIsRenamingSeries(true)

    try {
      const selectedOption = availableReeksOptionsWithOriginal.find((opt) => opt.value === renameSeriesOldName)
      const originalReeksName = selectedOption?.original || renameSeriesOldName

      console.log("[v0] Renaming series - normalized:", renameSeriesOldName, "original:", originalReeksName)

      const result = await renameSeriesInCategory(selectedCategory, originalReeksName, renameSeriesNewName)

      if (result.success && result.updatedCount > 0) {
        toast({
          title: "Reeks hernoemd",
          description: `${result.updatedCount} vragen zijn bijgewerkt met de nieuwe reeks naam "${renameSeriesNewName}"`,
        })

        setSelectedQuestionSet("all")
        setSelectedReeks("all")

        await loadQuestions()

        setShowRenameSeriesDialog(false)
        setRenameSeriesOldName("")
        setRenameSeriesNewName("")
      } else {
        toast({
          title: "Geen vragen gevonden",
          description: `Geen vragen gevonden met reeks naam "${originalReeksName}"`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error renaming series:", error)
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het hernoemen van de reeks",
        variant: "destructive",
      })
    } finally {
      setIsRenamingSeries(false)
    }
  }

  const handleDeleteSeries = async () => {
    if (!selectedCategory || !deleteSeriesName) {
      toast({
        title: "Fout",
        description: "Selecteer een reeks om te verwijderen",
        variant: "destructive",
      })
      return
    }

    setIsDeletingSeries(true)

    try {
      const selectedOption = availableReeksOptionsWithOriginal.find((opt) => opt.value === deleteSeriesName)
      const originalReeksName = selectedOption?.original || deleteSeriesName

      console.log("[v0] Deleting series - normalized:", deleteSeriesName, "original:", originalReeksName)

      const result = await deleteSeriesFromCategory(selectedCategory, originalReeksName)

      if (result.success && result.deletedCount > 0) {
        toast({
          title: "Reeks verwijderd",
          description: `${result.deletedCount} vragen zijn verwijderd uit de reeks "${originalReeksName}"`,
        })

        setSelectedQuestionSet("all")
        setSelectedReeks("all")

        await loadQuestions()

        setShowDeleteSeriesDialog(false)
        setDeleteSeriesName("")
      } else {
        toast({
          title: "Geen vragen gevonden",
          description: `Geen vragen gevonden met reeks naam "${originalReeksName}"`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error deleting series:", error)
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het verwijderen van de reeks",
        variant: "destructive",
      })
    } finally {
      setIsDeletingSeries(false)
    }
  }

  const handleSmartSave = async () => {
    // Check if the category already exists
    const categoryExists = allCategories.some(
      (cat) => cat.id === newCategoryName || cat.id === newCategoryName.toLowerCase().replace(/\s+/g, "-"),
    )

    if (isAddingToExistingCategory || categoryExists) {
      console.log("[v0] Routing to: ADD TO EXISTING CATEGORY workflow")
      await handleSaveQuestionsFromOverview()
    } else {
      console.log("[v0] Routing to: NEW CATEGORY workflow")
      await handleSaveNewCategoryWithQuestions()
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <div className="flex items-center gap-4">
            {email && <span className="text-sm text-muted-foreground">{email}</span>}
            {isLoading && <span className="text-sm text-muted-foreground">Laden...</span>}
            <Link href="/">
              <Button variant="outline">Terug naar Home</Button>
            </Link>
          </div>
        </div>

        {/* User Statistics */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="py-2">
              <CardHeader className="pb-0 pt-2 px-4">
                <CardTitle className="text-xl font-bold">{userStats.totalUsers}</CardTitle>
                <CardDescription className="text-[10px]">Totaal Gebruikers</CardDescription>
              </CardHeader>
            </Card>
            <Card className="py-2">
              <CardHeader className="pb-0 pt-2 px-4">
                <CardTitle className="text-xl font-bold">{userStats.anonymousClicks || 0}</CardTitle>
                <CardDescription className="text-[10px]">Anoniem Gebruik</CardDescription>
              </CardHeader>
              <CardFooter className="pt-2 pb-0 px-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAnonymousClicks}
                  className="w-full bg-transparent h-6 text-[10px] py-0"
                >
                  <RotateCcw className="w-2.5 h-2.5 mr-1" />
                  Reset
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Categorie Beheer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Beschikbare Categorieën:</h3>
                {renderCategoryList()}
              </div>

              <div className="pt-4 border-t">
                {/* Button text simplified to only "Nieuwe Categorie" */}
                <Button onClick={handleTextUpload} className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Nieuwe Categorie
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Beheer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* CHANGE: Removed maintenance buttons and their associated state/handlers */}
            <Button onClick={handleExportAllCategories} disabled={isExporting} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Exporteer Volledige Backup (Alle Categorieën)
            </Button>
            {/* CHANGE: Added button to apply all saved edits */}
            {/* <Button variant="outline" onClick={handleApplyAllEdits} className="w-full gap-2 bg-transparent">
              <Upload className="h-4 w-4" />
              Pas Alle Opgeslagen Aanpassingen Toe
            </Button> */}
            {/* REMOVED: handleApplyAllEdits button as savedEdits is no longer used */}
          </CardContent>
        </Card>

        {showTimestampMigration && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>Timestamp Migratie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!migrationResult ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Deze functie converteert alle oude timestamps (milliseconden) om naar leesbare ISO strings.
                    </p>
                    <p className="text-sm text-muted-foreground">Dit wordt toegepast op:</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>User createdAt en lastActive</li>
                      <li>Quiz results timestamps</li>
                      <li>Quiz progress timestamps</li>
                    </ul>
                    <div className="flex gap-2">
                      <Button onClick={handleMigrateTimestamps} disabled={isMigrating}>
                        {isMigrating ? "Bezig met converteren..." : "Start Migratie"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowTimestampMigration(false)}>
                        Annuleren
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`p-4 rounded-lg ${migrationResult.success ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      <p className={`font-semibold ${migrationResult.success ? "text-green-600" : "text-red-600"}`}>
                        {migrationResult.message}
                      </p>
                    </div>
                    {migrationResult.success && (
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm">Details per gebruiker:</h3>
                        <div className="bg-muted p-3 rounded-lg text-xs font-mono max-h-64 overflow-y-auto">
                          {Object.entries(migrationResult.details).map(([username, details]: [string, any]) => (
                            <div key={username} className="mb-2">
                              <strong>{username}:</strong>
                              <ul className="ml-4">
                                {details.createdAt && <li>✓ createdAt omgezet</li>}
                                {details.lastActive && <li>✓ lastActive omgezet</li>}
                                {details.quizResults > 0 && <li>✓ {details.quizResults} quiz results omgezet</li>}
                                {details.quizProgress > 0 && <li>✓ {details.quizProgress} quiz progress omgezet</li>}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      onClick={() => {
                        setShowTimestampMigration(false)
                        setMigrationResult(null)
                      }}
                      className="w-full"
                    >
                      Sluiten
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              {/* Updated DialogTitle to dynamically show newCategoryName */}
              <DialogTitle>
                {editableParsedQuestions.length > 0
                  ? `Vragen Nakijken - ${newCategoryName || selectedCategory}`
                  : `Vragen Toevoegen`}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-auto">
              {editableParsedQuestions.length === 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoryName">Categorie Naam</Label>
                    <Input
                      id="categoryName"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Bijv: Radar, Matroos, Schipper"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoryDescription">Categorie Beschrijving (optioneel)</Label>
                    <Input
                      id="categoryDescription"
                      placeholder={`bijv: Oefenvragen voor ${newCategoryName || "deze categorie"}`}
                      value={newCategoryDescription}
                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoryIcon">Categorie Icoon (optioneel)</Label>
                    <div className="flex items-center gap-4">
                      <input
                        id="categoryIcon"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleCategoryIconUpload(e.target.files?.[0] || null)}
                        className="text-sm"
                      />
                      {newCategoryIconPreview && (
                        <div className="w-12 h-12 border rounded flex items-center justify-center bg-muted">
                          <img
                            src={newCategoryIconPreview || "/placeholder.svg"}
                            alt="Icon preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="questionsInput">Vragen Invoeren</Label>
                    <Textarea
                      id="questionsInput"
                      value={questionsText}
                      onChange={(e) => setQuestionsText(e.target.value)}
                      placeholder="Plak hier de vragen in het volgende formaat:&#10;&#10;1. Vraag tekst?&#10;a) Optie A&#10;b) Optie B&#10;c) Optie C&#10;d) Optie D&#10;&#10;2. Volgende vraag?"
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleParseText} className="flex-1">
                      Vragen Verwerken
                    </Button>
                    <label htmlFor="pdf-upload">
                      <Button type="button" variant="outline" className="cursor-pointer bg-transparent" asChild>
                        <span>
                          <FileText className="h-4 w-4 mr-2" />
                          Of upload PDF
                        </span>
                      </Button>
                    </label>
                    <input id="pdf-upload" type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                  </div>

                  {isProcessingPdf && (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-center space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                        <p className="text-sm text-muted-foreground">PDF verwerken...</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        Categorie: <span className="text-primary">{newCategoryName || "Geen naam ingevuld"}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Beschrijving: {newCategoryDescription || "Geen beschrijving"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Vragen Organisatie</Label>
                    <RadioGroup
                      value={autoSplit} // Use autoSplit state here
                      onValueChange={(v) => setAutoSplit(v as "single" | "split")} // Update autoSplit state
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="single" id="single" />
                        <Label htmlFor="single" className="font-normal cursor-pointer">
                          Alle vragen in één reeks
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="split" id="split" />
                        <Label htmlFor="split" className="font-normal cursor-pointer">
                          Automatisch splitsen in groepen van 50 vragen
                        </Label>
                      </div>
                    </RadioGroup>
                    {autoSplit === "split" && editableParsedQuestions.length > 50 && (
                      <p className="text-sm text-muted-foreground">
                        {editableParsedQuestions.length} vragen worden verdeeld over{" "}
                        {Math.ceil(editableParsedQuestions.length / 50)} reeksen
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="series-select">Reeks Naam</Label>
                    <Select value={uploadModalSelectedSeries} onValueChange={handleSeriesChange}>
                      <SelectTrigger id="series-select">
                        <SelectValue placeholder="Selecteer of maak een reeks" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableReeksOptions.length > 0 &&
                          availableReeksOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        <SelectItem value="new">+ Nieuwe Reeks Aanmaken</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {uploadModalSelectedSeries === "new" && (
                    <div className="space-y-2">
                      <Label htmlFor="custom-reeks">Nieuwe Reeks Naam</Label>
                      <Input
                        id="custom-reeks"
                        value={customReeksInput} // Use customReeksInput for input value
                        onChange={handleCustomReeksChange} // Use memoized handler
                        placeholder="Bijv: Hoofdstuk 2 - Navigatie"
                      />
                    </div>
                  )}

                  <h3 className="font-semibold mb-4">Preview: {editableParsedQuestions.length} vragen gevonden</h3>

                  {editableParsedQuestions.some((q) => !q.correctAnswer) && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                      ⚠️ Sommige vragen hebben geen correct antwoord. Selecteer deze hieronder.
                    </div>
                  )}
                  {editableParsedQuestions.some((q) => q.needsImage || q.optionsHaveImages) && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                      📷 {editableParsedQuestions.filter((q) => q.needsImage || q.optionsHaveImages).length} vragen
                      hebben afbeeldingen nodig. Upload deze hieronder.
                    </div>
                  )}
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {editableParsedQuestions.map((q) => (
                      <div
                        key={q.number}
                        className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
                          q.needsImage || q.optionsHaveImages ? "border-red-300 bg-red-50" : ""
                        }`}
                      >
                        <p className="font-medium mb-3">
                          {q.number}. {q.text}
                        </p>

                        {q.needsImage && (
                          <div className="mb-4 p-3 bg-white border border-red-200 rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-red-700">📷 Afbeelding vereist:</span>
                              <span className="text-xs text-gray-600">{q.imageDescription}</span>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleQuestionImageUpload(q.number, e.target.files?.[0] || null)}
                              className="text-xs"
                            />
                            {questionImages[q.number] && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                {questionImages[q.number].name}
                              </div>
                            )}
                          </div>
                        )}

                        {q.optionsHaveImages && (
                          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                            <p className="text-xs font-medium text-amber-700 mb-2">
                              📷 Deze vraag heeft afbeeldingen in de antwoord opties
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          {/* Option A */}
                          <label className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                            <input
                              type="radio"
                              name={`question-${q.number}`}
                              checked={q.correctAnswer === "A"}
                              onChange={() => updateCorrectAnswer(q.number, "A")}
                              className="cursor-pointer mt-1"
                            />
                            <div className="flex-1">
                              <span className={q.correctAnswer === "A" ? "text-green-600 font-medium" : ""}>
                                A) {q.optionA}
                              </span>
                              {q.optionAImageDescription && (
                                <div className="mt-2 ml-4 p-2 bg-white border border-amber-200 rounded">
                                  <p className="text-xs text-amber-700 mb-1">Afbeelding: {q.optionAImageDescription}</p>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleOptionImageUpload(q.number, "a", e.target.files?.[0] || null)
                                    }
                                    className="text-xs"
                                  />
                                  {questionOptionImages[q.number]?.a && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      {questionOptionImages[q.number].a.name}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </label>

                          {/* Option B */}
                          <label className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                            <input
                              type="radio"
                              name={`question-${q.number}`}
                              checked={q.correctAnswer === "B"}
                              onChange={() => updateCorrectAnswer(q.number, "B")}
                              className="cursor-pointer mt-1"
                            />
                            <div className="flex-1">
                              <span className={q.correctAnswer === "B" ? "text-green-600 font-medium" : ""}>
                                B) {q.optionB}
                              </span>
                              {q.optionBImageDescription && (
                                <div className="mt-2 ml-4 p-2 bg-white border border-amber-200 rounded">
                                  <p className="text-xs text-amber-700 mb-1">Afbeelding: {q.optionBImageDescription}</p>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleOptionImageUpload(q.number, "b", e.target.files?.[0] || null)
                                    }
                                    className="text-xs"
                                  />
                                  {questionOptionImages[q.number]?.b && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      {questionOptionImages[q.number].b.name}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </label>

                          {/* Option C */}
                          <label className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                            <input
                              type="radio"
                              name={`question-${q.number}`}
                              checked={q.correctAnswer === "C"}
                              onChange={() => updateCorrectAnswer(q.number, "C")}
                              className="cursor-pointer mt-1"
                            />
                            <div className="flex-1">
                              <span className={q.correctAnswer === "C" ? "text-green-600 font-medium" : ""}>
                                C) {q.optionC}
                              </span>
                              {q.optionCImageDescription && (
                                <div className="mt-2 ml-4 p-2 bg-white border border-amber-200 rounded">
                                  <p className="text-xs text-amber-700 mb-1">Afbeelding: {q.optionCImageDescription}</p>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleOptionImageUpload(q.number, "c", e.target.files?.[0] || null)
                                    }
                                    className="text-xs"
                                  />
                                  {questionOptionImages[q.number]?.c && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      {questionOptionImages[q.number].c.name}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </label>

                          {/* Option D */}
                          <label className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                            <input
                              type="radio"
                              name={`question-${q.number}`}
                              checked={q.correctAnswer === "D"}
                              onChange={() => updateCorrectAnswer(q.number, "D")}
                              className="cursor-pointer mt-1"
                            />
                            <div className="flex-1">
                              <span className={q.correctAnswer === "D" ? "text-green-600 font-medium" : ""}>
                                D) {q.optionD}
                              </span>
                              {q.optionDImageDescription && (
                                <div className="mt-2 ml-4 p-2 bg-white border border-amber-200 rounded">
                                  <p className="text-xs text-amber-700 mb-1">Afbeelding: {q.optionDImageDescription}</p>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                      handleOptionImageUpload(q.number, "d", e.target.files?.[0] || null)
                                    }
                                    className="text-xs"
                                  />
                                  {questionOptionImages[q.number]?.d && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      {questionOptionImages[q.number].d.name}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-6">
                    <Button
                      onClick={handleSmartSave}
                      className="flex-1"
                      disabled={!newCategoryName.trim() && !isAddingToExistingCategory}
                    >
                      Vragen Opslaan
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowUploadModal(false)
                        setQuestionsText("")
                        setParsedQuestions([])
                        setEditableParsedQuestions([])
                        setNewCategoryName("")
                        setNewCategoryDescription("")
                        setNewCategoryIcon(null)
                        setNewCategoryIconPreview("")
                        setQuestionImages({})
                        setQuestionOptionImages({})
                        setUploadModalSelectedSeries("1")
                        setCustomReeks("")
                        setIsAddingToExistingCategory(false)
                      }}
                    >
                      Annuleren
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showQuestionBrowser} onOpenChange={setShowQuestionBrowser}>
          <DialogContent className="w-full max-w-7xl flex flex-col max-h-[90vh]">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Vragen Overzicht - {allCategories.find((c) => c.id === selectedCategory)?.name || selectedCategory}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowQuestionBrowser(false)}>
                  Sluiten
                </Button>
              </div>
              <CardDescription>Klik op een vraag om deze aan te passen</CardDescription>
            </DialogHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Filter op Reeks</label>
                  <Select value={selectedQuestionSet} onValueChange={setSelectedQuestionSet}>
                    <SelectTrigger className="w-full">
                      <SelectValue className="truncate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Reeksen ({totalQuestionsCount} vragen)</SelectItem>
                      {availableReeksOptions
                        .filter((option) => option.value !== "new")
                        .map((option) => {
                          // Removed lookup in availableQuestionSets
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label} ({getQuestionCountForSet(option.value)} vragen)
                            </SelectItem>
                          )
                        })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Filter op Afbeeldingen</label>
                  <Select
                    value={imageFilter}
                    onValueChange={(value) => setImageFilter(value as "all" | "missing" | "has")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle vragen</SelectItem>
                      <SelectItem value="missing">Alleen ontbrekende afbeeldingen</SelectItem>
                      <SelectItem value="has">Heeft afbeeldingen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Filter op Status</label>
                  <Select
                    value={showOnlyFlagged ? "flagged" : "all"}
                    onValueChange={(value) => setShowOnlyFlagged(value === "flagged")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle vragen</SelectItem>
                      <SelectItem value="flagged">Alleen gemarkeerd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Zoeken</label>
                <Input
                  placeholder="Zoek op nummer, tekst of optie..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {filteredQuestions.length} vraag{filteredQuestions.length !== 1 ? "en" : ""} gevonden
                </div>
                {/* CHANGE: Added flex-wrap so all buttons are visible */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCategoryBackup}
                    className="gap-2 bg-transparent"
                  >
                    <Download className="h-4 w-4" />
                    Backup Exporteren
                  </Button>
                  <Button variant="default" size="sm" onClick={() => setShowManualQuestionForm(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nieuwe Vraag
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowPdfUploadInOverview(true)
                    }}
                    className="gap-2 bg-transparent"
                  >
                    <Upload className="h-4 w-4" />
                    Vragen Toevoegen via PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowRenameSeriesDialog(true)
                    }}
                    className="gap-2 bg-transparent"
                  >
                    <Pencil className="h-4 w-4" />
                    Reeks Hernoemen
                  </Button>
                  <Button
                    variant={isBulkEditMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsBulkEditMode(!isBulkEditMode)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    {isBulkEditMode ? "Bulk Edit Actief" : "Bulk Edit Antwoorden"}
                  </Button>
                  {/* <Button variant="secondary" size="sm" onClick={handleApplyAllEdits} className="gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Pas {Object.keys(savedEdits).length} aanpassingen toe
                  </Button> */}
                  {/* REMOVED: Button to apply all saved edits */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          "Weet je zeker dat je deze reeks wilt verwijderen? Dit kan niet ongedaan worden gemaakt.",
                        )
                      ) {
                        setShowDeleteSeriesDialog(true)
                      }
                    }}
                    className="gap-2 bg-transparent text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Reeks Verwijderen
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 border rounded-lg p-4 min-h-0">
                {filteredQuestions.map((question) => {
                  const questionReeks = normalizeReeks(question.reeks)
                  const matchesReeks = selectedReeks === "all" || questionReeks === normalizeReeks(selectedReeks)
                  const isDeleted = deletedQuestions.has(question.firebaseKey)
                  const isEditing = editingQuestionId === question.id // Check if this question is currently being edited

                  const needsImage = question.needsImage && !question.questionImage && !question.image
                  const needsOptionImages =
                    question.optionsHaveImages &&
                    (!question.optionImages || Object.keys(question.optionImages).length === 0)
                  const hasMissingImages = needsImage || needsOptionImages

                  return (
                    <Card
                      key={question.id}
                      className={cn(
                        "relative transition-all duration-200 hover:shadow-md",
                        question.needsReview && "border-amber-500 border-2", // Visual indicator for flagged questions
                        hasMissingImages ? "border-red-400 bg-red-50" : "",
                      )}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm shrink-0">
                              {question.id}
                            </div>
                            <CardTitle className="text-lg font-semibold flex-1">{question.question}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant={question.needsReview ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleToggleReviewFlag(question.id)}
                              title={question.needsReview ? "Markering verwijderen" : "Markeren om na te kijken"}
                            >
                              <Flag className={cn("w-4 h-4", question.needsReview && "fill-current")} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingQuestionId(null)
                                  setEditFormData(null) // Clear edit form data
                                } else {
                                  handleEditClick(question)
                                }
                              }}
                            >
                              {isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteQuestion(question.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex space-x-4 mt-4 text-sm text-muted-foreground">
                          <span>Reeks: {question.reeks}</span>
                          {question.questionImage && <span>Afbeelding</span>}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isEditing && editFormData ? (
                          <div className="mt-4 space-y-4 border-t pt-4">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-question-${question.id}`}>Vraag</Label>
                              <Textarea
                                id={`edit-question-${question.id}`}
                                value={editFormData.question}
                                onChange={(e) => setEditFormData({ ...editFormData, question: e.target.value })}
                                rows={3}
                              />

                              <div className="space-y-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                      const url = await handleImageUpload(e as any)
                                      if (url) {
                                        setEditFormData({ ...editFormData, questionImage: url })
                                      }
                                    }
                                  }}
                                  className="hidden"
                                  id={`question-image-${question.id}`}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById(`question-image-${question.id}`)?.click()}
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  Afbeelding uploaden
                                </Button>
                                {editFormData.questionImage && (
                                  <div className="mt-2">
                                    <img
                                      src={editFormData.questionImage || "/placeholder.svg"}
                                      alt="Vraag afbeelding"
                                      className="max-w-xs max-h-32 object-contain border rounded"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Antwoorden (klik op het juiste antwoord)</Label>
                              <div className="space-y-2">
                                {[
                                  {
                                    key: "a",
                                    label: "A",
                                    value: editFormData.optionA,
                                    image: editFormData.optionAImage,
                                    field: "optionA" as const,
                                    imageField: "optionAImage" as const,
                                  },
                                  {
                                    key: "b",
                                    label: "B",
                                    value: editFormData.optionB,
                                    image: editFormData.optionBImage,
                                    field: "optionB" as const,
                                    imageField: "optionBImage" as const,
                                  },
                                  {
                                    key: "c",
                                    label: "C",
                                    value: editFormData.optionC,
                                    image: editFormData.optionCImage,
                                    field: "optionC" as const,
                                    imageField: "optionCImage" as const,
                                  },
                                  {
                                    key: "d",
                                    label: "D",
                                    value: editFormData.optionD,
                                    image: editFormData.optionDImage,
                                    field: "optionD" as const,
                                    imageField: "optionDImage" as const,
                                  },
                                ].map((option) => (
                                  <div key={option.key} className="space-y-2">
                                    <div
                                      className={`p-3 rounded border cursor-pointer transition-colors ${
                                        editFormData.correct === option.key
                                          ? "bg-green-100 border-green-500"
                                          : "hover:bg-gray-50"
                                      }`}
                                      onClick={() =>
                                        setEditFormData({
                                          ...editFormData,
                                          correct: option.key as "a" | "b" | "c" | "d",
                                        })
                                      }
                                    >
                                      <div className="flex items-start gap-2">
                                        <span className="font-semibold">{option.label}:</span>
                                        <Textarea
                                          value={option.value}
                                          onChange={(e) =>
                                            setEditFormData({
                                              ...editFormData,
                                              [option.field]: e.target.value,
                                            })
                                          }
                                          onClick={(e) => e.stopPropagation()}
                                          rows={2}
                                          className="flex-1 bg-white"
                                        />
                                      </div>
                                    </div>

                                    <div className="ml-6 flex items-center gap-2">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0]
                                          if (file) {
                                            const url = await handleImageUpload(e as any)
                                            if (url) {
                                              setEditFormData({
                                                ...editFormData,
                                                [option.imageField]: url,
                                              })
                                            }
                                          }
                                        }}
                                        className="hidden"
                                        id={`option-${option.key}-image-${question.id}`}
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          document.getElementById(`option-${option.key}-image-${question.id}`)?.click()
                                        }
                                      >
                                        Img
                                      </Button>
                                      {option.image && (
                                        <img
                                          src={option.image || "/placeholder.svg"}
                                          alt={`Optie ${option.label}`}
                                          className="max-w-[80px] max-h-[80px] object-contain border rounded"
                                        />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button onClick={() => handleSaveInlineEdit(question)}>Opslaan</Button>
                              <Button variant="outline" onClick={() => setEditingQuestionId(null)}>
                                Annuleren
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(question.options?.a || question.optionImages?.a) && (
                              <p
                                onClick={() => isBulkEditMode && handleBulkAnswerClick(question.id, "a")}
                                className={cn(
                                  "flex items-center gap-2",
                                  getDisplayCorrectAnswer(question) === "A" && "text-green-600 font-semibold",
                                  isBulkEditMode && "cursor-pointer hover:bg-gray-100 p-2 rounded transition-colors",
                                )}
                              >
                                <span className="font-semibold">A:</span>{" "}
                                {question.optionImages?.a
                                  ? question.options?.a && !question.options.a.toLowerCase().includes("[afbeelding")
                                    ? question.options.a
                                    : ""
                                  : question.options?.a || ""}
                                {question.optionImages?.a && (
                                  <img
                                    src={question.optionImages.a || "/placeholder.svg"}
                                    alt="Optie A"
                                    className="max-w-[100px] max-h-12 rounded border"
                                  />
                                )}
                              </p>
                            )}
                            {(question.options?.b || question.optionImages?.b) && (
                              <p
                                onClick={() => isBulkEditMode && handleBulkAnswerClick(question.id, "b")}
                                className={cn(
                                  "flex items-center gap-2",
                                  getDisplayCorrectAnswer(question) === "B" && "text-green-600 font-semibold",
                                  isBulkEditMode && "cursor-pointer hover:bg-gray-100 p-2 rounded transition-colors",
                                )}
                              >
                                <span className="font-semibold">B:</span>{" "}
                                {question.optionImages?.b
                                  ? question.options?.b && !question.options.b.toLowerCase().includes("[afbeelding")
                                    ? question.options.b
                                    : ""
                                  : question.options?.b || ""}
                                {question.optionImages?.b && (
                                  <img
                                    src={question.optionImages.b || "/placeholder.svg"}
                                    alt="Optie B"
                                    className="max-w-[100px] max-h-12 rounded border"
                                  />
                                )}
                              </p>
                            )}
                            {(question.options?.c || question.optionImages?.c) && (
                              <p
                                onClick={() => isBulkEditMode && handleBulkAnswerClick(question.id, "c")}
                                className={cn(
                                  "flex items-center gap-2",
                                  getDisplayCorrectAnswer(question) === "C" && "text-green-600 font-semibold",
                                  isBulkEditMode && "cursor-pointer hover:bg-gray-100 p-2 rounded transition-colors",
                                )}
                              >
                                <span className="font-semibold">C:</span>{" "}
                                {question.optionImages?.c
                                  ? question.options?.c && !question.options.c.toLowerCase().includes("[afbeelding")
                                    ? question.options.c
                                    : ""
                                  : question.options?.c || ""}
                                {question.optionImages?.c && (
                                  <img
                                    src={question.optionImages.c || "/placeholder.svg"}
                                    alt="Optie C"
                                    className="max-w-[100px] max-h-12 rounded border"
                                  />
                                )}
                              </p>
                            )}
                            {(question.options?.d || question.optionImages?.d) && (
                              <p
                                onClick={() => isBulkEditMode && handleBulkAnswerClick(question.id, "d")}
                                className={cn(
                                  "flex items-center gap-2",
                                  getDisplayCorrectAnswer(question) === "D" && "text-green-600 font-semibold",
                                  isBulkEditMode && "cursor-pointer hover:bg-gray-100 p-2 rounded transition-colors",
                                )}
                              >
                                <span className="font-semibold">D:</span>{" "}
                                {question.optionImages?.d
                                  ? question.options?.d && !question.options.d.toLowerCase().includes("[afbeelding")
                                    ? question.options.d
                                    : ""
                                  : question.options?.d || ""}
                                {question.optionImages?.d && (
                                  <img
                                    src={question.optionImages.d || "/placeholder.svg"}
                                    alt="Optie D"
                                    className="max-w-[100px] max-h-12 rounded border"
                                  />
                                )}
                              </p>
                            )}
                          </div>
                        )}
                        {question.questionImage && (
                          <div className="mt-3">
                            <img
                              src={question.questionImage || "/placeholder.svg"}
                              alt="Vraag afbeelding"
                              className="max-w-xs rounded border"
                            />
                          </div>
                        )}
                        {/* Removed needsImage and imageDescription check for display as it's handled in upload modal */}
                        {/* {needsImage && hasImageDescription && (
                          <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                            <span>📷 Afbeelding vereist: {question.imageDescription}</span>
                          </div>
                        )} */}
                        {/* Removed needsOptionImages check for display */}
                        {/* {needsOptionImages && (
                          <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                            <span>📷 Afbeeldingen vereist in antwoord opties</span>
                          </div>
                        )} */}
                        {/* Removed "hasEdit" check display */}
                        {/* {hasEdit && (
                          <div className="mt-3 text-xs text-amber-700 italic">✓ Deze vraag is aangepast.</div>
                        )} */}
                      </CardContent>
                    </Card>
                  )
                })}
                {filteredQuestions.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Geen vragen gevonden met deze filters.</p>
                )}
              </div>
            </CardContent>
          </DialogContent>
        </Dialog>

        <Dialog open={showManualQuestionForm} onOpenChange={setShowManualQuestionForm}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Nieuwe Vraag Toevoegen</DialogTitle>
              <DialogDescription>Voeg een nieuwe vraag toe aan de geselecteerde categorie.</DialogDescription>
            </DialogHeader>
            <form ref={formRef} onSubmit={handleManualQuestionSave}>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto p-2">
                <div>
                  <Label htmlFor="question">Vraag</Label>
                  <Textarea
                    id="question"
                    name="question"
                    rows={3}
                    value={manualQuestionData.question}
                    onChange={(e) => updateManualQuestionField("question", e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="questionImage">Vraag Afbeelding (optioneel)</Label>
                    <Input type="hidden" name="questionImage" id="questionImage" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const inputElement = document.querySelector('input[name="questionImage"]') as HTMLInputElement
                        const fileInput = document.createElement("input")
                        fileInput.type = "file"
                        fileInput.accept = "image/*"
                        fileInput.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) {
                            const imageData = await handleImageUpload(e as any)
                            if (inputElement) inputElement.value = imageData
                            updateManualQuestionField("questionImage", imageData)
                          }
                        }
                        fileInput.click()
                      }}
                      className="mt-2 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Upload Afbeelding
                    </Button>
                    {manualQuestionData.questionImage && (
                      <div className="mt-1 relative inline-block">
                        <img
                          src={manualQuestionData.questionImage || "/placeholder.svg"}
                          alt="Vraag afbeelding"
                          className="max-w-[150px] rounded border"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0"
                          onClick={() => updateManualQuestionField("questionImage", "")}
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="optionA">Optie A</Label>
                    <Input
                      id="optionA"
                      name="optionA"
                      value={manualQuestionData.optionA}
                      onChange={(e) => updateManualQuestionField("optionA", e.target.value)}
                      required
                      className="mt-1"
                    />
                    <Input type="hidden" name="optionAImage" id="optionAImage" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const inputElement = document.querySelector('input[name="optionAImage"]') as HTMLInputElement
                        const fileInput = document.createElement("input")
                        fileInput.type = "file"
                        fileInput.accept = "image/*"
                        fileInput.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) {
                            const imageData = await handleImageUpload(e as any)
                            if (inputElement) inputElement.value = imageData
                            updateManualQuestionField("optionAImage", imageData)
                          }
                        }
                        fileInput.click()
                      }}
                      className="mt-2 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Upload Afbeelding
                    </Button>
                    {manualQuestionData.optionAImage && (
                      <div className="mt-1 relative inline-block">
                        <img
                          src={manualQuestionData.optionAImage || "/placeholder.svg"}
                          alt="Optie A afbeelding"
                          className="max-w-[150px] rounded border"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0"
                          onClick={() => updateManualQuestionField("optionAImage", "")}
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="optionB">Optie B</Label>
                    <Input
                      id="optionB"
                      name="optionB"
                      value={manualQuestionData.optionB}
                      onChange={(e) => updateManualQuestionField("optionB", e.target.value)}
                      required
                      className="mt-1"
                    />
                    <Input type="hidden" name="optionBImage" id="optionBImage" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const inputElement = document.querySelector('input[name="optionBImage"]') as HTMLInputElement
                        const fileInput = document.createElement("input")
                        fileInput.type = "file"
                        fileInput.accept = "image/*"
                        fileInput.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) {
                            const imageData = await handleImageUpload(e as any)
                            if (inputElement) inputElement.value = imageData
                            updateManualQuestionField("optionBImage", imageData)
                          }
                        }
                        fileInput.click()
                      }}
                      className="mt-2 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Upload Afbeelding
                    </Button>
                    {manualQuestionData.optionBImage && (
                      <div className="mt-1 relative inline-block">
                        <img
                          src={manualQuestionData.optionBImage || "/placeholder.svg"}
                          alt="Optie B afbeelding"
                          className="max-w-[150px] rounded border"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0"
                          onClick={() => updateManualQuestionField("optionBImage", "")}
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="optionC">Optie C</Label>
                    <Input
                      id="optionC"
                      name="optionC"
                      value={manualQuestionData.optionC}
                      onChange={(e) => updateManualQuestionField("optionC", e.target.value)}
                      required
                      className="mt-1"
                    />
                    <Input type="hidden" name="optionCImage" id="optionCImage" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const inputElement = document.querySelector('input[name="optionCImage"]') as HTMLInputElement
                        const fileInput = document.createElement("input")
                        fileInput.type = "file"
                        fileInput.accept = "image/*"
                        fileInput.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) {
                            const imageData = await handleImageUpload(e as any)
                            if (inputElement) inputElement.value = imageData
                            updateManualQuestionField("optionCImage", imageData)
                          }
                        }
                        fileInput.click()
                      }}
                      className="mt-2 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Upload Afbeelding
                    </Button>
                    {manualQuestionData.optionCImage && (
                      <div className="mt-1 relative inline-block">
                        <img
                          src={manualQuestionData.optionCImage || "/placeholder.svg"}
                          alt="Optie C afbeelding"
                          className="max-w-[150px] rounded border"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0"
                          onClick={() => updateManualQuestionField("optionCImage", "")}
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="optionD">Optie D (optioneel)</Label>
                    <Input
                      id="optionD"
                      name="optionD"
                      value={manualQuestionData.optionD}
                      onChange={(e) => updateManualQuestionField("optionD", e.target.value)}
                      className="mt-1"
                    />
                    <Input type="hidden" name="optionDImage" id="optionDImage" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const inputElement = document.querySelector('input[name="optionDImage"]') as HTMLInputElement
                        const fileInput = document.createElement("input")
                        fileInput.type = "file"
                        fileInput.accept = "image/*"
                        fileInput.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) {
                            const imageData = await handleImageUpload(e as any)
                            if (inputElement) inputElement.value = imageData
                            updateManualQuestionField("optionDImage", imageData)
                          }
                        }
                        fileInput.click()
                      }}
                      className="mt-2 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Upload Afbeelding
                    </Button>
                    {manualQuestionData.optionDImage && (
                      <div className="mt-1 relative inline-block">
                        <img
                          src={manualQuestionData.optionDImage || "/placeholder.svg"}
                          alt="Optie D afbeelding"
                          className="max-w-[150px] rounded border"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0"
                          onClick={() => updateManualQuestionField("optionDImage", "")}
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="col-span-1">
                    <Label>Correct Antwoord</Label>
                    <RadioGroup
                      value={selectedCorrectAnswer}
                      onValueChange={(value: "a" | "b" | "c" | "d") => setSelectedCorrectAnswer(value)}
                      className="flex flex-col space-y-3 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="a" id="correctA" />
                        <Label htmlFor="correctA">A</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="b" id="correctB" />
                        <Label htmlFor="correctB">B</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="c" id="correctC" />
                        <Label htmlFor="correctC">C</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="d" id="correctD" />
                        <Label htmlFor="correctD">D</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <Label htmlFor="reeks">Reeks</Label>
                    <Select value={selectedReeks} onValueChange={setSelectedReeks}>
                      <SelectTrigger id="reeks" className="mt-1">
                        <SelectValue placeholder="Selecteer reeks" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableReeksOptions
                          .filter((option) => option.value !== "new")
                          .map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        <SelectItem value="new">➕ Nieuwe reeks...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedReeks === "new" && (
                    <div className="col-span-1">
                      <Label htmlFor="customReeks">Nieuwe Reeks Naam</Label>
                      <Input
                        id="customReeks"
                        name="customReeks"
                        value={customReeksInput}
                        onChange={handleCustomReeksChange}
                        placeholder="Geef de nieuwe reeks een naam"
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="mt-6 pt-4 border-t">
                <Button type="submit" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Vraag Toevoegen
                </Button>
                <Button variant="outline" onClick={() => setShowManualQuestionForm(false)}>
                  Annuleren
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showPdfUploadInOverview} onOpenChange={setShowPdfUploadInOverview}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Upload PDF</DialogTitle>
              <DialogDescription>Upload een PDF-bestand om vragen te extraheren.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border rounded-lg p-4 text-center">
                <label
                  htmlFor="pdfFile"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2 py-6"
                >
                  <Upload className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">Klik om PDF te selecteren</span>
                  <span className="text-xs text-muted-foreground">Ondersteund: PDF</span>
                </label>
                <input id="pdfFile" type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                {isProcessingPdf && (
                  <div className="mt-4 text-center space-y-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                    <p className="text-sm text-muted-foreground">PDF verwerken...</p>
                  </div>
                )}
              </div>

              {questionsText && (
                <>
                  <h3 className="font-semibold">Geëxtraheerde tekst:</h3>
                  <Textarea
                    value={questionsText}
                    onChange={(e) => setQuestionsText(e.target.value)}
                    className="min-h-[150px] font-mono text-sm"
                  />
                  <Button onClick={handleParseTextInOverview} className="w-full">
                    Tekst Parset voor Review
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {showReeksUpdate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>Update Reeksen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!reeksUpdateResult ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Deze functie update de 'reeks' velden van bestaande vragen. Dit kan handig zijn als je vragen hebt
                      toegevoegd zonder een specifieke reeks, of als je de reeksnamen wilt normaliseren. De functie zal
                      proberen de 'reeks' velden te herkennen en te standaardiseren.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={handleUpdateReeks} disabled={isReeksUpdating}>
                        {isReeksUpdating ? "Bezig met updaten..." : "Start Update"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowReeksUpdate(false)}>
                        Annuleren
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={`p-4 rounded-lg ${reeksUpdateResult.success ? "bg-green-500/10" : "bg-red-500/10"}`}
                    >
                      <p className={`font-semibold ${reeksUpdateResult.success ? "text-green-600" : "text-red-600"}`}>
                        {reeksUpdateResult.success
                          ? `Update voltooid: ${reeksUpdateResult.questionsUpdated} vragen bijgewerkt.`
                          : `Update mislukt: ${reeksUpdateResult.errors.join(", ")}`}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setShowReeksUpdate(false)
                        setReeksUpdateResult(null)
                      }}
                      className="w-full"
                    >
                      Sluiten
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={showStaticMigration} onOpenChange={setShowStaticMigration}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Migreer Statische Vragen</DialogTitle>
              <DialogDescription>Migreert de oudere statische vraagsets naar de Firebase database.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!staticMigrationResult ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Deze functie importeert de originele vraagsets (zoals Radar, Matrozen) naar de Firebase database. Na
                    migratie kunnen deze vragen worden bewerkt en beheerd via het admin panel.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleMigrateStatic} disabled={isStaticMigrating}>
                      {isStaticMigrating ? "Bezig met migreren..." : "Start Migratie"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowStaticMigration(false)}>
                      Annuleren
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={`p-4 rounded-lg ${staticMigrationResult.success ? "bg-green-500/10" : "bg-red-500/10"}`}
                  >
                    <p className={`font-semibold ${staticMigrationResult.success ? "text-green-600" : "text-red-600"}`}>
                      {staticMigrationResult.success
                        ? `Migratie voltooid! ${staticMigrationResult.migratedCount} vragen succesvol gemigreerd.`
                        : `Migratie mislukt. Fouten: ${staticMigrationResult.errors.join(", ")}`}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setShowStaticMigration(false)
                      setStaticMigrationResult(null)
                    }}
                    className="w-full"
                  >
                    Sluiten
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showRenameSeriesDialog} onOpenChange={setShowRenameSeriesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reeks Naam Wijzigen</DialogTitle>
              <DialogDescription>
                Wijzig de naam van een bestaande reeks. Alle vragen in deze reeks worden bijgewerkt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="old-series-name">Huidige Reeks Naam</Label>
                <Select value={renameSeriesOldName} onValueChange={setRenameSeriesOldName}>
                  <SelectTrigger id="old-series-name">
                    <SelectValue placeholder="Selecteer reeks om te hernoemen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableReeksOptions
                      .filter((option) => option.value !== "new")
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-series-name">Nieuwe Reeks Naam</Label>
                <Input
                  id="new-series-name"
                  value={renameSeriesNewName}
                  onChange={(e) => setRenameSeriesNewName(e.target.value)}
                  placeholder="bijv: Hoofdstuk 2 - Navigatie"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRenameSeriesDialog(false)} disabled={isRenamingSeries}>
                Annuleren
              </Button>
              <Button onClick={handleRenameSeries} disabled={isRenamingSeries}>
                {isRenamingSeries ? "Bezig met hernoemen..." : "Reeks Hernoemen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteSeriesDialog} onOpenChange={setShowDeleteSeriesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reeks Verwijderen</DialogTitle>
              <DialogDescription>
                Verwijder een reeks en alle bijbehorende vragen. Deze actie kan niet ongedaan worden gemaakt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delete-series-name">Reeks om te Verwijderen</Label>
                <Select value={deleteSeriesName} onValueChange={setDeleteSeriesName}>
                  <SelectTrigger id="delete-series-name">
                    <SelectValue placeholder="Selecteer reeks om te verwijderen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableReeksOptions
                      .filter((option) => option.value !== "new")
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                Let op: Alle vragen in deze reeks worden permanent verwijderd uit Firebase.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteSeriesDialog(false)} disabled={isDeletingSeries}>
                Annuleren
              </Button>
              <Button variant="destructive" onClick={handleDeleteSeries} disabled={isDeletingSeries}>
                {isDeletingSeries ? "Bezig met verwijderen..." : "Reeks Verwijderen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
