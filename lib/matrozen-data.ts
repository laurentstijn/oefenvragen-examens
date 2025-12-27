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

export const matrozenQuestionSets: QuestionSet[] = [
  {
    id: "1",
    name: "Reeks 1",
    description: "Matrozen - Reeks 1",
    questions: [
      q(
        1,
        "Elk schip heeft een minimum aan reddingsmiddelen aan boord. Deze zijn:",
        "reddingsboeien, reddingsgordels en een bijboot",
        "enkel reddingsboeien",
        "reddingsboeien en een brandbijl met handschoenen",
        "een bijboot uitgerust met wrik- en roeiriemen",
        "a",
      ),
      q(
        2,
        "Elk schip heeft een minimum aan reddingsmiddelen aan boord. Deze zijn:",
        "reddingsboeien, reddingsgordels en een bijboot",
        "enkel reddingsboeien",
        "reddingsboeien en een brandbijl met handschoenen",
        "een bijboot uitgerust met wrik- en roeiriemen",
        "a",
      ),
    ],
  },
]

export const questionSets = matrozenQuestionSets
