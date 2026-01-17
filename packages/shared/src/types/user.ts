export type UserRole = "admin" | "viewer"

export type User = {
  id: string
  email: string
  name: string | null
  role: UserRole
  createdAt?: string
}

export type AuthResponse = {
  user: User
  accessToken: string
  refreshToken: string
}
