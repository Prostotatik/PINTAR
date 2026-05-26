import { useEffect, useRef } from 'react'

interface Dot {
  x: number
  y: number
  ox: number
  oy: number
  r: number
  alpha: number
  baseAlpha: number
}

const DOT_COUNT = 80
const MOUSE_RADIUS = 150

function initDots(width: number, height: number): Dot[] {
  return Array.from({ length: DOT_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    ox: 0,
    oy: 0,
    r: 1.5 + Math.random(),
    baseAlpha: 0.12 + Math.random() * 0.18,
    alpha: 0.12,
  }))
}

export function ChatBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const dotsRef = useRef<Dot[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width = w
      canvas.height = h
      dotsRef.current = initDots(w, h)
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const { x: mx, y: my } = mouseRef.current

      for (const dot of dotsRef.current) {
        const cx = dot.x + dot.ox
        const cy = dot.y + dot.oy
        const dx = mx - cx
        const dy = my - cy
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < MOUSE_RADIUS && dist > 0) {
          const strength = (1 - dist / MOUSE_RADIUS)
          // Repel dots away from mouse
          dot.ox += (-dx / dist) * strength * 0.8
          dot.oy += (-dy / dist) * strength * 0.8
          dot.alpha = Math.min(0.75, dot.baseAlpha + strength * 0.6)
        } else {
          dot.alpha += (dot.baseAlpha - dot.alpha) * 0.06
        }

        // Spring back to base position
        dot.ox *= 0.88
        dot.oy *= 0.88

        ctx.beginPath()
        ctx.arc(dot.x + dot.ox, dot.y + dot.oy, dot.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(99,102,241,${dot.alpha.toFixed(3)})`
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    resize()
    animate()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function onMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="chat-bg" />
}
