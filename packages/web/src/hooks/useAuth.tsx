'use client'

import { useState, useEffect, useContext, createContext, ReactNode } from 'react'
import { User, authAPI, isAuthenticated } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      if (isAuthenticated()) {
        try {
          const { user } = await authAPI.getMe()
          setUser(user)
        } catch (error) {
          console.error('Failed to get user:', error)
          // Clear invalid tokens
          await authAPI.logout()
        }
      }
      setIsLoading(false)
    }

    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await authAPI.login({ email, password })
      setUser(response.user)
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed'
      setError(message)
      throw new Error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await authAPI.register({ email, password, name })
      setUser(response.user)
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed'
      setError(message)
      throw new Error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    
    try {
      await authAPI.logout()
      setUser(null)
    } catch (error) {
      console.error('Logout error:', error)
      // Clear user anyway
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshUser = async () => {
    if (!isAuthenticated()) return
    
    try {
      const { user } = await authAPI.getMe()
      setUser(user)
    } catch (error) {
      console.error('Failed to refresh user:', error)
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}