"use client"

import { useState, memo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Upload } from "lucide-react"

interface ManualQuestionData {
  question: string
  questionImage: string
  optionA: string
  optionAImage: string
  optionB: string
  optionBImage: string
  optionC: string
  optionCImage: string
  optionD: string
  optionDImage: string
  correct: "a" | "b" | "c" | "d"
  reeks: string
}

interface ManualQuestionFormProps {
  data: ManualQuestionData
  availableReeksOptions: string[]
  availableQuestionSets: Array<{ id: string; name: string }>
  onDataChange: (data: ManualQuestionData) => void
  onSave: () => void
  onCancel: () => void
}

export const ManualQuestionForm = memo(function ManualQuestionForm({
  data,
  availableReeksOptions,
  availableQuestionSets,
  onDataChange,
  onSave,
  onCancel,
}: ManualQuestionFormProps) {
  const [uploading, setUploading] = useState<string | null>(null)

  const updateField = (field: keyof ManualQuestionData, value: any) => {
    onDataChange({ ...data, [field]: value })
  }

  const handleImageUpload = async (field: keyof ManualQuestionData, file: File) => {
    setUploading(field)
    try {
      // Create a data URL for local preview
      const reader = new FileReader()
      reader.onload = (e) => {
        updateField(field, e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(null)
    }
  }

  const removeImage = (field: keyof ManualQuestionData) => {
    updateField(field, "")
  }

  const optionBadgeClass = (option: string) => {
    const isCorrect = data.correct === option
    return `flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm transition-colors cursor-pointer ${
      isCorrect ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
    }`
  }

  return (
    <div className="space-y-6">
      {/* Reeks Selection */}
      <div className="space-y-2">
        <Label htmlFor="new-question-reeks">Reeks *</Label>
        {availableReeksOptions.length > 0 ? (
          <div className="space-y-2">
            <Select
              value={data.reeks}
              onValueChange={(value) => {
                if (value === "custom") {
                  updateField("reeks", "")
                } else {
                  updateField("reeks", value)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kies een reeks" />
              </SelectTrigger>
              <SelectContent>
                {availableReeksOptions.map((reeksId) => {
                  const set = availableQuestionSets.find((s) => s.id === reeksId)
                  const displayName = set ? set.name : `Reeks ${reeksId}`
                  return (
                    <SelectItem key={reeksId} value={reeksId}>
                      {displayName}
                    </SelectItem>
                  )
                })}
                <SelectItem value="custom">Nieuwe reeks...</SelectItem>
              </SelectContent>
            </Select>
            {!availableReeksOptions.includes(data.reeks) && (
              <Input
                id="new-question-reeks"
                placeholder="Nieuwe reeks naam/nummer"
                value={data.reeks}
                onChange={(e) => updateField("reeks", e.target.value)}
              />
            )}
          </div>
        ) : (
          <Input
            id="new-question-reeks"
            placeholder="Reeks naam/nummer (bv: 1, 2, 3...)"
            value={data.reeks}
            onChange={(e) => updateField("reeks", e.target.value)}
          />
        )}
      </div>

      {/* Question Text */}
      <div className="space-y-2">
        <Label htmlFor="new-question-text">Vraag *</Label>
        <Textarea
          id="new-question-text"
          value={data.question}
          onChange={(e) => updateField("question", e.target.value)}
          placeholder="Typ hier de vraag..."
          className="w-full min-h-[100px] resize-y"
          required
        />
      </div>

      {/* Question Image */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Vraag afbeelding (optioneel)</Label>
        {data.questionImage ? (
          <div className="relative">
            <img
              src={data.questionImage || "/placeholder.svg"}
              alt="Vraag preview"
              className="max-h-32 rounded border object-contain"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => removeImage("questionImage")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading === "questionImage"}
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = "image/*"
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) handleImageUpload("questionImage", file)
              }
              input.click()
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Afbeelding uploaden
          </Button>
        )}
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        {(["A", "B", "C", "D"] as const).map((option) => {
          const optionKey = `option${option}` as keyof ManualQuestionData
          const imageKey = `option${option}Image` as keyof ManualQuestionData
          const isOptional = option === "D"

          return (
            <div key={option} className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className={optionBadgeClass(option.toLowerCase())}
                  onClick={() => updateField("correct", option.toLowerCase() as "a" | "b" | "c" | "d")}
                >
                  {option}
                </div>
                <Label>
                  Optie {option} {isOptional && "(optioneel)"}
                </Label>
              </div>
              <Textarea
                value={data[optionKey] as string}
                onChange={(e) => updateField(optionKey, e.target.value)}
                placeholder={`Antwoord optie ${option}`}
                className="w-full min-h-[60px] resize-y"
                required={!isOptional}
              />
              {data[imageKey] ? (
                <div className="relative">
                  <img
                    src={(data[imageKey] as string) || "/placeholder.svg"}
                    alt={`Optie ${option} preview`}
                    className="max-h-24 rounded border object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1"
                    onClick={() => removeImage(imageKey)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading === imageKey}
                  onClick={() => {
                    const input = document.createElement("input")
                    input.type = "file"
                    input.accept = "image/*"
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) handleImageUpload(imageKey, file)
                    }
                    input.click()
                  }}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Afbeelding
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuleren
        </Button>
        <Button type="button" onClick={onSave}>
          Vraag Opslaan
        </Button>
      </div>
    </div>
  )
})
