import { ref, get, update, remove } from "firebase/database"
import { db } from "../lib/firebase"

async function migrateQuestionEdits() {
  console.log("[Migration] Starting questionEdits migration...")

  try {
    // Get all question edits
    const editsRef = ref(db, "questionEdits")
    const editsSnapshot = await get(editsRef)

    if (!editsSnapshot.exists()) {
      console.log("[Migration] No questionEdits found to migrate")
      return
    }

    const edits = editsSnapshot.val()
    const editKeys = Object.keys(edits)
    console.log(`[Migration] Found ${editKeys.length} edits to migrate`)

    let successCount = 0
    let errorCount = 0

    // Apply each edit to the questions node
    for (const questionKey of editKeys) {
      const edit = edits[questionKey]

      try {
        // Extract category from question key (e.g., "radar-1" -> "radar")
        const parts = questionKey.split("-")
        const category = parts.slice(0, -1).join("-") // Handle multi-part category names
        const questionNumber = parts[parts.length - 1]

        // Build update object
        const updates: any = {}
        if (edit.correct) {
          updates.correctAnswer = edit.correct.toUpperCase()
        }
        if (edit.question) {
          updates.question = edit.question
        }
        if (edit.options) {
          updates.options = edit.options
        }

        // Update the question in questions node
        const questionRef = ref(db, `questions/${category}/${questionKey}`)
        await update(questionRef, updates)

        console.log(`[Migration] ✓ Applied edit for ${questionKey}: ${edit.correct}`)
        successCount++
      } catch (error) {
        console.error(`[Migration] ✗ Failed to apply edit for ${questionKey}:`, error)
        errorCount++
      }
    }

    console.log(`[Migration] Migration complete: ${successCount} success, ${errorCount} errors`)

    // Remove questionEdits node after successful migration
    if (errorCount === 0) {
      console.log("[Migration] All edits migrated successfully. Removing questionEdits node...")
      await remove(editsRef)
      console.log("[Migration] questionEdits node removed")
    } else {
      console.log(
        "[Migration] Some errors occurred. questionEdits node kept for safety. Please review errors and re-run.",
      )
    }

    return { successCount, errorCount }
  } catch (error) {
    console.error("[Migration] Migration failed:", error)
    throw error
  }
}

// Run migration
migrateQuestionEdits()
  .then((result) => {
    if (result) {
      console.log(`[Migration] Final result: ${result.successCount} migrated, ${result.errorCount} failed`)
    }
    process.exit(0)
  })
  .catch((error) => {
    console.error("[Migration] Fatal error:", error)
    process.exit(1)
  })
