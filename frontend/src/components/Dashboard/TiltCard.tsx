import { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

interface Props {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  intensity?: number
  onClick?: () => void
}

export default function TiltCard({ children, className = '', style, intensity = 4, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  const x = useSpring(rawX, { stiffness: 300, damping: 30 })
  const y = useSpring(rawY, { stiffness: 300, damping: 30 })

  const rotateY = useTransform(x, [-0.5, 0.5], [-intensity, intensity])
  const rotateX = useTransform(y, [-0.5, 0.5], [intensity, -intensity])
  const glareX = useTransform(x, [-0.5, 0.5], ['0%', '100%'])
  const glareY = useTransform(y, [-0.5, 0.5], ['0%', '100%'])
  const glareOpacity = useSpring(0, { stiffness: 300, damping: 30 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    rawX.set((e.clientX - rect.left) / rect.width - 0.5)
    rawY.set((e.clientY - rect.top) / rect.height - 0.5)
    glareOpacity.set(0.06)
  }

  const handleMouseLeave = () => {
    rawX.set(0)
    rawY.set(0)
    glareOpacity.set(0)
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        position: 'relative',
        cursor: onClick ? 'pointer' : undefined,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ scale: { duration: 0.15 } }}
    >
      {children}
      <motion.div
        style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
          background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.15), transparent 60%)`,
          opacity: glareOpacity,
          zIndex: 1,
        }}
      />
    </motion.div>
  )
}
