export function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}
