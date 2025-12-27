export interface ParsedQuestion {
  number: number
  text: string
  optionA: string
  optionB: string
  optionC: string
  optionD?: string // Optional 4th option
  optionE?: string // Optional 5th option
  optionF?: string // Optional 6th option
  correctAnswer?: "A" | "B" | "C" | "D" | "E" | "F" // Extended to support up to 6 options
  imageUrl?: string
  needsImage?: boolean // Field to track if question needs image upload
  imageDescription?: string // Description from [AFBEELDING: ...] tag
  optionAImage?: string // Image description for option A
  optionBImage?: string
  optionCImage?: string
  optionDImage?: string
  optionEImage?: string
  optionFImage?: string
  optionsHaveImages?: boolean // Flag to indicate options contain images instead of text
}

export interface ParsedQuestionSet {
  name: string
  questions: ParsedQuestion[]
}

/**
 * Split questions into sets based on count
 */
export function splitIntoSets(questions: ParsedQuestion[], questionsPerSet = 50): ParsedQuestionSet[] {
  const sets: ParsedQuestionSet[] = []

  for (let i = 0; i < questions.length; i += questionsPerSet) {
    const setQuestions = questions.slice(i, i + questionsPerSet)
    sets.push({
      name: `Reeks ${Math.floor(i / questionsPerSet) + 1}`,
      questions: setQuestions,
    })
  }

  return sets
}

/**
 * Extract text from PDF using unpdf
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const { extractText } = await import("unpdf")

    const arrayBuffer = await file.arrayBuffer()
    const result = await extractText(new Uint8Array(arrayBuffer))

    console.log("[v0] Unpdf result:", typeof result, result)

    let text = ""

    // Handle different possible return formats from unpdf
    if (typeof result === "string") {
      text = result
    } else if (result && typeof result === "object") {
      // If result has a 'text' property that is an ARRAY (one string per page)
      if ("text" in result && Array.isArray(result.text)) {
        text = result.text.join("\n")
      }
      // If result has a 'text' property that is a string
      else if ("text" in result && typeof result.text === "string") {
        text = result.text
      }
      // If result has a 'pages' array with text content
      else if ("pages" in result && Array.isArray(result.pages)) {
        text = result.pages
          .map((page: any) => {
            if (typeof page === "string") return page
            if (page && typeof page === "object" && "text" in page) return page.text
            return ""
          })
          .join("\n")
      }
      // If result is array-like (pages directly)
      else if (Array.isArray(result)) {
        text = result
          .map((page: any) => {
            if (typeof page === "string") return page
            if (page && typeof page === "object" && "text" in page) return page.text
            return ""
          })
          .join("\n")
      }
    }

    console.log("[v0] Extracted text length:", text?.length || 0)
    console.log("[v0] First 500 chars:", text?.substring(0, 500))

    if (!text || text.length === 0) {
      throw new Error("Geen tekst gevonden in de PDF")
    }

    return text
  } catch (error) {
    console.error("[v0] Error extracting PDF text:", error)
    throw new Error("Kon geen tekst uit de PDF extraheren: " + (error as Error).message)
  }
}

export { extractTextFromPDF as extractText }

/**
 * Parse questions from extracted text and return with series name
 */
export function parseQuestionsWithSeries(text: string): { seriesName: string; questions: ParsedQuestion[] } {
  console.log("[v0] Starting to parse questions from text")

  const headerMatch = text.match(/^(.+?)(?=\n\d+\.)/s)
  let seriesName = "Reeks 1" // Default fallback

  if (headerMatch) {
    const potentialHeader = headerMatch[1].trim()
    // Clean up the header - take first meaningful line that looks like a title
    const lines = potentialHeader.split("\n").filter((line) => line.trim().length > 0)
    if (lines.length > 0) {
      // Look for lines that look like headers (contain "Hoofdstuk", "Chapter", or are short capitalized text)
      const headerLine =
        lines.find(
          (line) =>
            line.match(/hoofdstuk|chapter|deel|part/i) || (line.length < 50 && line[0] === line[0].toUpperCase()),
        ) || lines[lines.length - 1]

      seriesName = headerLine.trim()
      console.log(`[v0] Extracted series name: "${seriesName}"`)
    }
  }

  const questions = parseQuestionsFromText(text)

  return {
    seriesName,
    questions,
  }
}

/**
 * Parse questions from extracted text
 */
