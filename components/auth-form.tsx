"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogIn, UserPlus, KeyRound } from "lucide-react"
import { setPasswordForUser } from "@/lib/firebase-service"

export function AuthForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isNewUser, setIsNewUser] = useState(false)
  const [isMigrationMode, setIsMigrationMode] = useState(false)
  const [migrationUsername, setMigrationUsername] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { signIn, signInAnonymously } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (username.trim().length < 3) {
        setError("Gebruikersnaam moet minimaal 3 tekens bevatten")
        setLoading(false)
        return
      }

      if (password.trim().length < 6) {
        setError("Wachtwoord moet minimaal 6 tekens bevatten")
        setLoading(false)
        return
      }

      if (isMigrationMode) {
        if (password !== confirmPassword) {
          setError("Wachtwoorden komen niet overeen")
          setLoading(false)
          return
        }
        await setPasswordForUser(migrationUsername, password)
        await signIn(migrationUsername, password, false)
        setIsMigrationMode(false)
        setMigrationUsername("")
        setConfirmPassword("")
        return
      }

      await signIn(username.trim(), password.trim(), isNewUser)
    } catch (err: any) {
      console.error("[v0] Error in handleSubmit:", err)

      if (err.message === "LEGACY_USER_NO_PASSWORD") {
        setIsMigrationMode(true)
        setMigrationUsername(username.trim())
        setPassword("")
        setConfirmPassword("")
        setError("")
        setLoading(false)
        return
      }

      setError(err.message || "Er is iets misgegaan")
    } finally {
      setLoading(false)
    }
  }

  const handleAnonymous = () => {
    signInAnonymously()
  }

  if (isMigrationMode) {
    return (
      <Card className="border-2 max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <KeyRound className="w-6 h-6" />
            Wachtwoord Instellen
          </CardTitle>
          <CardDescription>
            Welkom terug, {migrationUsername}! Stel een wachtwoord in om je account te beveiligen.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nieuw Wachtwoord</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimaal 6 tekens"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bevestig Wachtwoord</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Herhaal je wachtwoord"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Bezig..." : "Wachtwoord Instellen & Inloggen"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsMigrationMode(false)
                setMigrationUsername("")
                setPassword("")
                setConfirmPassword("")
                setError("")
              }}
              variant="ghost"
              className="w-full"
              size="sm"
            >
              Annuleren
            </Button>
          </CardFooter>
        </form>
      </Card>
    )
  }

  return (
    <Card className="border-2 max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{isNewUser ? "Registreren" : "Inloggen"}</CardTitle>
        <CardDescription>
          {isNewUser ? "Maak een account aan om je voortgang bij te houden" : "Log in om verder te gaan met oefenen"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Gebruikersnaam</Label>
            <Input
              id="username"
              type="text"
              placeholder="Jouw gebruikersnaam"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Wachtwoord</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimaal 6 tekens"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              "Bezig..."
            ) : isNewUser ? (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Registreren
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Inloggen
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setIsNewUser(!isNewUser)
              setError("")
            }}
            variant="ghost"
            className="w-full"
            size="sm"
          >
            {isNewUser ? "Al een account? Log in" : "Nog geen account? Registreer"}
          </Button>
          <Button type="button" onClick={handleAnonymous} variant="outline" className="w-full bg-transparent" size="lg">
            Anoniem Oefenen (geen statistieken)
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
