"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "./supabase"
import type { User } from "@supabase/supabase-js"

export const TOKEN_COOKIE = "supabase_auth_token"

function parseCookies(): Record<string, string> {
  if (typeof document === "undefined") return {}
  return document.cookie
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const idx = pair.indexOf("=")
      if (idx === -1) return acc
      const key = decodeURIComponent(pair.slice(0, idx))
      const val = decodeURIComponent(pair.slice(idx + 1))
      acc[key] = val
      return acc
    }, {} as Record<string, string>)
}

export function getToken(): string | null {
  const cookies = parseCookies()
  return cookies[TOKEN_COOKIE] ?? null
}

export function setToken(token: string, remember = false): void {
  if (typeof document === "undefined") return
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8 // 30d or 8h in seconds
  document.cookie =
    `${encodeURIComponent(TOKEN_COOKIE)}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}

export function clearToken(): void {
  if (typeof document === "undefined") return
  document.cookie = `${encodeURIComponent(TOKEN_COOKIE)}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)

  // Initialize from cookie on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const currentToken = getToken()
      setTokenState(currentToken)
      
      console.log("Auth state:", { token: currentToken ? "present" : "missing" })

      if (currentToken) {
        // Verify the token with Supabase
        const { data, error } = await supabase.auth.getUser(currentToken)
        if (!error && data.user) {
          setUser(data.user)
          console.log("User authenticated:", data.user.email)
        } else {
          console.log("Token invalid, clearing auth state")
          clearToken()
          setTokenState(null)
        }
      }
    }
    
    initializeAuth()
    
    // Set up interval to check for token changes
    const id = setInterval(() => {
      const current = getToken()
      setTokenState((prev) => (prev !== current ? current : prev))
    }, 2000)
    
    return () => clearInterval(id)
  }, [])

  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user])

  const login = useCallback(async (email: string, password: string, remember = false) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("Login error:", error)
        return { success: false, error: error.message }
      }

      if (data.session?.access_token) {
        setToken(data.session.access_token, remember)
        setTokenState(data.session.access_token)
        setUser(data.user)
        
        try {
          window.sessionStorage.setItem("user_email", email)
          window.sessionStorage.setItem("user_id", data.user?.id || "")
        } catch {
          // ignore
        }
        
        console.log("Login successful:", email)
        return { success: true }
      }
      
      return { success: false, error: "No session token received" }
    } catch (error) {
      console.error("Login exception:", error)
      return { success: false, error: "An unexpected error occurred" }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      clearToken()
      setTokenState(null)
      setUser(null)
      try {
        window.sessionStorage.removeItem("user_email")
        window.sessionStorage.removeItem("user_id")
      } catch {
        // ignore
      }
      console.log("Logout successful")
    }
  }, [])

  return { token, user, isAuthenticated, login, logout }
}