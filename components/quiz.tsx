"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, RotateCcw, Shuffle, ChevronLeft, AlertCircle } from "lucide-react"
import { questionSets, type Question, type QuestionSet } from "@/lib/questions-data"
import {
  saveQuizResult,
  getSeriesAttempts,
  saveQuizProgress,
  clearQuizProgress,
  getAllQuizProgress,
  addIncorrectQuestion,
  removeIncorrectQuestion,
  getIncorrectQuestions,
  type QuizProgress,
} from "@/lib/firebase-service"
import { useAuth } from "@/contexts/auth-context"

interface QuizProps {
  onQuizComplete?: () => void
  onQuizStateChange?: (isActive: boolean) => void
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

function convertQuestions(questions: Question[]): any[] {
  return questions
    .filter((q) => {
      if (!q || !q.options) return false
      // Allow if has regular text options OR has optionImages
      const hasTextOptions = q.options.a && q.options.b && q.options.c
      const hasImageOptions = q.optionImages && (q.optionImages.a || q.optionImages.b || q.optionImages.c)
      return hasTextOptions || hasImageOptions
    })
    .map((q) => ({
      ...q,
      options: [
        { label: "a", text: q.options.a },
        { label: "b", text: q.options.b },
        { label: "c", text: q.options.c },
      ],
      correctAnswer: q.correct,
      correctAnswerText: q.options[q.correct],
      optionImages: q.optionImages, // Explicitly pass through optionImages
    }))
}

function shuffleAnswers(questions: any[]): any[] {
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

function getQuestionsByIds(questionIds: string[]): Question[] {
  return questionSets.flatMap((set) => set.questions.filter((q) => questionIds.includes(q.id)))
}

export default function Quiz({ onQuizComplete, onQuizStateChange }: QuizProps) {
  const { username, isAnonymous } = useAuth()

  const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null)
  const [isWrongAnswersMode, setIsWrongAnswersMode] = useState(false)
  const [wrongAnswersCount, setWrongAnswersCount] = useState(0)
  const [isShuffleQuestions, setIsShuffleQuestions] = useState(false)
  const [isShuffleAnswers, setIsShuffleAnswers] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
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

  useEffect(() => {
    if (onQuizStateChange) {
      onQuizStateChange(quizStarted)
    }
  }, [quizStarted, onQuizStateChange])

  const handleCancelResume = () => {
    setShowResumeDialog(false)
    setResumeSetId(null)
    setSelectedSet(null) // Reset selected set to return to series selection
  }

  const handleBackToSets = () => {
    setSelectedSet(null)
    setQuizStarted(false)
    setShowResult(false)
    setSavedProgress(null)
    onQuizStateChange?.(false)
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
      setSeriesProgress(allProgress)
    } catch (error) {
      console.error("[v0] Error loading series progress:", error)
    }
  }

  const saveProgress = async () => {
    if (!username || isAnonymous || !selectedSet) return
    if (!answers || answers.length === 0) {
      console.log("[v0] No progress to save")
      return
    }
    try {
      const progressData = {
        username,
        setId: selectedSet.id,
        setName: selectedSet.name,
        currentQuestion,
        answers,
        shuffleQuestions: isShuffleQuestions,
        shuffleAnswers: isShuffleAnswers,
        timestamp: Date.now(),
      }

      await saveQuizProgress(progressData)

      // Update local seriesProgress state immediately
      setSeriesProgress((prev) => ({
        ...prev,
        [selectedSet.id]: progressData,
      }))
    } catch (error) {
      console.error("[v0] Error saving progress:", error)
    }
  }

  const loadWrongAnswers = async () => {
    if (!username || isAnonymous) return

    try {
      const incorrectIds = await getIncorrectQuestions(username)
      setWrongAnswersCount(incorrectIds.length)
    } catch (error) {
      console.error("[v0] Error loading wrong answers:", error)
    }
  }

