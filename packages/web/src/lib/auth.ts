import axios from 'axios'
import Cookies from 'js-cookie'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gearshelf.io'

// Create axios instance with defaults
const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = Cookies.get('refreshToken')
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE}/api/auth/refresh`, {
            refreshToken
          })
          
          const { accessToken, refreshToken: newRefreshToken } = response.data.tokens
          
          // Update cookies
          Cookies.set('accessToken', accessToken, { expires: 1 }) // 1 day
          Cookies.set('refreshToken', newRefreshToken, { expires: 7 }) // 7 days
          
          // Retry original request
          error.config.headers.Authorization = `Bearer ${accessToken}`
          return api.request(error.config)
        } catch (refreshError) {
          // Refresh failed, logout user
          logout()
          window.location.href = '/login'
        }
      } else {
        // No refresh token, logout user
        logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export interface User {
  id: number
  email: string
  name: string
  role: 'user' | 'admin' | 'moderator'
  is_verified: boolean
  is_active: boolean
  avatar_url?: string
  bio?: string
  created_at: string
  updated_at: string
  stats?: {
    collection_count: number
    review_count: number
  }
}

export interface AuthResponse {
  user: User
  tokens: {
    accessToken: string
    refreshToken: string
    expiresIn: string
  }
  message?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
}

// Authentication functions
export const authAPI = {
  // Register new user
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post('/auth/register', data)
    const { user, tokens } = response.data
    
    // Store tokens in cookies
    Cookies.set('accessToken', tokens.accessToken, { expires: 1 })
    Cookies.set('refreshToken', tokens.refreshToken, { expires: 7 })
    
    return response.data
  },

  // Login user
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post('/auth/login', credentials)
    const { user, tokens } = response.data
    
    // Store tokens in cookies
    Cookies.set('accessToken', tokens.accessToken, { expires: 1 })
    Cookies.set('refreshToken', tokens.refreshToken, { expires: 7 })
    
    return response.data
  },

  // Get current user
  async getMe(): Promise<{ user: User }> {
    const response = await api.get('/auth/me')
    return response.data
  },

  // Logout user
  async logout(): Promise<void> {
    const refreshToken = Cookies.get('refreshToken')
    
    try {
      await api.post('/auth/logout', { refreshToken })
    } catch (error) {
      // Ignore logout errors
    }
    
    // Clear cookies
    Cookies.remove('accessToken')
    Cookies.remove('refreshToken')
  },

  // Refresh token
  async refreshToken(): Promise<AuthResponse['tokens']> {
    const refreshToken = Cookies.get('refreshToken')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }
    
    const response = await api.post('/auth/refresh', { refreshToken })
    const { tokens } = response.data
    
    // Update cookies
    Cookies.set('accessToken', tokens.accessToken, { expires: 1 })
    Cookies.set('refreshToken', tokens.refreshToken, { expires: 7 })
    
    return tokens
  }
}

// Utility functions
export const logout = () => {
  Cookies.remove('accessToken')
  Cookies.remove('refreshToken')
}

export const getAccessToken = () => {
  return Cookies.get('accessToken')
}

export const isAuthenticated = () => {
  return !!getAccessToken()
}

export default api