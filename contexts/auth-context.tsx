"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { checkUsernameExists, createUser, verifyPassword, userHasPassword } from "@/lib/firebase-service"

interface AuthContextType {
  username: string | null
  loading: boolean
  isAnonymous: boolean
  signIn: (username: string, password: string, isNewUser: boolean) => Promise<void>
  signInAnonymously: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextType>({
  username: null,
  loading: true,
  isAnonymous: false,
  signIn: async () => {},
  signInAnonymously: () => {},
  signOut: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAnonymous, setIsAnonymous] = useState(false)

  useEffect(() => {
    const anonymousMode = localStorage.getItem("quiz_anonymous")
    if (anonymousMode === "true") {
      setIsAnonymous(true)
      setUsername("Anoniem")
    } else {
      const storedUsername = localStorage.getItem("quiz_username")
      if (storedUsername) {
        setUsername(storedUsername)
      }
    }
    setLoading(false)
  }, [])

  const signIn = async (username: string, password: string, isNewUser: boolean) => {
    try {
      const exists = await checkUsernameExists(username)

      if (isNewUser) {
        if (exists) {
          throw new Error("Deze gebruikersnaam is al in gebruik. Kies een andere naam.")
        }
        await createUser(username, password)
      } else {
        if (!exists) {
          throw new Error("Gebruikersnaam niet gevonden.")
        }

        const hasPassword = await userHasPassword(username)
        if (!hasPassword) {
          throw new Error("LEGACY_USER_NO_PASSWORD")
        }

        const isValid = await verifyPassword(username, password)
        if (!isValid) {
          throw new Error("Verkeerd wachtwoord.")
        }
      }

      localStorage.setItem("quiz_username", username)
      localStorage.removeItem("quiz_anonymous")
      setUsername(username)
      setIsAnonymous(false)
    } catch (error) {
      console.error("[v0] Error in signIn:", error)
      throw error
    }
  }

  const signInAnonymously = () => {
    localStorage.setItem("quiz_anonymous", "true")
    localStorage.removeItem("quiz_username")
    setUsername("Anoniem")
    setIsAnonymous(true)
  }

  const signOut = () => {
    localStorage.removeItem("quiz_username")
    localStorage.removeItem("quiz_anonymous")
    setUsername(null)
    setIsAnonymous(false)
  }

  return (
    <AuthContext.Provider value={{ username, loading, isAnonymous, signIn, signInAnonymously, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
