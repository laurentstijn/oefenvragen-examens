"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, RotateCcw, Shuffle, ChevronLeft, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { questionSets, type Question, type QuestionSet, getQuestionsByIds } from "@/lib/questions-data"
import {
  saveQuizResult,
  getSeriesAttempts,
  saveQuizProgress,
  getAllQuizProgress,
  clearQuizProgress,
  getWrongAnswers,
} from "@/lib/firebase-service"
import { useAuth } from "@/contexts/auth-context"

type QuizQuestion = Question & {
  options: { label: string; text: string }[]
  correctAnswerText?: string
}

type QuizProgress = {
  setId: string
  setName: string
  currentQuestion: number
  answers: (string | null)[]
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  timestamp: number
}

interface QuizProps {
  onQuizComplete?: () => void
}

function shuffleArray<T>(array: T[]): T[] {
  if (!array || !Array.isArray(array)) {
    console.error("[v0] shuffleArray received invalid array:", array)
    return []
  }
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

function convertQuestions(questions: Question[]): QuizQuestion[] {
  return questions
    .filter((q) => q && q.options && q.options.a && q.options.b && q.options.c)
    .map((q) => ({
      ...q,
      options: [
        { label: "a", text: q.options.a },
        { label: "b", text: q.options.b },
        { label: "c", text: q.options.c },
      ],
      correctAnswer: q.correct,
      correctAnswerText: q.options[q.correct],
    }))
}

function shuffleAnswers(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((q) => {
    if (!q.options || !Array.isArray(q.options)) {
      console.error("[v0] Question missing options array:", q)
      return q
    }

    const texts = q.options.map((opt) => opt.text)
    const shuffledTexts = shuffleArray(texts)

    const newOptions = q.options.map((opt, idx) => ({
      label: opt.label,
      text: shuffledTexts[idx],
    }))

    const correctAnswerText = q.options.find((opt) => opt.label === q.correctAnswer)?.text
    const newCorrectLabel = newOptions.find((opt) => opt.text === correctAnswerText)?.label || q.correctAnswer

    return {
      ...q,
      options: newOptions,
      correctAnswer: newCorrectLabel,
      correctAnswerText: correctAnswerText,
    }
  })
}

export default function Quiz({ onQuizComplete }: QuizProps) {
  const { username, isAnonymous } = useAuth()

  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null)
  const [isWrongAnswersMode, setIsWrongAnswersMode] = useState(false)
  const [wrongAnswersQuestions, setWrongAnswersQuestions] = useState<Question[]>([])
  const [isShuffleQuestions, setIsShuffleQuestions] = useState(false)
  const [isShuffleAnswers, setIsShuffleAnswers] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [quizStarted, setQuizStarted] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [answers, setAnswers] = useState<(string | null)[]>([])
  const [completedSetId, setCompletedSetId] = useState<string | null>(null)
  const [seriesAttempts, setSeriesAttempts] = useState<Record<string, number>>({})
  const [seriesProgress, setSeriesProgress] = useState<Record<string, QuizProgress>>({})
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [resumeSetId, setResumeSetId] = useState<string | null>(null)
  const [savedProgress, setSavedProgress] = useState<QuizProgress | null>(null)

  const handleCancelResume = () => {
    setShowResumeDialog(false)
    setResumeSetId(null)
    setSelectedSet(null) // Reset selected set to return to series selection
  }

  const handleBackToSets = () => {
    setQuizStarted(false)
    setSelectedSet(null)
  }

  const loadSeriesAttempts = async () => {
    if (!username || isAnonymous) return
    try {
      const attempts = await getSeriesAttempts(username)
      setSeriesAttempts(attempts)
    } catch (error) {
      console.error("[v0] Error loading series attempts:", error)
    }
  }

  const loadAllSeriesProgress = async () => {
    if (!username || isAnonymous) return
    try {
      const allProgress = await getAllQuizProgress(username)
      console.log("[v0] All series progress loaded:", allProgress)
      setSeriesProgress(allProgress)
    } catch (error) {
      console.error("[v0] Error loading series progress:", error)
    }
  }

  const saveProgress = async () => {
    if (!username || isAnonymous || !selectedSet) return
    try {
      await saveQuizProgress({
        username,
        setId: selectedSet.id,
        setName: selectedSet.name,
        currentQuestion,
        answers,
        shuffleQuestions: isShuffleQuestions,
        shuffleAnswers: isShuffleAnswers,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.error("[v0] Error saving progress:", error)
    }
  }

  const loadWrongAnswers = async () => {
    if (!username || isAnonymous) return
    try {
      const wrongAnswers = await getWrongAnswers(username)
      const questionIds = wrongAnswers.map((wa) => wa.questionId)
      const questions = getQuestionsByIds(questionIds)
      setWrongAnswersQuestions(questions)
    } catch (error) {
      console.error("[v0] Error loading wrong answers:", error)
    }
  }

  const handleStartFresh = () => {
    setIsShuffleQuestions(false)
    setIsShuffleAnswers(false)
    handleStartQuiz()
  }

  const handleResumeProgress = () => {
    const progress = seriesProgress[resumeSetId]
    if (progress && selectedSet) {
      const processedQuestions = shuffleQuestionsIfNeeded(selectedSet.questions)
      setQuestions(processedQuestions)
      setCurrentQuestion(progress.currentQuestion)
      setAnswers(progress.answers)
      setIsShuffleQuestions(progress.shuffleQuestions)
      setIsShuffleAnswers(progress.shuffleAnswers)
      setQuizStarted(true)
      setShowResumeDialog(false)
    }
  }

  useEffect(() => {
    if (username && !isAnonymous) {
      loadSeriesAttempts()
      loadAllSeriesProgress()
      loadWrongAnswers()
    }
  }, [username, isAnonymous])

  const handleSelectSet = (set: QuestionSet | null, wrongAnswersMode = false) => {
    if (wrongAnswersMode) {
      setIsWrongAnswersMode(true)
      setSelectedSet({
        id: "wrong-answers",
        name: "Al mijn fouten",
        description: "Oefen alle vragen die je fout hebt gehad",
        questions: wrongAnswersQuestions,
      })
    } else if (set) {
      setIsWrongAnswersMode(false)
      const progress = seriesProgress[set.id]
      if (progress && username && !isAnonymous) {
        setResumeSetId(set.id)
        setShowResumeDialog(true)
        setSelectedSet(set)
        setSavedProgress(progress)
      } else {
        setSelectedSet(set)
      }
    }
  }

  const handleStartQuiz = () => {
    if (!selectedSet) return

    const processedQuestions = shuffleQuestionsIfNeeded(selectedSet.questions)
    setQuestions(processedQuestions)
    setQuizStarted(true)
    setShowResult(false)
    setCurrentQuestion(0)
    setAnswers([])
  }

  const shuffleQuestionsIfNeeded = (questions: Question[]): QuizQuestion[] => {
    let processedQuestions = convertQuestions(questions)

    if (isShuffleQuestions) {
      processedQuestions = shuffleArray(processedQuestions)
    }

    if (isShuffleAnswers) {
      setQuestions(shuffleAnswers(processedQuestions))
    } else {
      setQuestions(processedQuestions)
    }

    return processedQuestions
  }

  const handleAnswerClick = (answer: string) => {
    setSelectedAnswer(answer)
  }

  const handleNext = () => {
    if (!selectedAnswer) {
      alert("Selecteer eerst een antwoord")
      return
    }

    if (!answers || !Array.isArray(answers)) {
      console.error("[v0] answers is not an array:", answers)
      setAnswers([])
      return
    }

    const newAnswers = [...answers]
    newAnswers[currentQuestion] = selectedAnswer
    setAnswers(newAnswers)

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
    } else {
      setCompletedSetId(selectedSet?.id || null)
      setShowResult(true)
      if (username && selectedSet && !isAnonymous) {
        saveQuizResultToFirebase(newAnswers)
      }
    }
  }

  const handleRestart = () => {
    if (username && !isAnonymous && selectedSet && !isWrongAnswersMode) {
      clearQuizProgress(username, selectedSet.id)
    }
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setQuizStarted(false)
    setSelectedSet(null)
    setAnswers([])
    setCompletedSetId(null)
    setIsWrongAnswersMode(false)
  }

  const handleContinueToNextSet = () => {
    if (isWrongAnswersMode) return

    const currentSetIndex = questionSets.findIndex((set) => set.id === completedSetId)
    if (currentSetIndex < questionSets.length - 1) {
      const nextSet = questionSets[currentSetIndex + 1]
      handleSelectSet(nextSet)
    }
  }

  const saveQuizResultToFirebase = async (finalAnswers: (string | null)[]) => {
    if (!username || !selectedSet || isAnonymous) return
    if (isWrongAnswersMode) {
      onQuizComplete?.()
      await loadWrongAnswers()
      return
    }

    const score = finalAnswers.filter((answer, idx) => answer === questions[idx].correctAnswer).length
    const percentage = Math.round((score / questions.length) * 100)

    try {
      await saveQuizResult({
        username: username,
        setId: selectedSet.id,
        setName: selectedSet.name,
        score,
        totalQuestions: questions.length,
        percentage,
        answersGiven: finalAnswers,
        correctAnswers: questions.map((q) => q.correctAnswer),
        timestamp: Date.now(),
        shuffleQuestions: isShuffleQuestions,
        shuffleAnswers: isShuffleAnswers,
      })
      console.log("[v0] Quiz result saved successfully")
      await clearQuizProgress(username, selectedSet.id)
      await loadSeriesAttempts()
      await loadWrongAnswers()
      await loadAllSeriesProgress()
      onQuizComplete?.()
    } catch (error) {
      console.error("[v0] Failed to save quiz result:", error)
    }
  }

  const handleStopQuiz = async () => {
    if (username && !isAnonymous && !isWrongAnswersMode) {
      await saveProgress()
      await loadAllSeriesProgress()
    }
    setQuizStarted(false)
    setShowResult(false)
    setSelectedSet(null)
    setIsWrongAnswersMode(false)
  }

  if (showResumeDialog && savedProgress) {
    const progress = savedProgress
    return (
      <Card className="border-2 max-w-2xl mx-auto mt-8">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2">Doorgaan waar je was gebleven?</CardTitle>
          <CardDescription className="text-base">Je hebt een onvoltooide quiz voor {progress.setName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <p className="text-sm">
              <span className="font-medium">Reeks:</span> {progress.setName}
            </p>
            <p className="text-sm">
              <span className="font-medium">Voortgang:</span> {progress.answers?.length || 0} van{" "}
              {selectedSet?.questions.length || 0} vragen beantwoord
            </p>
            <p className="text-sm text-muted-foreground">
              Laatst opgeslagen: {new Date(progress.timestamp).toLocaleString("nl-NL")}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col md:flex-row gap-2">
          <Button onClick={handleCancelResume} variant="outline" className="w-full md:flex-1 bg-transparent" size="lg">
            Terug
          </Button>
          <Button onClick={handleStartFresh} variant="outline" className="w-full md:flex-1 bg-transparent" size="lg">
            Opnieuw Beginnen
          </Button>
          <Button onClick={handleResumeProgress} className="w-full md:flex-1" size="lg">
            Doorgaan
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (!selectedSet) {
    return (
      <Card className="border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2">{"Kies een vragenreeks"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isAnonymous && username && wrongAnswersQuestions.length > 0 && (
            <button
              onClick={() => handleSelectSet(null, true)}
              className="w-full text-left p-4 rounded-lg border-2 border-orange-500/50 bg-orange-500/5 transition-all duration-200 hover:border-orange-500 hover:bg-orange-500/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    <h3 className="font-semibold text-lg">Al mijn fouten</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Oefen alle vragen die je fout hebt gehad</p>
                </div>
                <div className="text-sm font-medium text-orange-500">{wrongAnswersQuestions.length} vragen</div>
              </div>
            </button>
          )}

          {questionSets.map((set) => {
            const attemptCount = seriesAttempts[set.id] || 0
            const progressInfo = seriesProgress[set.id]

            return (
              <button
                key={set.id}
                onClick={() => handleSelectSet(set)}
                className="w-full text-left p-4 rounded-lg border-2 transition-all duration-200 hover:border-primary hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{set.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      {attemptCount > 0 && <p className="text-sm text-muted-foreground">{attemptCount}x geprobeerd</p>}
                      {progressInfo && progressInfo.answers && (
                        <p className="text-sm font-medium text-orange-500">
                          {progressInfo.answers.length}/{set.questions.length} beantwoord
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">{set.questions.length} vragen</div>
                </div>
              </button>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  if (!quizStarted) {
    return (
      <Card className="border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2">{selectedSet.name}</CardTitle>
          <CardDescription className="text-base">
            {selectedSet.description} - {selectedSet.questions.length} meerkeuzevragen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 p-4 rounded-lg bg-muted/50">
              <Checkbox
                id="shuffle-questions"
                checked={isShuffleQuestions}
                onCheckedChange={(checked) => setIsShuffleQuestions(checked === true)}
              />
              <label
                htmlFor="shuffle-questions"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Shuffle vragen (willekeurige volgorde van vragen)
              </label>
            </div>
            <div className="flex items-center space-x-2 p-4 rounded-lg bg-muted/50">
              <Checkbox
                id="shuffle-answers"
                checked={isShuffleAnswers}
                onCheckedChange={(checked) => setIsShuffleAnswers(checked === true)}
              />
              <label
                htmlFor="shuffle-answers"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Shuffle antwoorden (willekeurige volgorde van a, b, c)
              </label>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button onClick={handleBackToSets} variant="outline" className="flex-1 bg-transparent">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Terug
          </Button>
          <Button onClick={handleStartQuiz} className="flex-1" size="lg">
            {(isShuffleQuestions || isShuffleAnswers) && <Shuffle className="w-4 h-4 mr-2" />}
            Start Quiz
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (showResult) {
    const score = answers.filter((answer, idx) => answer === questions[idx].correctAnswer).length
    const percentage = Math.round((score / questions.length) * 100)

    const currentSetIndex = questionSets.findIndex((set) => set.id === completedSetId)
    const hasNextSet = !isWrongAnswersMode && currentSetIndex < questionSets.length - 1

    return (
      <Card className="border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl mb-2">Quiz Voltooid!</CardTitle>
          <CardDescription className="text-lg">Je hebt de quiz afgerond</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-primary/10 mb-4">
              <span className="text-5xl font-bold text-primary">{percentage}%</span>
            </div>
            <p className="text-2xl font-semibold mb-2">
              {score} van de {questions.length} correct
            </p>
            <p className="text-muted-foreground">
              {percentage >= 80 && "Uitstekend werk!"}
              {percentage >= 60 && percentage < 80 && "Goed gedaan!"}
              {percentage >= 40 && percentage < 60 && "Niet slecht, blijf oefenen!"}
              {percentage < 40 && "Blijf oefenen, je kunt dit!"}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg mb-3">Overzicht antwoorden:</h3>
            {questions.map((q, idx) => {
              const userAnswer = answers[idx]
              const isCorrectAnswer = userAnswer === q.correctAnswer
              const correctAnswerText = q.options.find((opt) => opt.label === q.correctAnswer)?.text

              return (
                <div
                  key={q.id}
                  className={cn(
                    "p-4 rounded-lg border-2",
                    isCorrectAnswer ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20",
                  )}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="mt-1">
                      {isCorrectAnswer ? (
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-1">Vraag {idx + 1}</p>
                      <p className="text-sm leading-relaxed">{q.question}</p>
                    </div>
                  </div>
                  {!isCorrectAnswer && (
                    <div className="ml-8 space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Jouw antwoord:</span>
                          <p className="text-muted-foreground">
                            {userAnswer}) {q.options.find((opt) => opt.label === userAnswer)?.text}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Correct antwoord:</span>
                          <p className="text-muted-foreground">
                            {q.correctAnswer}) {correctAnswerText}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {isCorrectAnswer && (
                    <div className="ml-8 text-sm">
                      <span className="font-medium text-success">Correct!</span>
                      <p className="text-muted-foreground">
                        {userAnswer}) {q.options.find((opt) => opt.label === userAnswer)?.text}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button onClick={handleRestart} variant="outline" className="flex-1 bg-transparent" size="lg">
            <RotateCcw className="w-4 h-4 mr-2" />
            Opnieuw Proberen
          </Button>
          {hasNextSet && (
            <Button onClick={handleContinueToNextSet} className="flex-1" size="lg">
              Volgende Reeks
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Vraag {currentQuestion + 1} van {questions.length}
          </span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2 mb-4">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
        <CardTitle className="text-xl leading-relaxed">{questions[currentQuestion].question}</CardTitle>
        {questions[currentQuestion].image ? (
          <div className="mt-4 p-4 bg-muted rounded-lg border">
            <img
              src={questions[currentQuestion].image || "/placeholder.svg"}
              alt="Vraag afbeelding"
              className="max-w-xs h-auto mx-auto max-h-32 object-contain"
            />
          </div>
        ) : (
          questions[currentQuestion].hasImage && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                ⚠️ Deze vraag bevat een afbeelding of symbool die momenteel niet beschikbaar is.
              </p>
              {questions[currentQuestion].imageNote && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {questions[currentQuestion].imageNote}
                </p>
              )}
            </div>
          )
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {questions[currentQuestion].options.map((option) => {
          const isSelected = selectedAnswer === option.label
          const hasImageAnswer = questions[currentQuestion].optionImages?.[option.label as "a" | "b" | "c"]

          return (
            <button
              key={option.label}
              onClick={() => handleAnswerClick(option.label)}
              className={cn(
                "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                "hover:border-primary hover:bg-accent",
                isSelected && "border-primary bg-accent",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 font-semibold text-sm flex-shrink-0",
                    isSelected && "border-primary bg-primary text-primary-foreground",
                    !isSelected && "border-border",
                  )}
                >
                  {option.label}
                </span>
                {hasImageAnswer ? (
                  <div className="flex-1">
                    <img
                      src={hasImageAnswer || "/placeholder.svg"}
                      alt={`Antwoord ${option.label}`}
                      className="max-h-24 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <span
                    className="flex-1 text-base leading-relaxed break-words overflow-wrap-anywhere min-w-0 hyphens-auto"
                    lang="nl"
                  >
                    {option.text}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </CardContent>
      <CardFooter className="flex gap-3">
        {username && username !== "anonymous" && (
          <Button onClick={handleStopQuiz} variant="outline" className="bg-transparent" size="lg">
            Stop Reeks
          </Button>
        )}
        <Button onClick={handleNext} disabled={!selectedAnswer} className="flex-1" size="lg">
          {currentQuestion < questions.length - 1 ? "Volgende Vraag" : "Bekijk Resultaten"}
        </Button>
      </CardFooter>
    </Card>
  )
}
