"use client"

import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface CategoryEditFormProps {
  initialName: string
  initialDescription: string
  initialIcon: string
  onSave: (name: string, description: string, iconFile: File | null, iconPreview: string) => void
  onCancel: () => void
}

export function CategoryEditForm({
  initialName,
  initialDescription,
  initialIcon,
  onSave,
  onCancel,
}: CategoryEditFormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState(initialIcon)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleIconUpload = (file: File | null) => {
    if (file) {
      setIconFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setIconPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 flex-shrink-0 border rounded flex items-center justify-center bg-muted">
          {iconPreview ? (
            <img
              src={iconPreview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-xs text-muted-foreground">Icon</span>
          )}
        </div>
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleIconUpload(e.target.files?.[0] || null)}
            className="hidden"
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <span>Icoon Kiezen</span>
          </Button>
        </label>
      </div>
      <div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="max-w-md"
          placeholder="Categorie naam"
          autoFocus
        />
      </div>
      <div>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="max-w-md"
          placeholder="Beschrijving"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => onSave(name, description, iconFile, iconPreview)} size="sm">
          Opslaan
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          size="sm"
        >
          Annuleer
        </Button>
      </div>
    </div>
  )
}
