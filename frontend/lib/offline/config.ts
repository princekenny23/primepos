export type OfflinePhase = 0 | 1 | 2 | 3 | 4

const rawEnabled = process.env.NEXT_PUBLIC_OFFLINE_MODE_ENABLED || "false"
const rawPhase = process.env.NEXT_PUBLIC_OFFLINE_MODE_PHASE || "0"

const phaseNum = Number(rawPhase)
const normalizedPhase: OfflinePhase =
  phaseNum === 1 ? 1 :
  phaseNum === 2 ? 2 :
  phaseNum === 3 ? 3 :
  phaseNum === 4 ? 4 : 0

export const offlineConfig = {
  enabled: rawEnabled.toLowerCase() === "true",
  phase: normalizedPhase,
  isPhaseAtLeast(target: OfflinePhase) {
    return this.enabled && this.phase >= target
  },
}
