"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { initializeApp } from "firebase/app"
import { getDatabase, type Database } from "firebase/database"
import { getAuth, type Auth } from "firebase/auth"
import { setFirebaseInstances } from "@/lib/firebase-config"

const firebaseConfig = {
  apiKey: "AIzaSyDwsqbuGfrXq8nBkAFgLMBiFL3mX1mh42U",
  authDomain: "oefenvragen-examen-radar.firebaseapp.com",
  databaseURL: "https://oefenvragen-examen-radar-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "oefenvragen-examen-radar",
  storageBucket: "oefenvragen-examen-radar.firebasestorage.app",
  messagingSenderId: "679293434638",
  appId: "1:679293434638:web:b8a2239a0ac1e22960b55f",
}

interface FirebaseContextType {
  database: Database | null
  auth: Auth | null
  isConnected: boolean
  error: string | null
}

const FirebaseContext = createContext<FirebaseContextType>({
  database: null,
  auth: null,
  isConnected: false,
  error: null,
})

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [state, setFirebase] = useState<FirebaseContextType>({
    database: null,
    auth: null,
    isConnected: false,
    error: null,
  })

  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig)
      const database = getDatabase(app)
      const auth = getAuth(app)

      setFirebaseInstances(database, auth)

      setFirebase({
        database,
        auth,
        isConnected: true,
        error: null,
      })
    } catch (error) {
      setFirebase({
        database: null,
        auth: null,
        isConnected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }, [])

  return <FirebaseContext.Provider value={state}>{children}</FirebaseContext.Provider>
}

export const useFirebase = () => useContext(FirebaseContext)
