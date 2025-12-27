"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/lib/firebase-config"
import { checkAdminAccess } from "@/lib/firebase-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Lock } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      if (!user.email) {
        throw new Error("Geen email gevonden")
      }

      // Check if user is an admin
      const isAdmin = await checkAdminAccess(user.email)

      if (!isAdmin) {
        await auth.signOut()
        setError("Je hebt geen admin toegang. Neem contact op met de beheerder.")
        setIsLoading(false)
        return
      }

      // Success - redirect to admin panel
      toast({
        title: "Succesvol ingelogd",
        description: "Je wordt doorgestuurd naar het admin panel...",
      })

      router.push("/admin")
    } catch (error: any) {
      console.error("[v0] Admin login error:", error)

      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        setError("Onjuiste email of wachtwoord")
      } else if (error.code === "auth/user-not-found") {
        setError("Geen account gevonden met dit email adres")
      } else if (error.code === "auth/invalid-email") {
        setError("Ongeldig email adres")
      } else if (error.code === "auth/too-many-requests") {
        setError("Te veel login pogingen. Probeer het later opnieuw.")
      } else {
        setError(error.message || "Er is een fout opgetreden bij het inloggen")
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Log in met je admin email en wachtwoord</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                placeholder="Voer je wachtwoord in"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Inloggen..." : "Inloggen"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button variant="link" onClick={() => router.push("/")} className="text-sm text-muted-foreground">
              Terug naar home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
