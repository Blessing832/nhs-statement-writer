'use client'
import { createContext, useContext } from 'react'

interface AdminContextValue {
  token: string
  onLogout: () => void
}

export const AdminContext = createContext<AdminContextValue>({
  token: '',
  onLogout: () => {},
})

export function useAdminToken(): AdminContextValue {
  return useContext(AdminContext)
}
