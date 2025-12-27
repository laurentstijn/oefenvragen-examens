export function generateCategoryDataFile(categoryId: string, categoryName: string): string {
  return `// Generated data file for ${categoryName}
import type { Question, QuestionSet } from "./radar-data"

const q = (
  id: number,
  question: string,
  a: string,
  b: string,
  c: string,
  d?: string,
  correct?: "a" | "b" | "c" | "d",
): Question => ({
  id,
  question,
  options: {
    a,
    b,
    c,
    ...(d && { d }),
  },
  correct: correct || "a",
})

const qWithImage = (
  id: number,
  question: string,
  a: string,
  b: string,
  c: string,
  d: string | undefined,
  correct: "a" | "b" | "c" | "d",
  image: string,
): Question => ({
  id,
  question,
  options: {
    a,
    b,
    c,
    ...(d && { d }),
  },
  correct,
  hasImage: true,
  image,
})

const qWithImageAnswers = (
  id: number,
  question: string,
  correct: "a" | "b" | "c" | "d",
  optionImages: {
    a?: string
    b?: string
    c?: string
    d?: string
  },
  questionImage?: string,
): Question => ({
  id,
  question,
  options: {
    a: "",
    b: "",
    c: "",
    d: "",
  },
  optionImages,
  correct,
  hasImage: !!questionImage,
  image: questionImage,
})

export const ${categoryId}QuestionSets: QuestionSet[] = [
  {
    id: "1",
    name: "Reeks 1",
    description: "${categoryName} - Reeks 1",
    questions: [],
  },
]

export const questionSets = ${categoryId}QuestionSets
`
}
