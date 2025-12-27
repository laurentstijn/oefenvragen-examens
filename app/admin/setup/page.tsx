"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ref, set, get } from "firebase/database"
import { database } from "@/lib/firebase-config"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function AdminSetupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [hasAdmins, setHasAdmins] = useState<boolean | null>(null)

  useEffect(() => {
    checkAdminsExist()
  }, [])

  const checkAdminsExist = async () => {
    try {
      const adminsRef = ref(database, "admins")
      const snapshot = await get(adminsRef)
      setHasAdmins(snapshot.exists())
    } catch (error) {
      console.error("Error checking admins:", error)
      setHasAdmins(false)
    }
  }

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const emailKey = email.replace(/\./g, ",")
      const adminRef = ref(database, `admins/${emailKey}`)

      await set(adminRef, true)

      setSuccess(`Admin toegang succesvol toegevoegd voor ${email}!`)
      setTimeout(() => {
        router.push("/admin/login")
      }, 2000)
    } catch (error: any) {
      console.error("Setup error:", error)
      setError(error.message || "Er is een fout opgetreden bij het toevoegen van admin toegang.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Admin Setup</CardTitle>
          <CardDescription className="text-center">Voeg de eerste admin toe aan het systeem</CardDescription>
        </CardHeader>
        <CardContent>
          {hasAdmins === true && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Er zijn al admins in het systeem. Je kunt meer admins toevoegen via het admin panel.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-500 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSetupAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Bezig met toevoegen..." : "Admin Toevoegen"}
            </Button>

            <Button type="button" variant="outline" className="w-full bg-transparent" onClick={() => router.push("/")}>
              Terug naar home
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg text-sm space-y-2">
            <p className="font-semibold">Let op:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Zorg dat de Firebase Database rules correct zijn ingesteld</li>
              <li>Het email adres moet een geldig Firebase Authentication account hebben</li>
              <li>Na setup kun je inloggen via /admin/login</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
