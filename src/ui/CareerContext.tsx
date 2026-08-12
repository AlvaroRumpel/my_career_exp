import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Career } from '../engine/types'
import { loadCareer, saveCareer, clearCareer } from '../storage'

interface Ctx {
  career: Career | null
  update: (fn: (c: Career) => void) => void
  create: (career: Career) => void
  reset: () => void
}

const CareerCtx = createContext<Ctx | null>(null)

export function CareerProvider({ children }: { children: ReactNode }) {
  const [career, setCareer] = useState<Career | null>(() => loadCareer())
  const persist = (c: Career | null) => { setCareer(c); if (c) saveCareer(c) }
  return (
    <CareerCtx.Provider value={{
      career,
      update: fn => {
        if (!career) return
        const copy = structuredClone(career)
        fn(copy)
        persist(copy)
      },
      create: c => persist(c),
      reset: () => { clearCareer(); setCareer(null) },
    }}>
      {children}
    </CareerCtx.Provider>
  )
}

export function useCareer(): Ctx {
  const ctx = useContext(CareerCtx)
  if (!ctx) throw new Error('useCareer fora do CareerProvider')
  return ctx
}
