"use client"

import { useEffect } from "react"

export function Confetti() {
  useEffect(() => {
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)

      // Create confetti particles
      const particles = Array.from({ length: Math.floor(particleCount) }).map(() => ({
        x: Math.random() * window.innerWidth,
        y: -10,
        color: ["#ff6b35", "#f7931e", "#fdc830", "#37b24d", "#1971c2"][Math.floor(Math.random() * 5)],
        rotation: Math.random() * 360,
        velocity: randomInRange(2, 5),
      }))

      // Simple confetti animation using DOM
      particles.forEach((particle) => {
        const el = document.createElement("div")
        el.style.position = "fixed"
        el.style.left = particle.x + "px"
        el.style.top = particle.y + "px"
        el.style.width = "10px"
        el.style.height = "10px"
        el.style.backgroundColor = particle.color
        el.style.transform = `rotate(${particle.rotation}deg)`
        el.style.pointerEvents = "none"
        el.style.zIndex = "9999"
        document.body.appendChild(el)

        setTimeout(() => el.remove(), 3000)
      })
    }, 250)

    return () => clearInterval(interval)
  }, [])

  return null
}