  const handleStartFresh = () => {
    if (username && !isAnonymous && savedProgress?.setId) {
      clearQuizProgress(username, savedProgress.setId)
    }
    // Close the resume dialog and reset state
    setSavedProgress(null)
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

  const handleSelectSet = async (set: QuestionSet | null, wrongAnswersMode = false) => {
    if (wrongAnswersMode) {
      setIsWrongAnswersMode(true)

      if (!username || isAnonymous) {
        setSelectedSet({
          id: "wrong-answers",
          name: "Al mijn fouten",
          description: "Oefen alle vragen die je fout hebt gehad",
          questions: [],
        })
        return
      }

      try {
        // Load incorrect question IDs
        const incorrectIds = await getIncorrectQuestions(username)

        // Get the actual questions using those IDs
        const incorrectQuestions = getQuestionsByIds(incorrectIds)

        setSelectedSet({
          id: "wrong-answers",
          name: "Al mijn fouten",
          description: "Oefen alle vragen die je fout hebt gehad",
          questions: incorrectQuestions,
        })
      } catch (error) {
        console.error("[v0] Error loading incorrect questions:", error)
        setSelectedSet({
          id: "wrong-answers",
          name: "Al mijn fouten",
          description: "Oefen alle vragen die je fout hebt gehad",
          questions: [],
        })
      }
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
    const convertedQuestions = convertQuestions(selectedSet.questions)
    const shuffledQuestions = isShuffleQuestions ? shuffleArray(convertedQuestions) : convertedQuestions
    const processedQuestions = isShuffleAnswers
      ? shuffledQuestions.map((q) => ({ ...q, options: shuffleArray([...q.options]) }))
      : shuffledQuestions
    setQuestions(processedQuestions)
    setQuizStarted(true)
    onQuizStateChange?.(true)
  }

  const shuffleQuestionsIfNeeded = (questions: any[]): any[] => {
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

  const handleNext = async () => {
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

    const currentQ = questions[currentQuestion]
    const isCorrect = selectedAnswer === currentQ.correctAnswer

    console.log("[v0] Question answered:", { currentQ, isCorrect, isWrongAnswersMode })

    try {
      if (isCorrect) {
        console.log("[v0] Removing correct answer from incorrect questions:", currentQ.id)
        await removeIncorrectQuestion(username, currentQ.id)
        await loadWrongAnswers()
      } else if (!isWrongAnswersMode) {
        await addIncorrectQuestion(username, currentQ.id)
        await loadWrongAnswers()
      }
    } catch (error) {
      console.error("[v0] Error updating incorrect questions:", error)
    }

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
    if (!selectedSet) return
    const currentSetIndex = questionSets.findIndex((set: QuestionSet) => set.id === selectedSet.id)
    if (currentSetIndex !== -1 && currentSetIndex < questionSets.length - 1) {
      const nextSet = questionSets[currentSetIndex + 1]
      setSelectedSet(nextSet)
      setQuizStarted(false)
      setShowResult(false)
      setAnswers([])
      setCurrentQuestion(0)
      setSelectedAnswer(null) // Reset selected answer when moving to next set
      onQuizStateChange?.(false)
    }
  }

  const saveQuizResultToFirebase = async (finalAnswers: (string | null)[]) => {
    if (!username || !selectedSet || isAnonymous) return
    if (isWrongAnswersMode) {
      await loadWrongAnswers()
      onQuizComplete?.()
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
        correctAnswers: questions.map((q: any) => q.correctAnswer),
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
    if (answers.some((a) => a !== "")) {
      await saveProgress()
    }
    setSelectedSet(null)
    setQuizStarted(false)
    setShowResult(false)
    setAnswers([])
    setCurrentQuestion(0)
    onQuizStateChange?.(false)
  }

  if (showResumeDialog && savedProgress) {
    const progress = savedProgress
    const totalQuestions = selectedSet?.questions.length || progress.answers?.length || 0
    return (
      <Card className="border-2 mx-auto mt-4 sm:mt-8">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              Vraag {progress.currentQuestion + 1} van {totalQuestions}
            </span>
          </div>
          <Progress value={((progress.currentQuestion + 1) / totalQuestions) * 100} className="w-full" />
          <h3 className="text-base sm:text-lg lg:text-xl leading-relaxed mt-4">{progress.setName}</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 sm:p-4 rounded-lg bg-muted/50 space-y-2">
            <p className="text-xs sm:text-sm">
              <span className="font-medium">Reeks:</span> {progress.setName}
            </p>
            <p className="text-xs sm:text-sm">
              <span className="font-medium">Voortgang:</span> {progress.currentQuestion + 1} van {totalQuestions} vragen
              beantwoord
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Laatst opgeslagen: {new Date(progress.timestamp).toLocaleString("nl-NL")}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-4">
          <Button onClick={handleResumeProgress} className="w-full">
            Doorgaan
          </Button>
          <Button onClick={handleStartFresh} variant="outline" className="w-full bg-transparent">
            Opnieuw Beginnen
          </Button>
          <Button onClick={handleCancelResume} variant="outline" className="w-full bg-transparent">
            Terug
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (!selectedSet) {
    return (
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <h3 className="text-base sm:text-lg lg:text-xl leading-relaxed">Kies een vragenreeks</h3>
        </CardHeader>
        <CardContent className="space-y-2 sm:space-y-3">
          {!isAnonymous && username && wrongAnswersCount > 0 && (
            <button
              onClick={() => handleSelectSet(null, true)}
              className="w-full text-left p-4 rounded-lg border-2 border-orange-500/50 bg-orange-500/5 transition-all duration-200 hover:border-orange-500 hover:bg-orange-500/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    <h3 className="font-semibold text-lg sm:text-xl">Al mijn fouten</h3>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground mt-1">
                    Oefen alle vragen die je fout hebt gehad
                  </p>
                </div>
                <div className="text-sm sm:text-base font-medium text-orange-500">{wrongAnswersCount} vragen</div>
              </div>
            </button>
          )}

          {questionSets.map((set: QuestionSet) => {
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
                    <h3 className="font-semibold text-lg sm:text-xl">{set.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      {attemptCount > 0 && (
                        <p className="text-sm sm:text-base text-muted-foreground">{attemptCount}x geprobeerd</p>
                      )}
                      {progressInfo && progressInfo.answers && (
                        <p className="text-sm sm:text-base font-medium text-orange-500">
                          {progressInfo.answers.length}/{set.questions.length} beantwoord
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-sm sm:text-base font-medium text-muted-foreground">
                    {set.questions.length} vragen
                  </div>
                </div>
              </button>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  const selectedSetId = selectedSet?.id
  const selectedSetDetails = questionSets.find((set: QuestionSet) => set.id === selectedSetId) || questionSets[0]

  if (!quizStarted) {
    return (
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-center text-lg sm:text-xl">{selectedSetDetails.name}</CardTitle>
          <p className="text-sm sm:text-base lg:text-lg mt-2">
            {selectedSetDetails.description} - {selectedSetDetails.questions.length} meerkeuzevragen
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 p-4 rounded-lg bg-muted/50">
              <Checkbox
                id="shuffle-questions"
                checked={isShuffleQuestions}
                onCheckedChange={(checked) => setIsShuffleQuestions(checked === true)}
              />
              <Label
                htmlFor="shuffle-questions"
                className="text-sm sm:text-base font-medium leading-none cursor-pointer"
              >
                Shuffle vragen (willekeurige volgorde van vragen)
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-4 rounded-lg bg-muted/50">
              <Checkbox
                id="shuffle-answers"
                checked={isShuffleAnswers}
                onCheckedChange={(checked) => setIsShuffleAnswers(checked === true)}
              />
              <Label htmlFor="shuffle-answers" className="text-sm sm:text-base font-medium leading-none cursor-pointer">
                Shuffle antwoorden (willekeurige volgorde van a, b, c)
              </Label>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-4">
          <Button onClick={handleStartQuiz} className="w-full" size="lg">
            {(isShuffleQuestions || isShuffleAnswers) && <Shuffle className="w-4 h-4 mr-2" />}
            Start Reeks
          </Button>
          <Button onClick={handleBackToSets} variant="outline" className="w-full bg-transparent">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Terug
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (showResult) {
    const score = answers.filter((answer, idx) => answer === questions[idx].correctAnswer).length
    const percentage = Math.round((score / questions.length) * 100)
    const hasNextSet =
      !isWrongAnswersMode && selectedSet
        ? questionSets.findIndex((set: QuestionSet) => set.id === selectedSet.id) < questionSets.length - 1
        : false

    return (
      <Card className="border-2">
        <CardHeader className="text-center pb-4">
          <h3 className="text-xl sm:text-2xl lg:text-3xl mb-2">Quiz Voltooid!</h3>
          <p className="text-sm sm:text-base lg:text-lg">Je hebt de quiz afgerond</p>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="text-center py-4 sm:py-8">
            <div className="inline-flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-primary/10 mb-4">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary">{percentage}%</span>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2">
              {score} van de {questions.length} correct
            </p>
            <p className="text-sm sm:text-base text-muted-foreground">
              {percentage >= 80 && "Uitstekend werk!"}
              {percentage >= 60 && percentage < 80 && "Goed gedaan!"}
              {percentage >= 40 && percentage < 60 && "Niet slecht, blijf oefenen!"}
              {percentage < 40 && "Blijf oefenen, je kunt dit!"}
            </p>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <h3 className="font-semibold text-base sm:text-lg mb-3">Overzicht antwoorden:</h3>
            {questions.map((q: any, idx: number) => {
              const userAnswer = answers[idx]
              const isCorrectAnswer = userAnswer === q.correctAnswer
              const correctAnswerText = q.options.find((opt: any) => opt.label === q.correctAnswer)?.text

              return (
                <div
                  key={q.id}
                  className={cn(
                    "p-4 rounded-lg border-2",
                    isCorrectAnswer ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20",
                  )}
                >
                  <div className="flex items-start gap-3 sm:gap-4 mb-3">
                    <div className="mt-1">
                      {isCorrectAnswer ? (
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                      ) : (
                        <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium mb-1">Vraag {idx + 1}</p>
                      <p className="text-sm sm:text-base leading-relaxed">{q.question}</p>
                    </div>
                  </div>
                  {!isCorrectAnswer && (
                    <div className="ml-8 sm:ml-10 space-y-2 text-sm sm:text-base">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Jouw antwoord:</span>
                          <p className="text-muted-foreground">
                            {userAnswer}) {q.options.find((opt: any) => opt.label === userAnswer)?.text}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 sm:gap-3">
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success mt-0.5 flex-shrink-0" />
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
                    <div className="ml-8 sm:ml-10 text-sm sm:text-base">
                      <span className="font-medium text-success">Correct!</span>
                      <p className="text-muted-foreground">
                        {userAnswer}) {q.options.find((opt: any) => opt.label === userAnswer)?.text}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:gap-4 pt-4">
          <Button onClick={handleRestart} variant="outline" className="w-full bg-transparent">
            <RotateCcw className="w-4 h-4 mr-2" />
            Terug
          </Button>
          {hasNextSet && (
            <Button onClick={handleContinueToNextSet} className="w-full">
              Volgende Reeks
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="border-2 mx-auto mt-4 sm:mt-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">
            Vraag {currentQuestion + 1} van {questions.length}
          </span>
        </div>
        <Progress value={((currentQuestion + 1) / questions.length) * 100} className="w-full" />
        <h3 className="text-base sm:text-lg lg:text-xl leading-relaxed mt-4">{questions[currentQuestion].question}</h3>
        {questions[currentQuestion].image ? (
          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-muted rounded-lg border">
            <img
              src={questions[currentQuestion].image || "/placeholder.svg"}
              alt="Vraag afbeelding"
              className="max-w-full sm:max-w-xs h-auto mx-auto max-h-24 sm:max-h-32 object-contain"
            />
          </div>
        ) : (
          questions[currentQuestion].hasImage && (
            <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-100 font-medium">
                ⚠️ Deze vraag bevat een afbeelding of symbool die momenteel niet beschikbaar is.
              </p>
              {questions[currentQuestion].imageNote && (
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {questions[currentQuestion].imageNote}
                </p>
              )}
            </div>
          )
        )}
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3">
        {questions[currentQuestion].options.map((option: any) => {
          const isSelected = selectedAnswer === option.label
          const hasImageAnswer = questions[currentQuestion].optionImages?.[option.label as "a" | "b" | "c"]

          return (
            <button
              key={option.label}
              onClick={() => handleAnswerClick(option.label)}
              className={cn(
                "w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all duration-200",
                "hover:border-primary hover:bg-accent",
                isSelected && "border-primary bg-accent",
              )}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <span
                  className={cn(
                    "flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 font-semibold text-xs sm:text-sm flex-shrink-0",
                    isSelected && "border-primary bg-primary text-primary-foreground",
                    !isSelected && "border-border",
                  )}
                >
                  {option.label}
                </span>
                {hasImageAnswer ? (
                  <div className="p-3 sm:p-4 rounded-lg border">
                    <img
                      src={hasImageAnswer || "/placeholder.svg"}
                      alt={`Antwoord ${option.label}`}
                      className="max-w-full sm:max-w-xs h-auto mx-auto max-h-24 sm:max-h-32 object-contain"
                    />
                  </div>
                ) : (
                  <span className="text-base sm:text-lg">{option.text}</span>
                )}
              </div>
            </button>
          )
        })}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pt-4">
        <Button onClick={handleNext} disabled={!selectedAnswer} className="w-full">
          {currentQuestion < questions.length - 1 ? "Volgende Vraag" : "Bekijk Resultaten"}
        </Button>
        {username && username !== "anonymous" && (
          <Button onClick={handleStopQuiz} variant="outline" className="w-full bg-transparent">
            Stop Reeks
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
