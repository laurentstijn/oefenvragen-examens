"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, RotateCcw, Shuffle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

type Question = {
  id: number
  question: string
  options: { label: string; text: string }[]
  correctAnswer: string
}

const originalQuestions: Question[] = [
  {
    id: 1,
    question: "Hoeveel bedraagt de voortplantingssnelheid van elektromagnetische golven?",
    options: [
      { label: "a", text: "300.000 km/s" },
      { label: "b", text: "300.000 m/s" },
      { label: "c", text: "300.000.000 km/s" },
    ],
    correctAnswer: "a",
  },
  {
    id: 2,
    question: "Hoe noemen we het aantal golven dat per seconde wordt opgewekt?",
    options: [
      { label: "a", text: "Golflengte" },
      { label: "b", text: "Frequentie" },
      { label: "c", text: "Amplitude" },
    ],
    correctAnswer: "b",
  },
  {
    id: 3,
    question: "Waaraan is één Hertz gelijk?",
    options: [
      { label: "a", text: "10.000 golven per seconde" },
      { label: "b", text: "1.000 golven per seconde" },
      { label: "c", text: "1 golf per seconde" },
    ],
    correctAnswer: "c",
  },
  {
    id: 4,
    question: "Waaraan is het product van frequentie en golflengte gelijk? (frequentie X golflengte = ?)",
    options: [
      { label: "a", text: "Voortplantingssnelheid" },
      { label: "b", text: "Amplitude" },
      { label: "c", text: "Golfperiode" },
    ],
    correctAnswer: "a",
  },
  {
    id: 5,
    question:
      "Gegeven: de frequentie van de elektromagnetische golven bedraagt 10.000 Mhz. Gevraagd: bereken de golflengte",
    options: [
      { label: "a", text: "3.1 cm" },
      { label: "b", text: "30 cm" },
      { label: "c", text: "3 cm" },
    ],
    correctAnswer: "c",
  },
  {
    id: 6,
    question: "Hoe wordt de afstand tussen de plaats van uitzending en het waarnemen voorwerp bepaald?",
    options: [
      { label: "a", text: "Afstand tussen de voorwerpen meten en delen door twee" },
      { label: "b", text: "Tijd meten van de zendimpuls en delen door twee" },
      {
        label: "c",
        text: "Door de tijd te meten die verstrijkt tussen uitzenden van een impuls en het binnenkomen van een echo. Dit gebeurt in het radartoestel",
      },
    ],
    correctAnswer: "c",
  },
  {
    id: 7,
    question:
      "Gegeven: tijd tussen uitzending en ontvangst van de elektromagnetische golven is 60 microseconden. Gevraagd: bereken de afstand?",
    options: [
      { label: "a", text: "18.000 m" },
      { label: "b", text: "900 m" },
      { label: "c", text: "9.000 m" },
    ],
    correctAnswer: "c",
  },
  {
    id: 8,
    question: "Duld de fout aan.",
    options: [
      { label: "a", text: "Hoek van inval = hoek van uitval" },
      { label: "b", text: "Het afstandsonderscheidingsvermogen is gelijk aan de halve impulslengte" },
      { label: "c", text: "Als de invalshoek 135° bedraagt, krijgen we een goede echo" },
    ],
    correctAnswer: "c",
  },
  {
    id: 9,
    question: "Een rond voorwerp kan ook door de radar waargenomen worden. Hoe verklaar je dit?",
    options: [
      { label: "a", text: "Op een rond voorwerp zal altijd wel ergens een goede invalshoek zijn" },
      { label: "b", text: "Een rond voorwerp wordt nooit waargenomen" },
      { label: "c", text: "Een rond voorwerp wordt alleen waargenomen vanuit een benedenstroomse richting" },
    ],
    correctAnswer: "a",
  },
  {
    id: 10,
    question: "Waarom worden reflectoren gebruikt?",
    options: [
      { label: "a", text: "Omdat ze in alle omstandigheden een gunstige invalshoek garanderen" },
      { label: "b", text: "Omdat ze beter kunnen bevestigd worden" },
      { label: "c", text: "Omdat ze goedkoper zijn" },
    ],
    correctAnswer: "a",
  },
]

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

export default function Quiz() {
  const [isShuffled, setIsShuffled] = useState(false)
  const [questions, setQuestions] = useState(originalQuestions)
  const [quizStarted, setQuizStarted] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [answers, setAnswers] = useState<(string | null)[]>(new Array(originalQuestions.length).fill(null))

  const handleStartQuiz = () => {
    if (isShuffled) {
      setQuestions(shuffleArray(originalQuestions))
    } else {
      setQuestions(originalQuestions)
    }
    setQuizStarted(true)
  }

  const handleAnswerClick = (answer: string) => {
    setSelectedAnswer(answer)
  }

  const handleNext = () => {
    if (!selectedAnswer) return

    const newAnswers = [...answers]
    newAnswers[currentQuestion] = selectedAnswer
    setAnswers(newAnswers)

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
    } else {
      setShowResult(true)
    }
  }

  const handleRestart = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setQuizStarted(false)
    setAnswers(new Array(originalQuestions.length).fill(null))
  }

  if (!quizStarted) {
    return (
      <Card className="border-2">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl mb-2">Vragenreeks 1 (10 vragen)</CardTitle>
          <CardDescription className="text-lg">
            Test je kennis met {originalQuestions.length} meerkeuzevragen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2 p-4 rounded-lg bg-muted/50">
            <Checkbox
              id="shuffle"
              checked={isShuffled}
              onCheckedChange={(checked) => setIsShuffled(checked === true)}
            />
            <label
              htmlFor="shuffle"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Shuffle vragen (willekeurige volgorde)
            </label>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleStartQuiz} className="w-full" size="lg">
            {isShuffled && <Shuffle className="w-4 h-4 mr-2" />}
            Start Quiz
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (showResult) {
    const score = answers.filter((answer, idx) => answer === questions[idx].correctAnswer).length
    const percentage = Math.round((score / questions.length) * 100)

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
        <CardFooter>
          <Button onClick={handleRestart} className="w-full" size="lg">
            <RotateCcw className="w-4 h-4 mr-2" />
            Opnieuw Proberen
          </Button>
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
      </CardHeader>
      <CardContent className="space-y-3">
        {questions[currentQuestion].options.map((option) => {
          const isSelected = selectedAnswer === option.label

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
                <span className="flex-1 text-base leading-relaxed break-words">{option.text}</span>
              </div>
            </button>
          )
        })}
      </CardContent>
      <CardFooter>
        <Button onClick={handleNext} disabled={!selectedAnswer} className="w-full" size="lg">
          {currentQuestion < questions.length - 1 ? "Volgende Vraag" : "Bekijk Resultaten"}
        </Button>
      </CardFooter>
    </Card>
  )
}
