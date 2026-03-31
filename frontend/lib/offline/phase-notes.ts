import { offlineConfig } from "@/lib/offline/config"

export function getOfflinePhaseSummary(): string {
  if (!offlineConfig.enabled || offlineConfig.phase === 0) {
    return "Offline mode is disabled."
  }
  if (offlineConfig.phase === 1) {
    return "Phase 1 enabled: read-only offline foundation (status + cache)."
  }
  if (offlineConfig.phase === 2) {
    return "Phase 2 enabled: outbox sync interfaces available."
  }
  if (offlineConfig.phase === 3) {
    return "Phase 3 enabled: inventory and shift sync rollout in progress."
  }
  return "Phase 4 enabled: hardening and operational controls."
}
