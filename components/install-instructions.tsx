"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Smartphone, X, MoreVertical, Share } from "lucide-react"

export function InstallInstructions() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if app is running in standalone mode (installed as PWA)
    const standalone = window.matchMedia("(display-mode: standalone)").matches
    setIsInstalled(standalone)

    // Check if user previously dismissed the instructions
    const dismissed = localStorage.getItem("installInstructionsDismissed")
    setIsDismissed(dismissed === "true")
  }, [])

  const handleDismiss = () => {
    localStorage.setItem("installInstructionsDismissed", "true")
    setIsDismissed(true)
    setIsOpen(false)
  }

  // Don't show if app is installed or user dismissed it
  if (isInstalled || isDismissed) {
    return null
  }

  if (!isOpen) {
    return (
      <div className="mb-4">
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="sm"
          className="w-full gap-2 bg-card/50 hover:bg-card"
        >
          <Smartphone className="w-4 h-4" />
          App installeren op je telefoon
        </Button>
      </div>
    )
  }

  return (
    <Card className="mb-4 border-2">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Installeer de app</h3>
          </div>
          <Button onClick={handleDismiss} variant="ghost" size="sm" className="h-6 w-6 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                i
              </span>
              iPhone / iPad (Safari)
            </h4>
            <ol className="space-y-1 pl-7 text-muted-foreground leading-relaxed">
              <li className="flex items-center gap-1">
                1. Tik op de <MoreVertical className="w-3.5 h-3.5 inline mx-0.5" /> (drie puntjes) rechtsonder in de
                toolbar
              </li>
              <li className="flex items-center gap-1">
                2. Tik op het deel-icoon <Share className="w-3.5 h-3.5 inline mx-0.5" /> (vierkant met pijl omhoog)
              </li>
              <li>3. Scroll in het menu en kies "Voeg toe aan beginscherm"</li>
              <li>4. Tik op "Voeg toe" rechtsboven om te bevestigen</li>
              <li>5. De app verschijnt nu als icoon op je beginscherm</li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                A
              </span>
              Android (Chrome)
            </h4>
            <ol className="space-y-1 pl-7 text-muted-foreground leading-relaxed">
              <li className="flex items-center gap-1">
                1. Tik op de <MoreVertical className="w-3.5 h-3.5 inline mx-0.5" /> (menu) knop rechtsboven
              </li>
              <li>2. Kies "App installeren" of "Toevoegen aan startscherm"</li>
              <li>3. Tik op "Installeren" of "Toevoegen"</li>
            </ol>
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t">
            Na installatie kun je de app gebruiken als een normale app op je telefoon!
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
