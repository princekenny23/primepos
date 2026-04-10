// Zustand Store for Authentication
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { User } from "@/lib/types"
import { authService } from "@/lib/services/authService"

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      
      login: async (identifier: string, password: string) => {
        set({ isLoading: true })
        
        try {
          // Use real API for login
          console.log("Using real API for login")
          const response = await authService.login(identifier, password)
          console.log("Login successful, setting user state")
          set({ 
            user: response.user, 
            isAuthenticated: true,
            isLoading: false 
          })
          return { success: true, user: response.user }
        } catch (error: any) {
          set({ isLoading: false })
          return { 
            success: false, 
            error: error.message || "Login failed. Please check your credentials." 
          }
        }
      },
      
      logout: async () => {
        try {
          // Always try to logout from API if token exists
          const hasToken = typeof window !== "undefined" && !!localStorage.getItem("authToken")
          if (hasToken) {
            await authService.logout()
          }
        } catch (error) {
          console.error("Logout error:", error)
        } finally {
          // Clear all auth data
          set({ user: null, isAuthenticated: false })
          if (typeof window !== "undefined") {
            localStorage.removeItem("authToken")
            localStorage.removeItem("refreshToken")
            localStorage.removeItem("currentOutletId")
            localStorage.removeItem("primepos-auth")
            localStorage.removeItem("primepos-business")
          }
        }
      },
      
      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user })
      },
      
      refreshUser: async () => {
        try {
          const user = await authService.getCurrentUser()
          set({ user, isAuthenticated: true })
        } catch (error) {
          console.error("Failed to refresh user:", error)
          set({ user: null, isAuthenticated: false })
        }
      },
    }),
    {
      name: "primepos-auth",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

