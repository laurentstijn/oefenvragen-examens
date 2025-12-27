"use client"

import { useState, useEffect } from "react"
import { getAllAdminEmails, addAdminEmail, removeAdminEmail } from "@/lib/firebase-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Mail } from "lucide-react"

export function AdminEmailManager() {
  const [adminEmails, setAdminEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadAdminEmails()
  }, [])

  const loadAdminEmails = async () => {
    try {
      const emails = await getAllAdminEmails()
      setAdminEmails(emails)
    } catch (error) {
      console.error("[v0] Error loading admin emails:", error)
    }
  }

  const handleAddEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast({
        title: "Ongeldig email",
        description: "Voer een geldig email adres in",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      await addAdminEmail(newEmail.trim().toLowerCase())
      await loadAdminEmails()
      setNewEmail("")
      toast({
        title: "Admin toegevoegd",
        description: `${newEmail} heeft nu admin toegang`,
      })
    } catch (error) {
      console.error("[v0] Error adding admin email:", error)
      toast({
        title: "Fout",
        description: "Kon admin email niet toevoegen",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveEmail = async (email: string) => {
    if (!confirm(`Weet je zeker dat je admin toegang wilt verwijderen voor ${email}?`)) {
      return
    }

    setIsLoading(true)
    try {
      await removeAdminEmail(email)
      await loadAdminEmails()
      toast({
        title: "Admin verwijderd",
        description: `${email} heeft geen admin toegang meer`,
      })
    } catch (error) {
      console.error("[v0] Error removing admin email:", error)
      toast({
        title: "Fout",
        description: "Kon admin email niet verwijderen",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Toegang Beheer</CardTitle>
        <CardDescription>Voeg emails toe of verwijder ze om admin toegang te beheren</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="new-admin-email" className="sr-only">
              Email adres
            </Label>
            <Input
              id="new-admin-email"
              type="email"
              placeholder="admin@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
              disabled={isLoading}
            />
          </div>
          <Button onClick={handleAddEmail} disabled={isLoading}>
            <Plus className="w-4 h-4 mr-2" />
            Toevoegen
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Huidige Admins ({adminEmails.length})</Label>
          {adminEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Geen admins gevonden</p>
          ) : (
            <div className="space-y-2">
              {adminEmails.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveEmail(email)}
                    disabled={isLoading}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
