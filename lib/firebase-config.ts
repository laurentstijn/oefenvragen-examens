import { initializeApp, getApps, getApp } from "firebase/app"
import { getDatabase, type Database } from "firebase/database"
import { getAuth, type Auth } from "firebase/auth"

export const firebaseConfig = {
  apiKey: "AIzaSyDwsqbuGfrXq8nBkAFgLMBiFL3mX1mh42U",
  authDomain: "oefenvragen-examen-radar.firebaseapp.com",
  databaseURL: "https://oefenvragen-examen-radar-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "oefenvragen-examen-radar",
  storageBucket: "oefenvragen-examen-radar.firebasestorage.app",
  messagingSenderId: "679293434638",
  appId: "1:679293434638:web:b8a2239a0ac1e22960b55f",
}

let _db: Database | null = null
let _auth: Auth | null = null
let _initialized = false

function initializeFirebase() {
  if (_initialized) return
  if (typeof window === "undefined") return
  
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    _db = getDatabase(app)
    _auth = getAuth(app)
    _initialized = true
  } catch {
    // SDK initialization failed - REST API will be used as fallback
    // This is expected in v0 preview environment
  }
}

// Initialize on first import (client-side only)
if (typeof window !== "undefined") {
  initializeFirebase()
}

export function setFirebaseInstances(database: Database | null, authInstance: Auth | null) {
  _db = database
  _auth = authInstance
  _initialized = true
}

export function getDB(): Database | null {
  if (!_initialized && typeof window !== "undefined") {
    initializeFirebase()
  }
  return _db
}

export function getFirebaseAuth(): Auth | null {
  if (!_initialized && typeof window !== "undefined") {
    initializeFirebase()
  }
  return _auth
}

export const db = _db
export const database = _db
export const auth = _auth
