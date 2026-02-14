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

import { logger } from "@/lib/logger"

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

    if (!text || text.length === 0) {
      throw new Error("Geen tekst gevonden in de PDF")
    }

    return text
  } catch (error) {
    logger.error("Error extracting PDF text:", error)
    throw new Error("Kon geen tekst uit de PDF extraheren: " + (error as Error).message)
  }
}

export { extractTextFromPDF as extractText }

/**
 * Parse questions from extracted text and return with series name
 */
export function parseQuestionsWithSeries(text: string): { seriesName: string; questions: ParsedQuestion[] } {


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

    }
  }

  logger.info("Parsing questions from PDF", { textLength: text.length })
  const questions = parseQuestionsFromText(text)
  logger.info("Parsed questions from PDF", { 
    totalQuestions: questions.length, 
    withAnswers: questions.filter((q) => q.correctAnswer).length 
  })
  return { seriesName, questions }
}

/**
 * Parse questions from extracted text
 */
export function parseQuestionsFromText(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []

  // Split by question numbers while preserving the number
  // Use (?:^|\n) to match start of string OR newline
  const questionBlocks = text.split(/(?:^|\n)(\d+)\.\s+/)



  // First element is text before first question (header), then pairs of (number, content)
  for (let i = 1; i < questionBlocks.length; i += 2) {
    const numberStr = questionBlocks[i]
    const content = questionBlocks[i + 1]



    if (!content) {

      continue
    }

    const number = Number.parseInt(numberStr)

    if (isNaN(number)) {

      continue
    }

    const correctAnswerMatch = content.match(/Juist\s+antwoord\s*[=:]\s*([a-f])/i)
    const questionContent = content
    let correctAnswer: "A" | "B" | "C" | "D" | "E" | "F" | undefined = undefined

    if (correctAnswerMatch) {
      correctAnswer = correctAnswerMatch[1].toUpperCase() as "A" | "B" | "C" | "D" | "E" | "F"

    }

    const optionsStartMatch = questionContent.match(/\n[a-f][).]/)
    if (!optionsStartMatch || optionsStartMatch.index === undefined) {

      continue
    }

    // Detect which separator is used: ) or .
    const optionSeparator = optionsStartMatch[0].includes(")") ? ")" : "\\."

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

    } else {
      // Try to match [AFBEELDING] format (without description)
      imageMatch = questionText.match(/\[AFBEELDING\]/i)
      if (imageMatch) {
        needsImage = true
        imageDescription = "afbeelding vereist"
        cleanedQuestionText = questionText.replace(/\[AFBEELDING\]/gi, "").trim()

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

      // Build pattern: a) or a. ... until next option letter or "Juist antwoord" or end
      let pattern = `${currentLabel}${optionSeparator}\\s*([\\s\\S]+?)(?=`
      if (nextLabel) {
        pattern += `\\n${nextLabel}${optionSeparator}|`
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

        } else {
          // Try format without description
          optionImageMatch = optionText.match(/\[AFBEELDING\]/i)
          if (optionImageMatch) {
            optionsHaveImages = true
            const imageDesc = `afbeelding voor optie ${currentLabel.toUpperCase()}`
            optionImages[currentLabel.toUpperCase()] = imageDesc
            optionText = `[Afbeelding: ${imageDesc}]`

          }
        }

        // Don't skip empty options if they have image descriptions
        if (optionText && optionText.length > 0) {
          options[currentLabel.toUpperCase()] = optionText
        }
      }
    }

    if (!options["A"] || !options["B"]) {

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

  }



  return questions
}
