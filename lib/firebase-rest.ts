// Firebase Realtime Database REST API wrapper
// Dit omzeilt het "Service database is not available" probleem in v0's preview

const DATABASE_URL = "https://oefenvragen-examen-radar-default-rtdb.europe-west1.firebasedatabase.app"

export async function firebaseGet(path: string): Promise<any> {
  const response = await fetch(`${DATABASE_URL}/${path}.json`)
  if (!response.ok) {
    throw new Error(`Firebase GET failed: ${response.statusText}`)
  }
  return response.json()
}

export async function firebaseSet(path: string, data: any): Promise<void> {
  const response = await fetch(`${DATABASE_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error(`Firebase SET failed: ${response.statusText}`)
  }
}

export async function firebaseUpdate(path: string, data: any): Promise<void> {
  const response = await fetch(`${DATABASE_URL}/${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error(`Firebase UPDATE failed: ${response.statusText}`)
  }
}

export async function firebaseRemove(path: string): Promise<void> {
  const response = await fetch(`${DATABASE_URL}/${path}.json`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error(`Firebase DELETE failed: ${response.statusText}`)
  }
}

export async function firebasePush(path: string, data: any): Promise<string> {
  const response = await fetch(`${DATABASE_URL}/${path}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error(`Firebase PUSH failed: ${response.statusText}`)
  }
  const result = await response.json()
  return result.name // Returns the generated key
}
