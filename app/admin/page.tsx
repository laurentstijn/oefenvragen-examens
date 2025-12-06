"use client"
import { useState, useMemo, useEffect } from "react"
import type React from "react"

import { questionSets, type Question } from "@/lib/questions-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Search, Download, Database } from "lucide-react"
import Link from "next/link"
import { QuestionEditor } from "@/components/question-editor"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import {
  checkOldDataExists,
  inspectOldData,
  deleteOldDataNodes,
  migrateOldDataToNewStructure,
  type MigrationReport,
} from "@/lib/firebase-service"

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
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<{
    hasOldProgress: boolean
    hasOldResults: boolean
    hasOldIncorrect: boolean
  } | null>(null)
  const [oldDataDetails, setOldDataDetails] = useState<{
    oldProgress: Record<string, any>
    oldResults: Record<string, any>
    oldIncorrect: Record<string, any>
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null)

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

  const handleCheckMigrationStatus = async () => {
    try {
      setShowMigrationModal(true)
      const [status, details] = await Promise.all([checkOldDataExists(), inspectOldData()])
      setMigrationStatus(status)
      setOldDataDetails(details)
    } catch (error) {
      alert("Error checking migration status: " + error)
      setShowMigrationModal(false)
    }
  }

  const handleDeleteOldData = async () => {
    const confirmed = confirm(
      "WAARSCHUWING: Dit verwijdert de oude top-level nodes (quizProgress, quizResults, incorrectQuestions) uit je database. " +
        "Zorg dat je een backup hebt gemaakt! Weet je het zeker?",
    )

    if (!confirmed) return

    try {
      setIsDeleting(true)
      await deleteOldDataNodes()
      alert("Oude data nodes succesvol verwijderd!")
      setShowMigrationModal(false)
      setMigrationStatus(null)
      setOldDataDetails(null)
    } catch (error) {
      alert("Error bij verwijderen: " + error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMigrateData = async () => {
    const confirmed = confirm(
      "Dit kopieert alle data van de oude nodes naar de nieuwe structuur onder users/[username]/. " +
        "De oude nodes blijven staan als backup. Doorgaan?",
    )

    if (!confirmed) return

    try {
      setIsMigrating(true)
      const report = await migrateOldDataToNewStructure()
      setMigrationReport(report)

      if (report.errors.length === 0) {
        alert(
          `Migratie succesvol!\n\n` +
            `Gebruikers: ${report.usersFound.length}\n` +
            `Progress items: ${Object.values(report.progressMigrated).reduce((a, b) => a + b, 0)}\n` +
            `Results items: ${Object.values(report.resultsMigrated).reduce((a, b) => a + b, 0)}\n` +
            `Foute vragen: ${Object.values(report.incorrectQuestionsMigrated).reduce((a, b) => a + b, 0)}`,
        )
        // Refresh status
        const [status, details] = await Promise.all([checkOldDataExists(), inspectOldData()])
        setMigrationStatus(status)
        setOldDataDetails(details)
      } else {
        alert(`Migratie voltooid met ${report.errors.length} error(s). Check de console voor details.`)
        console.error("[v0] Migration errors:", report.errors)
      }
    } catch (error) {
      alert("Error tijdens migratie: " + error)
    } finally {
      setIsMigrating(false)
    }
  }

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
              <div className="flex gap-2 flex-col">
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
          <div className="flex gap-2">
            <Button onClick={handleCheckMigrationStatus} variant="outline">
              <Database className="w-4 h-4 mr-2" />
              Check Database Status
            </Button>
            <Button onClick={exportCode} variant="default" disabled={editedQuestions.size === 0}>
              <Download className="w-4 h-4 mr-2" />
              Exporteer Code
            </Button>
          </div>
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
                    <div className="flex items-center gap-2 flex-wrap">
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
                Kopieer de code hieronder en plak deze in lib/questions-data.ts om de wijzigingen permanent te maken.
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

      {showMigrationModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
            <CardHeader>
              <CardTitle>Database Status</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {migrationStatus && (
                <>
                  {!migrationStatus.hasOldProgress &&
                  !migrationStatus.hasOldResults &&
                  !migrationStatus.hasOldIncorrect ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="font-semibold text-green-900 mb-2">Database is schoon!</h3>
                      <p className="text-sm text-green-800 mb-3">
                        Er zijn geen oude top-level nodes meer. Alle data staat in de nieuwe structuur onder
                        users/[username]/.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="font-semibold text-yellow-900 mb-2">Oude data gevonden</h3>
                      <p className="text-sm text-yellow-800 mb-3">
                        Er zijn nog oude top-level nodes in je database die gemigreerd moeten worden:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800 ml-2">
                        {migrationStatus.hasOldProgress && <li>quizProgress/ (oude progress data)</li>}
                        {migrationStatus.hasOldResults && <li>quizResults/ (oude results data)</li>}
                        {migrationStatus.hasOldIncorrect && <li>incorrectQuestions/ (oude foute vragen)</li>}
                      </ul>
                    </div>
                  )}

                  {oldDataDetails && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-900 mb-2">Details van oude data:</h3>
                      <div className="text-sm text-blue-800 space-y-2">
                        {Object.keys(oldDataDetails.oldProgress).length > 0 && (
                          <div>
                            <strong>quizProgress:</strong> {Object.keys(oldDataDetails.oldProgress).length} gebruiker(s)
                            met progress
                          </div>
                        )}
                        {Object.keys(oldDataDetails.oldResults).length > 0 && (
                          <div>
                            <strong>quizResults:</strong> {Object.keys(oldDataDetails.oldResults).length} gebruiker(s)
                            met results
                          </div>
                        )}
                        {Object.keys(oldDataDetails.oldIncorrect).length > 0 && (
                          <div>
                            <strong>incorrectQuestions:</strong> {Object.keys(oldDataDetails.oldIncorrect).length}{" "}
                            gebruiker(s) met foute vragen
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(migrationStatus.hasOldProgress ||
                    migrationStatus.hasOldResults ||
                    migrationStatus.hasOldIncorrect) && (
                    <>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h3 className="font-semibold text-orange-900 mb-2">Stap 1: Migreer Data</h3>
                        <p className="text-sm text-orange-800 mb-3">
                          Kopieer eerst alle oude data naar de nieuwe structuur onder users/[username]/. De oude nodes
                          blijven staan als backup.
                        </p>
                        <Button onClick={handleMigrateData} disabled={isMigrating} className="w-full">
                          {isMigrating ? "Bezig met migreren..." : "Migreer oude data naar nieuwe structuur"}
                        </Button>
                      </div>

                      {migrationReport && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h3 className="font-semibold text-green-900 mb-2">Migratie Rapport</h3>
                          <div className="text-sm text-green-800 space-y-2">
                            <div>
                              <strong>Gebruikers gemigreerd:</strong> {migrationReport.usersFound.join(", ")}
                            </div>
                            <div>
                              <strong>Progress items:</strong>{" "}
                              {Object.values(migrationReport.progressMigrated).reduce((a, b) => a + b, 0)}
                            </div>
                            <div>
                              <strong>Results items:</strong>{" "}
                              {Object.values(migrationReport.resultsMigrated).reduce((a, b) => a + b, 0)}
                            </div>
                            <div>
                              <strong>Foute vragen:</strong>{" "}
                              {Object.values(migrationReport.incorrectQuestionsMigrated).reduce((a, b) => a + b, 0)}
                            </div>
                            {migrationReport.errors.length > 0 && (
                              <div className="text-red-600">
                                <strong>Errors:</strong> {migrationReport.errors.length}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h3 className="font-semibold text-red-900 mb-2">Stap 2: Verwijder Oude Nodes</h3>
                        <p className="text-sm text-red-800 mb-3">
                          Na succesvolle migratie kun je de oude top-level nodes verwijderen. Controleer eerst in
                          Firebase Console of alle data correct is gekopieerd!
                        </p>
                        <Button
                          onClick={handleDeleteOldData}
                          variant="destructive"
                          disabled={isDeleting}
                          className="w-full"
                        >
                          {isDeleting ? "Bezig met verwijderen..." : "Verwijder oude data nodes"}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
            <div className="border-t p-4 flex gap-2">
              <Button
                onClick={() => {
                  setShowMigrationModal(false)
                  setMigrationStatus(null)
                  setOldDataDetails(null)
                  setMigrationReport(null)
                }}
                className="w-full"
                variant="outline"
              >
                Sluiten
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  )
}
