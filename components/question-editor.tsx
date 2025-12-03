"use client"
import { useState } from "react"
import type { Question } from "@/lib/questions-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X } from "lucide-react"

interface QuestionEditorProps {
  question: Question
  onClose: () => void
  onSave: (question: Question) => void
}

export function QuestionEditor({ question, onClose, onSave }: QuestionEditorProps) {
  const [editedQuestion, setEditedQuestion] = useState<Question>(question)

  const handleSave = () => {
    onSave(editedQuestion)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl my-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bewerk Vraag #{question.id}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Question Text */}
          <div className="space-y-2">
            <Label htmlFor="question-text">Vraag Tekst</Label>
            <Textarea
              id="question-text"
              value={editedQuestion.question}
              onChange={(e) => setEditedQuestion({ ...editedQuestion, question: e.target.value })}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Options */}
          <div className="space-y-4">
            <Label>Antwoordopties</Label>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex items-center gap-2 min-w-[100px]">
                  <input
                    type="radio"
                    name="correct"
                    checked={editedQuestion.correct === "a"}
                    onChange={() => setEditedQuestion({ ...editedQuestion, correct: "a" })}
                    className="w-4 h-4"
                  />
                  <Label className="font-bold">Optie A</Label>
                </div>
                <Input
                  value={editedQuestion.options.a}
                  onChange={(e) =>
                    setEditedQuestion({
                      ...editedQuestion,
                      options: { ...editedQuestion.options, a: e.target.value },
                    })
                  }
                  placeholder={editedQuestion.optionImages?.a ? "(afbeelding)" : "Antwoord A"}
                  disabled={!!editedQuestion.optionImages?.a}
                />
              </div>

              <div className="flex items-start gap-2">
                <div className="flex items-center gap-2 min-w-[100px]">
                  <input
                    type="radio"
                    name="correct"
                    checked={editedQuestion.correct === "b"}
                    onChange={() => setEditedQuestion({ ...editedQuestion, correct: "b" })}
                    className="w-4 h-4"
                  />
                  <Label className="font-bold">Optie B</Label>
                </div>
                <Input
                  value={editedQuestion.options.b}
                  onChange={(e) =>
                    setEditedQuestion({
                      ...editedQuestion,
                      options: { ...editedQuestion.options, b: e.target.value },
                    })
                  }
                  placeholder={editedQuestion.optionImages?.b ? "(afbeelding)" : "Antwoord B"}
                  disabled={!!editedQuestion.optionImages?.b}
                />
              </div>

              <div className="flex items-start gap-2">
                <div className="flex items-center gap-2 min-w-[100px]">
                  <input
                    type="radio"
                    name="correct"
                    checked={editedQuestion.correct === "c"}
                    onChange={() => setEditedQuestion({ ...editedQuestion, correct: "c" })}
                    className="w-4 h-4"
                  />
                  <Label className="font-bold">Optie C</Label>
                </div>
                <Input
                  value={editedQuestion.options.c}
                  onChange={(e) =>
                    setEditedQuestion({
                      ...editedQuestion,
                      options: { ...editedQuestion.options, c: e.target.value },
                    })
                  }
                  placeholder={editedQuestion.optionImages?.c ? "(afbeelding)" : "Antwoord C"}
                  disabled={!!editedQuestion.optionImages?.c}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Live Preview</h3>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Vraag #{editedQuestion.id}</p>
                  <p className="text-lg font-medium">{editedQuestion.question}</p>
                </div>

                {editedQuestion.image && (
                  <div className="flex justify-center p-4 bg-muted rounded-lg border">
                    <img
                      src={editedQuestion.image || "/placeholder.svg"}
                      alt="Vraag afbeelding"
                      className="max-w-full max-h-48 object-contain"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  {["a", "b", "c"].map((option) => {
                    const isCorrect = editedQuestion.correct === option
                    const hasImage = editedQuestion.optionImages?.[option as "a" | "b" | "c"]
                    const text = editedQuestion.options[option as "a" | "b" | "c"]

                    return (
                      <div
                        key={option}
                        className={`p-4 border rounded-lg ${isCorrect ? "bg-green-50 border-green-500" : "bg-background"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold uppercase">{option}</span>
                          {hasImage ? (
                            <div className="flex items-center gap-2">
                              <img
                                src={hasImage || "/placeholder.svg"}
                                alt={`Antwoord ${option}`}
                                className="max-h-24 object-contain"
                              />
                            </div>
                          ) : (
                            <span>{text}</span>
                          )}
                          {isCorrect && (
                            <span className="ml-auto text-xs bg-green-600 text-white px-2 py-1 rounded">Correct</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end border-t pt-6">
            <Button variant="outline" onClick={onClose}>
              Annuleren
            </Button>
            <Button onClick={handleSave}>Opslaan</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
