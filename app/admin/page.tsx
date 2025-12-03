"use client"
import { useState, useMemo, useEffect } from "react"
import type React from "react"

import { questionSets, type Question } from "@/lib/questions-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Search, Download } from "lucide-react"
import Link from "next/link"
import { QuestionEditor } from "@/components/question-editor"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const { username, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [password, setPassword] = useState("")
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(true)
  const [selectedSet, setSelectedSet] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editedQuestions, setEditedQuestions] = useState<Map<number, Question>>(new Map())
  const [showExportModal, setShowExportModal] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!username) {
        router.push("/")
      }
    }
  }, [username, loading, router])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === "batelier123") {
      setIsAuthorized(true)
      setShowPasswordPrompt(false)
    } else {
      alert("Verkeerd wachtwoord")
      setPassword("")
    }
  }

  const allQuestions = useMemo(() => {
    return questionSets.flatMap((set) =>
      set.questions.map((q) => {
        const edited = editedQuestions.get(q.id)
        return { ...(edited || q), setName: set.name }
      }),
    )
  }, [editedQuestions])

  const filteredQuestions = useMemo(() => {
    let questions = allQuestions

    if (selectedSet !== "all") {
      questions = questions.filter((q) => q.setName === selectedSet)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      questions = questions.filter((q) => q.question.toLowerCase().includes(query) || q.id.toString().includes(query))
    }

    return questions
  }, [allQuestions, selectedSet, searchQuery])

  const generateQuestionCode = (q: Question): string => {
    const escapeString = (str: string) => {
      return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")
    }

    if (q.optionImages) {
      return `  qWithImageAnswers(${q.id}, "${escapeString(q.question)}", "${q.correct}", {
    a: "${q.optionImages.a || ""}",
    b: "${q.optionImages.b || ""}",
    c: "${q.optionImages.c || ""}"
  }),`
    } else if (q.hasImage && q.image) {
      return `  qWithImage(${q.id}, "${escapeString(q.question)}", { a: "${escapeString(q.options.a)}", b: "${escapeString(q.options.b)}", c: "${escapeString(q.options.c)}" }, "${q.correct}", "${q.image}"),`
    } else {
      return `  q(${q.id}, "${escapeString(q.question)}", { a: "${escapeString(q.options.a)}", b: "${escapeString(q.options.b)}", c: "${escapeString(q.options.c)}" }, "${q.correct}"),`
    }
  }

  const exportCode = () => {
    if (editedQuestions.size === 0) {
      alert("Geen wijzigingen om te exporteren")
      return
    }
    setShowExportModal(true)
  }

  const handleSaveQuestion = (question: Question) => {
    setEditedQuestions((prev) => new Map(prev).set(question.id, question))
  }

  const editingQuestion = editingId ? allQuestions.find((q) => q.id === editingId) : null

  const exportedCode = useMemo(() => {
    if (editedQuestions.size === 0) return ""

    const sortedEdits = Array.from(editedQuestions.values()).sort((a, b) => a.id - b.id)

    return sortedEdits.map(generateQuestionCode).join("\n")
  }, [editedQuestions])

  if (loading) {
    return (
      <main className="w-full min-h-screen bg-background flex items-center justify-center">
        <p>Laden...</p>
      </main>
    )
  }

  if (showPasswordPrompt && !isAuthorized) {
    return (
      <main className="w-full min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Toegang</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Admin Wachtwoord</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Voer admin wachtwoord in"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  Toegang
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/")} className="flex-1">
                  Annuleren
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="w-full min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Terug
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Vragen Beheer</h1>
            {editedQuestions.size > 0 && (
              <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                {editedQuestions.size} aangepast
              </span>
            )}
          </div>
          <Button onClick={exportCode} variant="default" disabled={editedQuestions.size === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exporteer Code
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Button variant={selectedSet === "all" ? "default" : "outline"} onClick={() => setSelectedSet("all")}>
                Alle Vragen ({allQuestions.length})
              </Button>
              {questionSets.map((set) => (
                <Button
                  key={set.id}
                  variant={selectedSet === set.name ? "default" : "outline"}
                  onClick={() => setSelectedSet(set.name)}
                >
                  {set.name} ({set.questions.length})
                </Button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op vraagnummer of tekst..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{filteredQuestions.length} vragen gevonden</p>

          {filteredQuestions.map((question) => (
            <Card
              key={question.id}
              className={`hover:border-primary/50 transition-colors ${editedQuestions.has(question.id) ? "border-orange-500" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold bg-muted px-2 py-1 rounded">#{question.id}</span>
                      <span className="text-sm text-muted-foreground">{question.setName}</span>
                      {editedQuestions.has(question.id) && (
                        <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded">Aangepast</span>
                      )}
                      {question.hasImage && (
                        <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-1 rounded">Met afbeelding</span>
                      )}
                      {question.optionImages && (
                        <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-1 rounded">
                          Afbeelding antwoorden
                        </span>
                      )}
                    </div>

                    <p className="text-base">{question.question}</p>

                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${question.correct === "a" ? "text-green-600" : ""}`}>A:</span>
                        <span>{question.options.a || "(afbeelding)"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${question.correct === "b" ? "text-green-600" : ""}`}>B:</span>
                        <span>{question.options.b || "(afbeelding)"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${question.correct === "c" ? "text-green-600" : ""}`}>C:</span>
                        <span>{question.options.c || "(afbeelding)"}</span>
                      </div>
                    </div>

                    <div className="text-sm">
                      <span className="font-semibold">Correct antwoord: </span>
                      <span className="text-green-600 font-bold uppercase">{question.correct}</span>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" onClick={() => setEditingId(question.id)}>
                    Bewerken
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {editingQuestion && (
        <QuestionEditor question={editingQuestion} onClose={() => setEditingId(null)} onSave={handleSaveQuestion} />
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col">
            <CardHeader>
              <CardTitle>Exporteer Aangepaste Vragen</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              <p className="text-sm text-muted-foreground">
                Kopieer onderstaande code en vervang de betreffende vragen in <code>lib/questions-data.ts</code>
              </p>

              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">{exportedCode}</pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 bg-transparent"
                  onClick={() => {
                    navigator.clipboard.writeText(exportedCode)
                    alert("Code gekopieerd naar clipboard!")
                  }}
                >
                  Kopieer
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Instructies:</h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Kopieer de code hierboven</li>
                  <li>Open het bestand lib/questions-data.ts</li>
                  <li>Zoek de vragen op nummer en vervang ze</li>
                  <li>Sla het bestand op</li>
                </ol>
              </div>
            </CardContent>
            <div className="border-t p-4">
              <Button onClick={() => setShowExportModal(false)} className="w-full">
                Sluiten
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  )
}
