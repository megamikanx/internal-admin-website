const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString() ?? "http://localhost:8000"

export type User = {
  user_id: number
  admin_status: boolean
  nickname: string
  name: string
  email: string
  team: TeamValue
}

export type UserUpdatePayload = {
  nickname?: string
  name?: string
  email?: string
}

export type UserCreatePayload = {
  nickname: string
  name: string
  email: string
  password: string
  team: TeamValue
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
}

async function apiRequest<T>(
  path: string,
  { body, headers, ...init }: ApiRequestOptions = {}
): Promise<T> {
  const resolvedHeaders = new Headers(headers)
  resolvedHeaders.set("Accept", "application/json")

  let resolvedBody: BodyInit | undefined
  if (body !== undefined) {
    if (!resolvedHeaders.has("Content-Type")) {
      resolvedHeaders.set("Content-Type", "application/json")
    }
    resolvedBody = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: resolvedHeaders,
    body: resolvedBody,
    credentials: "include",
  })

  if (response.ok) {
    if (response.status === 204) {
      return undefined as T
    }
    const text = await response.text()
    if (!text) {
      return undefined as T
    }
    return JSON.parse(text) as T
  }

  let message = response.statusText || "Request failed"
  try {
    const data = (await response.json()) as {
      detail?: string | Array<{ loc?: Array<string | number>; msg?: string }>
    }
    if (Array.isArray(data?.detail)) {
      const details = data.detail
      const hasField = (field: string) =>
        details.some((item) => item.loc?.includes(field))
      if (hasField("nickname")) {
        message = "닉네임이 올바르지 않습니다."
      } else if (hasField("name")) {
        message = "이름이 올바르지 않습니다."
      } else if (hasField("email")) {
        message = "이메일이 올바르지 않습니다."
      } else if (details[0]?.msg) {
        message = details[0].msg
      }
    } else if (typeof data?.detail === "string") {
      message = data.detail
    }
  } catch {
    // ignore JSON parsing errors
  }

  message = message.replace(/^[A-Za-z][A-Za-z\s]*[:,-]\s*/g, "")
  message = message.replace(/^[A-Za-z][A-Za-z\s]*\s*/g, "")
  const error = new Error(message) as Error & { status?: number }
  error.status = response.status
  throw error
}

export async function login(email: string, password: string): Promise<void> {
  await apiRequest<void>("/auth/login", {
    method: "POST",
    body: { email: email.trim(), password: password.trim() },
  })
}

export async function getMe(): Promise<User> {
  return apiRequest<User>("/auth/me")
}

export async function logout(): Promise<void> {
  await apiRequest<void>("/auth/logout", { method: "POST" })
}

export async function updateUser(payload: UserUpdatePayload): Promise<User> {
  return apiRequest<User>("/users/me", {
    method: "PATCH",
    body: payload,
  })
}

export async function updateUserTeam(
  userId: number,
  team: TeamValue
): Promise<User> {
  return apiRequest<User>(`/users/${userId}`, {
    method: "PATCH",
    body: { team },
  })
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiRequest<void>("/users/me/password", {
    method: "POST",
    body: {
      current_password: currentPassword.trim(),
      new_password: newPassword.trim(),
    },
  })
}

export async function getUsers(): Promise<User[]> {
  return apiRequest<User[]>("/users")
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  return apiRequest<User>("/users", {
    method: "POST",
    body: payload,
  })
}

export async function deleteUser(userId: number): Promise<void> {
  await apiRequest<void>(`/users/${userId}`, { method: "DELETE" })
}

export async function promoteUser(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}/promote`, { method: "POST" })
}

export async function demoteUser(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}/demote`, { method: "POST" })
}

export async function resetUserPassword(userId: number): Promise<User> {
  return apiRequest<User>(`/users/${userId}/reset-password`, { method: "POST" })
}

export type DrinkOrder = {
  order_id: number
  user_id?: number
  drink_name: string
  product_url: string
  status: "pending" | "approved" | "rejected"
  reviewed_by: number | null
  reviewed_by_name?: string | null
  submitted_at?: string | null
  reason?: string | null
}

export async function getDrinkOrders(): Promise<DrinkOrder[]> {
  return apiRequest<DrinkOrder[]>("/drink-orders")
}

export async function getMyDrinkOrders(): Promise<DrinkOrder[]> {
  return apiRequest<DrinkOrder[]>("/drink-orders/me")
}

export type DrinkOrderCreatePayload = {
  drink_name: string
  product_url: string
}

export async function createDrinkOrder(
  payload: DrinkOrderCreatePayload
): Promise<DrinkOrder> {
  return apiRequest<DrinkOrder>("/drink-orders", {
    method: "POST",
    body: payload,
  })
}

