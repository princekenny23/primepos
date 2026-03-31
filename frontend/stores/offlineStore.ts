import { create } from "zustand"

interface OfflineState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  deadLetterCount: number
  lastSyncAt: string | null
  lastSyncError: string | null
  setOnline: (isOnline: boolean) => void
  setSyncing: (isSyncing: boolean) => void
  setPendingCount: (count: number) => void
  setDeadLetterCount: (count: number) => void
  setLastSyncAt: (isoTime: string | null) => void
  setLastSyncError: (message: string | null) => void
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  deadLetterCount: 0,
  lastSyncAt: null,
  lastSyncError: null,
  setOnline: (isOnline: boolean) => set({ isOnline }),
  setSyncing: (isSyncing: boolean) => set({ isSyncing }),
  setPendingCount: (pendingCount: number) => set({ pendingCount }),
  setDeadLetterCount: (deadLetterCount: number) => set({ deadLetterCount }),
  setLastSyncAt: (lastSyncAt: string | null) => set({ lastSyncAt }),
  setLastSyncError: (lastSyncError: string | null) => set({ lastSyncError }),
}))
