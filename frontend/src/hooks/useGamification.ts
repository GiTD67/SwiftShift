import { useState, useEffect, useCallback } from 'react'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt?: string
}

interface GamificationState {
  xp: number
  level: number
  streak: number
  lastSubmittedPeriod: string | null
  achievements: Achievement[]
  totalHoursLogged: number
  nlpUseCount: number
}

const ACHIEVEMENTS_CATALOG: Omit<Achievement, 'unlockedAt'>[] = [
  { id: 'first_submit', name: 'First Timer', description: 'Submit your first timesheet', icon: '🎯' },
  { id: 'overtime_warrior', name: 'Overtime Warrior', description: 'Log overtime hours in a period', icon: '⚡' },
  { id: 'speed_logger', name: 'Speed Logger', description: 'Use natural language to log hours', icon: '💬' },
  { id: 'perfect_period', name: 'Perfect Period', description: 'Log exactly 80 hours in a pay period', icon: '💎' },
  { id: 'three_peat', name: 'Hat Trick', description: 'Submit 3 pay periods in a row', icon: '🔥' },
  { id: 'marathon', name: 'Marathon', description: 'Log 10+ hours in a single day', icon: '🏃' },
  { id: 'consistency', name: 'Consistency', description: 'Log hours for all 5 weekdays in a week', icon: '⭐' },
  { id: 'century', name: 'Century Club', description: 'Accumulate 100+ total hours logged', icon: '💯' },
  { id: 'level5', name: 'Level 5', description: 'Reach level 5', icon: '🏅' },
  { id: 'level10', name: 'Legend', description: 'Reach level 10', icon: '👑' },
]

const XP_PER_LEVEL = 100
const STORAGE_KEY = 'swiftshift-gamification'

function computeLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1
}

export function useGamification() {
  const [state, setState] = useState<GamificationState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return {
      xp: 0,
      level: 1,
      streak: 0,
      lastSubmittedPeriod: null,
      achievements: [],
      totalHoursLogged: 0,
      nlpUseCount: 0,
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const unlockAchievement = useCallback((id: string): Achievement | null => {
    const catalog = ACHIEVEMENTS_CATALOG.find(a => a.id === id)
    if (!catalog) return null
    let newAchievement: Achievement | null = null
    setState(prev => {
      if (prev.achievements.some(a => a.id === id)) return prev
      newAchievement = { ...catalog, unlockedAt: new Date().toISOString() }
      return { ...prev, achievements: [...prev.achievements, newAchievement!] }
    })
    return newAchievement
  }, [])

  const addXP = useCallback((amount: number, context?: {
    hoursAdded?: number
    isOT?: boolean
    isSubmit?: boolean
    isDraft?: boolean
    isNLP?: boolean
    dayHours?: number[]
    periodId?: string
    totalPeriodHours?: number
    periodOvertimeHours?: number
  }): { gained: number; newAchievements: Achievement[]; leveledUp: boolean } => {
    const newAchievements: Achievement[] = []
    let bonusXP = amount
    let leveledUp = false

    setState(prev => {
      const ctx = context || {}
      let newXP = prev.xp + bonusXP
      let newStreak = prev.streak
      let newTotalHours = prev.totalHoursLogged + (ctx.hoursAdded || 0)
      let newNLPCount = prev.nlpUseCount + (ctx.isNLP ? 1 : 0)
      const updatedAchievements = [...prev.achievements]

      const tryUnlock = (id: string) => {
        const catalog = ACHIEVEMENTS_CATALOG.find(a => a.id === id)
        if (!catalog || updatedAchievements.some(a => a.id === id)) return
        const a: Achievement = { ...catalog, unlockedAt: new Date().toISOString() }
        updatedAchievements.push(a)
        newAchievements.push(a)
        newXP += 25 // bonus XP for achievement
      }

      if (ctx.isSubmit) {
        tryUnlock('first_submit')
        // Streak logic
        if (ctx.periodId && prev.lastSubmittedPeriod !== ctx.periodId) {
          newStreak = prev.streak + 1
          if (newStreak >= 3) tryUnlock('three_peat')
        }
      }

      if (ctx.isNLP && newNLPCount === 1) tryUnlock('speed_logger')

      if (ctx.isOT) tryUnlock('overtime_warrior')

      if (ctx.totalPeriodHours !== undefined && Math.abs(ctx.totalPeriodHours - 80) < 0.1) {
        tryUnlock('perfect_period')
      }

      if (ctx.dayHours) {
        if (ctx.dayHours.some(h => h >= 10)) tryUnlock('marathon')
        // Check weekday consistency: indices 0-4 or 7-11 all > 0
        const week1 = ctx.dayHours.slice(0, 5).every(h => h > 0)
        const week2 = ctx.dayHours.slice(7, 12).every(h => h > 0)
        if (week1 || week2) tryUnlock('consistency')
      }

      if (newTotalHours >= 100) tryUnlock('century')

      const newLevel = computeLevel(newXP)
      if (newLevel >= 5) tryUnlock('level5')
      if (newLevel >= 10) tryUnlock('level10')

      if (newLevel > prev.level) leveledUp = true

      return {
        ...prev,
        xp: newXP,
        level: newLevel,
        streak: newStreak,
        lastSubmittedPeriod: ctx.isSubmit && ctx.periodId ? ctx.periodId : prev.lastSubmittedPeriod,
        achievements: updatedAchievements,
        totalHoursLogged: newTotalHours,
        nlpUseCount: newNLPCount,
      }
    })

    return { gained: bonusXP, newAchievements, leveledUp }
  }, [unlockAchievement])

  const xpIntoLevel = state.xp % XP_PER_LEVEL
  const xpForNextLevel = XP_PER_LEVEL
  const progressPct = (xpIntoLevel / xpForNextLevel) * 100

  return {
    xp: state.xp,
    level: state.level,
    streak: state.streak,
    achievements: state.achievements,
    totalHoursLogged: state.totalHoursLogged,
    xpIntoLevel,
    xpForNextLevel,
    progressPct,
    addXP,
    allAchievements: ACHIEVEMENTS_CATALOG,
  }
}