export async function cancelDrinkOrder(orderId: number): Promise<void> {
  await apiRequest<void>(`/drink-orders/${orderId}`, { method: "DELETE" })
}

export async function approveDrinkOrder(orderId: number): Promise<DrinkOrder> {
  return apiRequest<DrinkOrder>(`/drink-orders/${orderId}/approve`, {
    method: "PATCH",
  })
}

export async function rejectDrinkOrder(
  orderId: number,
  reason?: string
): Promise<void> {
  await apiRequest<void>(`/drink-orders/${orderId}/reject`, {
    method: "POST",
    body: { reason },
  })
}

export type Room = {
  room_id: number
  building: string
  floor: number
  room_name: string
  capacity: number
  color_hue: number | null
}

export async function getRooms(): Promise<Room[]> {
  return apiRequest<Room[]>("/rooms")
}

export type RoomCreatePayload = {
  building: string
  floor: number
  room_name: string
  capacity: number
}

export async function createRoom(payload: RoomCreatePayload): Promise<Room> {
  return apiRequest<Room>("/rooms", {
    method: "POST",
    body: payload,
  })
}

export type RoomDeletePayload = {
  building: string
  floor: number
  room_name: string
  capacity: number
}

export async function deleteRoom(payload: RoomDeletePayload): Promise<void> {
  await apiRequest<void>("/rooms/delete", {
    method: "POST",
    body: {
      building: payload.building.trim(),
      floor: payload.floor,
      room_name: payload.room_name.trim(),
    },
  })
}

export async function searchUsers(query: string): Promise<User[]> {
  return apiRequest<User[]>(`/users/search?query=${encodeURIComponent(query)}`)
}

export type Meeting = {
  reservation_id: number
  user_id: number
  title: string
  notes?: string | null
  start_at: string
  end_at: string
  location?: string | null
  google_last_synced_at?: string | null
  google_sync_status?: string | null
}

export type MeetingDetail = Meeting & {
  attendees: User[]
}

export type MeetingCreatePayload = {
  title: string
  notes?: string
  start_at: string
  end_at: string
  location: string
}

export type MeetingUpdatePayload = {
  title?: string
  notes?: string
  start_at?: string
  end_at?: string
  location?: string
}

export type MeetingCancel = {
  location: string
  start_at: string
}

export type TeamValue = "DEV" | "DATA" | "PRODUCT" | "CS" | "OPS"

export type MeetingAttendeeTeamResponse = {
  overlapping_attendees: string[]
}

export async function getMyMeetings(): Promise<Meeting[]> {
  return apiRequest<Meeting[]>("/meetings/me/upcoming")
}

export async function getMeetings(): Promise<Meeting[]> {
  return apiRequest<Meeting[]>("/meetings")
}

export async function createMeeting(
  payload: MeetingCreatePayload
): Promise<Meeting> {
  return apiRequest<Meeting>("/meetings", {
    method: "POST",
    body: payload,
  })
}

export async function updateMeeting(
  reservationId: number,
  payload: MeetingUpdatePayload
): Promise<Meeting> {
  return apiRequest<Meeting>(`/meetings/${reservationId}`, {
    method: "PATCH",
    body: payload,
  })
}

export async function cancelMeeting(payload: MeetingCancel): Promise<void> {
  await apiRequest<void>("/meetings/cancel", {
    method: "POST",
    body: payload,
  })
}

export async function getMeetingDetail(
  reservationId: number
): Promise<MeetingDetail> {
  return apiRequest<MeetingDetail>(`/meetings/${reservationId}/detail`)
}

export type MeetingAttendeePayload = {
  nickname?: string
  name?: string
  email?: string
}

export async function addMeetingAttendee(
  reservationId: number,
  payload: MeetingAttendeePayload
): Promise<void> {
  await apiRequest<void>(`/meetings/${reservationId}/attendees`, {
    method: "POST",
    body: payload,
  })
}

export async function removeMeetingAttendee(
  reservationId: number,
  payload: MeetingAttendeePayload
): Promise<void> {
  await apiRequest<void>(`/meetings/${reservationId}/attendees/remove`, {
    method: "POST",
    body: payload,
  })
}

export async function addMeetingAttendeesByTeam(
  reservationId: number,
  team: TeamValue
): Promise<MeetingAttendeeTeamResponse> {
  return apiRequest<MeetingAttendeeTeamResponse>(
    `/meetings/${reservationId}/attendees/team`,
    {
      method: "POST",
      body: { team },
    }
  )
}

export async function syncGoogleCalendar(): Promise<{ synced_at: string }> {
  return apiRequest<{ synced_at: string }>("/auth/google/sync", {
    method: "POST",
  })
}

export async function getGoogleSyncStatus(): Promise<{ last_synced_at: string | null }> {
  return apiRequest<{ last_synced_at: string | null }>("/auth/google/sync/status")
}