export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []

  // Split by question numbers while preserving the number
  // Use (?:^|\n) to match start of string OR newline
  const questionBlocks = text.split(/(?:^|\n)(\d+)\.\s+/)

  console.log("[v0] Found question blocks:", questionBlocks.length)

  // First element is text before first question (header), then pairs of (number, content)
  for (let i = 1; i < questionBlocks.length; i += 2) {
    const numberStr = questionBlocks[i]
    const content = questionBlocks[i + 1]

    console.log(`[v0] Processing block ${i}: number="${numberStr}", content length=${content?.length || 0}`)

    if (!content) {
      console.log(`[v0] No content for block ${i}, skipping`)
      continue
    }

    const number = Number.parseInt(numberStr)

    if (isNaN(number)) {
      console.log(`[v0] Skipping non-numeric block at index ${i}: ${numberStr}`)
      continue
    }

    const correctAnswerMatch = content.match(/Juist\s+antwoord\s*[=:]\s*([a-f])/i)
    const questionContent = content
    let correctAnswer: "A" | "B" | "C" | "D" | "E" | "F" | undefined = undefined

    if (correctAnswerMatch) {
      correctAnswer = correctAnswerMatch[1].toUpperCase() as "A" | "B" | "C" | "D" | "E" | "F"
      console.log(`[v0] Detected correct answer for question ${number}: ${correctAnswer}`)
    }

    const optionsStartMatch = questionContent.match(/\n[a-f]\)/)
    if (!optionsStartMatch || optionsStartMatch.index === undefined) {
      console.log(`[v0] No options found for question ${number}, skipping`)
      continue
    }

    const optionsStartIndex = optionsStartMatch.index
    const questionText = questionContent.substring(0, optionsStartIndex).trim()

    let needsImage = false
    let imageDescription: string | undefined
    let cleanedQuestionText = questionText

    // Try to match [AFBEELDING: description] format first
    let imageMatch = questionText.match(/\[AFBEELDING:\s*([^\]]+)\]/i)
    if (imageMatch) {
      needsImage = true
      imageDescription = imageMatch[1].trim()
      cleanedQuestionText = questionText.replace(/\[AFBEELDING:\s*[^\]]+\]/gi, "").trim()
      console.log(`[v0] Question ${number} needs image: ${imageDescription}`)
    } else {
      // Try to match [AFBEELDING] format (without description)
      imageMatch = questionText.match(/\[AFBEELDING\]/i)
      if (imageMatch) {
        needsImage = true
        imageDescription = "afbeelding vereist"
        cleanedQuestionText = questionText.replace(/\[AFBEELDING\]/gi, "").trim()
        console.log(`[v0] Question ${number} needs image (no description provided)`)
      }
    }

    const optionsSection = questionContent.substring(optionsStartIndex)
    const options: { [key: string]: string } = {}
    const optionImages: { [key: string]: string } = {}
    let optionsHaveImages = false

    const optionLabels = ["a", "b", "c", "d", "e", "f"]

    for (let j = 0; j < optionLabels.length; j++) {
      const currentLabel = optionLabels[j]
      const nextLabel = j < optionLabels.length - 1 ? optionLabels[j + 1] : null

      // Build pattern: a) ... until next option letter or "Juist antwoord" or end
      let pattern = `${currentLabel}\\)\\s*([\\s\\S]+?)(?=`
      if (nextLabel) {
        pattern += `\\n${nextLabel}\\)|`
      }
      pattern += `Juist\\s+antwoord|$)`

      const regex = new RegExp(pattern, "i")
      const match = optionsSection.match(regex)

      if (match) {
        let optionText = match[1].trim()

        // Try format with description first
        let optionImageMatch = optionText.match(/\[AFBEELDING:\s*([^\]]+)\]/is)
        if (optionImageMatch) {
          optionsHaveImages = true
          const imageDesc = optionImageMatch[1].replace(/\n/g, " ").trim()
          optionImages[currentLabel.toUpperCase()] = imageDesc
          optionText = `[Afbeelding: ${imageDesc}]`
          console.log(`[v0] Question ${number} option ${currentLabel} has image: ${imageDesc}`)
        } else {
          // Try format without description
          optionImageMatch = optionText.match(/\[AFBEELDING\]/i)
          if (optionImageMatch) {
            optionsHaveImages = true
            const imageDesc = `afbeelding voor optie ${currentLabel.toUpperCase()}`
            optionImages[currentLabel.toUpperCase()] = imageDesc
            optionText = `[Afbeelding: ${imageDesc}]`
            console.log(`[v0] Question ${number} option ${currentLabel} has image (no description)`)
          }
        }

        // Don't skip empty options if they have image descriptions
        if (optionText && optionText.length > 0) {
          options[currentLabel.toUpperCase()] = optionText
        }
      }
    }

    if (!options["A"] || !options["B"]) {
      console.log(`[v0] Question ${number} doesn't have minimum 2 options, skipping`)
      console.log(`[v0] Options found:`, Object.keys(options))
      continue
    }

    const question: ParsedQuestion = {
      number,
      text: cleanedQuestionText,
      optionA: options["A"],
      optionB: options["B"],
      optionC: options["C"] || "",
      correctAnswer,
      ...(needsImage && { needsImage: true, imageDescription }),
      ...(optionsHaveImages && {
        optionsHaveImages: true,
        ...(optionImages["A"] && { optionAImage: optionImages["A"] }),
        ...(optionImages["B"] && { optionBImage: optionImages["B"] }),
        ...(optionImages["C"] && { optionCImage: optionImages["C"] }),
        ...(optionImages["D"] && { optionDImage: optionImages["D"] }),
        ...(optionImages["E"] && { optionEImage: optionImages["E"] }),
        ...(optionImages["F"] && { optionFImage: optionImages["F"] }),
      }),
    }

    if (options["D"] && options["D"].length > 0) question.optionD = options["D"]
    if (options["E"] && options["E"].length > 0) question.optionE = options["E"]
    if (options["F"] && options["F"].length > 0) question.optionF = options["F"]

    questions.push(question)
    console.log(
      `[v0] Parsed question ${number} with ${Object.keys(options).length} options${needsImage ? " (needs image)" : ""}${optionsHaveImages ? " (options have images)" : ""}`,
    )
  }

  console.log("[v0] Total parsed questions:", questions.length)
  const questionsWithAnswer = questions.filter((q) => q.correctAnswer).length
  const questionsNeedingImages = questions.filter((q) => q.needsImage).length
  const questionsWithImageOptions = questions.filter((q) => q.optionsHaveImages).length
  console.log(`[v0] Detected correct answers: ${questionsWithAnswer}/${questions.length}`)
  console.log(`[v0] Questions needing images: ${questionsNeedingImages}`)
  console.log(`[v0] Questions with image options: ${questionsWithImageOptions}`)

  return questions
}
