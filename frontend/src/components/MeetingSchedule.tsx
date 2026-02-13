import { useEffect, useMemo, useState } from "react"
import DatePicker, { type DatePickerProps } from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import {
  addMeetingAttendee,
  addMeetingAttendeesByTeam,
  cancelMeeting,
  createMeeting,
  getGoogleSyncStatus,
  getMeetingDetail,
  getMeetings,
  getMyMeetings,
  getRooms,
  removeMeetingAttendee,
  searchUsers,
  syncGoogleCalendar,
  updateMeeting,
  type TeamValue,
  type Meeting,
  type MeetingDetail,
  type Room,
  type User,
} from "../lib/api"
import type { ThemeMode } from "../types/theme"

function startOfWeekMonday(date: Date) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function formatTimeLabel(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const paddedHours = hours.toString().padStart(2, "0")
  const paddedMins = mins.toString().padStart(2, "0")
  return `${paddedHours}:${paddedMins}`
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function colorFromLocation(hue?: number, isDark = false) {
  const resolvedHue = hue ?? 220
  return {
    border: isDark
      ? `hsl(${resolvedHue} 70% 65% / 0.7)`
      : `hsl(${resolvedHue} 75% 45% / 0.75)`,
    bg: isDark
      ? `hsl(${resolvedHue} 60% 35% / 0.4)`
      : `hsl(${resolvedHue} 80% 50% / 0.32)`,
    text: isDark
      ? `hsl(${resolvedHue} 80% 92%)`
      : `hsl(${resolvedHue} 85% 20%)`,
  }
}

function formatRoomLocation(room: Room) {
  return `${room.building}-${room.floor}-${room.room_name} (${room.capacity})`
}

const TypedDatePicker = DatePicker as unknown as React.FC<DatePickerProps>

const TEAM_OPTIONS: Array<{
  value: TeamValue
  label: string
  aliases: string[]
}> = [
  { value: "DEV", label: "DEV", aliases: ["dev"] },
  { value: "DATA", label: "DATA", aliases: ["data"] },
  { value: "PRODUCT", label: "PRODUCT", aliases: ["product", "prod"] },
  {
    value: "CS",
    label: "CS",
    aliases: ["cs", "customer", "service", "customer service", "customer_service"],
  },
  { value: "OPS", label: "OPS", aliases: ["ops", "operations"] },
]

export default function MeetingSchedule({
  currentUser,
  isDark,
  theme,
}: {
  currentUser: User
  isDark: boolean
  theme: ThemeMode
}) {
  // 테마별 참석자 검색 하이라이트
  const attendeeHoverClass =
    theme === "dark"
      ? "hover:bg-slate-800"
      : theme === "pink"
        ? "hover:bg-[#FFB8F3]"
        : "hover:bg-[#DAB1FD]"
  // 화면 상태 관리
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeekMonday(new Date())
  )
  const [rooms, setRooms] = useState<Room[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isMeetingLoading, setIsMeetingLoading] = useState(false)
  const [meetingError, setMeetingError] = useState<string | null>(null)
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false)
  const [googleSyncError, setGoogleSyncError] = useState<string | null>(null)
  const [lastSyncOverride, setLastSyncOverride] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingNotes, setMeetingNotes] = useState("")
  const [meetingDate, setMeetingDate] = useState(() =>
    toDateKey(startOfWeekMonday(new Date()))
  )
  const [startHour, setStartHour] = useState("09")
  const [startMinute, setStartMinute] = useState("00")
  const [endHour, setEndHour] = useState("10")
  const [endMinute, setEndMinute] = useState("00")
  const [autoEndEnabled, setAutoEndEnabled] = useState(true)
  const [meetingLocation, setMeetingLocation] = useState("")
  const [meetingErrorMessage, setMeetingErrorMessage] = useState<string | null>(
    null
  )
  const [isSavingMeeting, setIsSavingMeeting] = useState(false)
  const [participantQuery, setParticipantQuery] = useState("")
  const [participantResults, setParticipantResults] = useState<User[]>([])
  const [selectedParticipants, setSelectedParticipants] = useState<User[]>([])
  const [selectedTeams, setSelectedTeams] = useState<TeamValue[]>([])
  const [originalParticipants, setOriginalParticipants] = useState<User[]>([])
  const [isSearchingParticipants, setIsSearchingParticipants] = useState(false)
  const [isMyMeetingsOpen, setIsMyMeetingsOpen] = useState(false)
  const [myMeetings, setMyMeetings] = useState<Meeting[]>([])
  const [isMyDeleteMode, setIsMyDeleteMode] = useState(false)
  const [pendingMyDelete, setPendingMyDelete] = useState<Meeting | null>(null)
  const [isDeletingMyMeeting, setIsDeletingMyMeeting] = useState(false)
  const [deleteMyMeetingError, setDeleteMyMeetingError] = useState<string | null>(
    null
  )
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [pendingDeleteMeeting, setPendingDeleteMeeting] = useState<Meeting | null>(
    null
  )
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false)
  const [deleteMeetingError, setDeleteMeetingError] = useState<string | null>(
    null
  )
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [summaryMeeting, setSummaryMeeting] = useState<MeetingDetail | null>(
    null
  )
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // 파생 데이터 계산
  const selectedMeetingDate = useMemo(() => {
    const [year, month, day] = meetingDate.split("-").map(Number)
    if (!year || !month || !day) {
      return new Date()
    }
    return new Date(year, month - 1, day)
  }, [meetingDate])

  const teamMatches = useMemo(() => {
    const normalized = participantQuery.trim().toLowerCase()
    if (!normalized) {
      return []
    }
    return TEAM_OPTIONS.filter((option) => {
      const label = option.label.toLowerCase()
      return (
        label.startsWith(normalized) ||
        option.aliases.some((alias) => alias.startsWith(normalized))
      )
    })
  }, [participantQuery])

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, index) => {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + index)
      return day
    })
  }, [weekStart])

  const timeSlots = useMemo(() => {
    const slots: number[] = []
    const startMinutes = 9 * 60
    const endMinutes = 20 * 60
    for (let minutes = startMinutes; minutes <= endMinutes; minutes += 30) {
      slots.push(minutes)
    }
    return slots
  }, [])

  const slotHeight = 32

  const monthLabel = useMemo(() => {
    const month = weekStart.getMonth() + 1
    const year = weekStart.getFullYear()
    return `${year}년 ${month}월`
  }, [weekStart])

  const lastSyncedAt = useMemo(() => {
    if (lastSyncOverride) {
      return new Date(lastSyncOverride)
    }
    const timestamps = meetings
      .map((meeting) => meeting.google_last_synced_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
    if (timestamps.length === 0) {
      return null
    }
    return new Date(Math.max(...timestamps))
  }, [lastSyncOverride, meetings])

  const upcomingMyMeetings = useMemo(() => {
    const now = new Date()
    const twoWeeksLater = new Date(now)
    twoWeeksLater.setDate(now.getDate() + 14)
    return myMeetings.filter((meeting) => {
      const start = new Date(meeting.start_at)
      return start >= now && start <= twoWeeksLater
    })
  }, [myMeetings])

  const summaryAttendees = useMemo(() => {
    if (!summaryMeeting) {
      return []
    }
    const attendees = summaryMeeting.attendees ?? []
    const alreadyIncluded = attendees.some(
      (attendee) => attendee.user_id === currentUser.user_id
    )
    const isHost = summaryMeeting.user_id === currentUser.user_id
    const isInMyMeetings = myMeetings.some(
      (meeting) => meeting.reservation_id === summaryMeeting.reservation_id
    )
    if ((isHost || isInMyMeetings) && !alreadyIncluded) {
      return [...attendees, currentUser]
    }
    return attendees
  }, [currentUser, myMeetings, summaryMeeting])

  type MeetingLayout = {
    meeting: Meeting
    columnIndex: number
    columnCount: number
  }

  const meetingBySlot = useMemo(() => {
    const map = new Map<string, MeetingLayout[]>()
    const meetingsByDay = new Map<string, Meeting[]>()

    meetings.forEach((meeting) => {
      const start = new Date(meeting.start_at)
      const dateKey = toDateKey(start)
      const existing = meetingsByDay.get(dateKey) ?? []
      existing.push(meeting)
      meetingsByDay.set(dateKey, existing)
    })

    const assignCluster = (dateKey: string, cluster: Meeting[]) => {
      if (cluster.length === 0) {
        return
      }
      const sorted = [...cluster].sort((a, b) => {
        const startA = new Date(a.start_at).getTime()
        const startB = new Date(b.start_at).getTime()
        if (startA !== startB) {
          return startA - startB
        }
        return new Date(a.end_at).getTime() - new Date(b.end_at).getTime()
      })

      const columnEndTimes: number[] = []
      const columnIndexMap = new Map<number, number>()

      sorted.forEach((meeting) => {
        const startTime = new Date(meeting.start_at).getTime()
        const endTime = new Date(meeting.end_at).getTime()
        let assignedIndex = columnEndTimes.findIndex(
          (columnEnd) => startTime >= columnEnd
        )
        if (assignedIndex === -1) {
          assignedIndex = columnEndTimes.length
          columnEndTimes.push(endTime)
        } else {
          columnEndTimes[assignedIndex] = endTime
        }
        columnIndexMap.set(meeting.reservation_id, assignedIndex)
      })

      const columnCount = columnEndTimes.length
      sorted.forEach((meeting) => {
        const start = new Date(meeting.start_at)
        const minutes = start.getHours() * 60 + start.getMinutes()
        const slotStartMinutes = Math.floor(minutes / 30) * 30
        const key = `${dateKey}-${slotStartMinutes}`
        const existing = map.get(key) ?? []
        existing.push({
          meeting,
          columnIndex: columnIndexMap.get(meeting.reservation_id) ?? 0,
          columnCount,
        })
        map.set(key, existing)
      })
    }

    meetingsByDay.forEach((dayMeetings, dateKey) => {
      const sorted = [...dayMeetings].sort((a, b) => {
        const startA = new Date(a.start_at).getTime()
        const startB = new Date(b.start_at).getTime()
        if (startA !== startB) {
          return startA - startB
        }
        return new Date(a.end_at).getTime() - new Date(b.end_at).getTime()
      })

      let cluster: Meeting[] = []
      let clusterEnd = 0
      sorted.forEach((meeting) => {
        const startTime = new Date(meeting.start_at).getTime()
        const endTime = new Date(meeting.end_at).getTime()
        if (cluster.length === 0) {
          cluster = [meeting]
          clusterEnd = endTime
          return
        }
        if (startTime < clusterEnd) {
          cluster.push(meeting)
          clusterEnd = Math.max(clusterEnd, endTime)
        } else {
          assignCluster(dateKey, cluster)
          cluster = [meeting]
          clusterEnd = endTime
        }
      })
      assignCluster(dateKey, cluster)
    })

    return map
  }, [meetings])

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) =>
      formatRoomLocation(a).localeCompare(formatRoomLocation(b), "ko")
    )
  }, [rooms])

  const locationColors = useMemo(() => {
    const map = new Map<string, number>()
    sortedRooms.forEach((room) => {
      const location = formatRoomLocation(room)
      map.set(
        location,
        room.color_hue !== null && room.color_hue !== undefined ? room.color_hue : 220
      )
    })
    return map
  }, [sortedRooms])

  // 데이터 로딩 함수
  const loadMeetings = async () => {
    setIsMeetingLoading(true)
    setMeetingError(null)
    try {
      const data = await getMeetings()
      setMeetings(data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "미팅을 불러오지 못했습니다."
      setMeetingError(message)
    } finally {
      setIsMeetingLoading(false)
    }
  }

  const loadRooms = async () => {
    try {
      const data = await getRooms()
      setRooms(data)
      if (!meetingLocation && data.length > 0) {
        setMeetingLocation(formatRoomLocation(data[0]))
      }
    } catch {
      // ignore room load errors for now
    }
  }

  const handleSyncGoogle = async () => {
    setGoogleSyncError(null)
    setIsSyncingGoogle(true)
    try {
      const result = await syncGoogleCalendar()
      setLastSyncOverride(result.synced_at)
      await loadMeetings()
      await loadRooms()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google 캘린더 동기화에 실패했습니다."
      setGoogleSyncError(message)
    } finally {
      setIsSyncingGoogle(false)
    }
  }

  // 초기 로딩 및 검색 효과
  useEffect(() => {
    loadRooms()
  }, [])

  useEffect(() => {
    loadMeetings()
  }, [])

  useEffect(() => {
    let isMounted = true
    const refreshStatus = async () => {
      try {
        const status = await getGoogleSyncStatus()
        if (isMounted) {
          setLastSyncOverride(status.last_synced_at ?? null)
        }
      } catch {
        // ignore sync status errors
      }
    }
    refreshStatus()
    const timer = window.setInterval(refreshStatus, 60_000)
    return () => {
      isMounted = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!participantQuery.trim()) {
      setParticipantResults([])
      return
    }

    let isMounted = true
    setIsSearchingParticipants(true)

    const timer = window.setTimeout(() => {
      searchUsers(participantQuery)
        .then((results) => {
          if (isMounted) {
            setParticipantResults(results)
          }
        })
        .catch(() => {
          if (isMounted) {
            setParticipantResults([])
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsSearchingParticipants(false)
          }
        })
    }, 300)

    return () => {
      isMounted = false
      window.clearTimeout(timer)
    }
  }, [participantQuery])

  // 화면 동작 핸들러
  const handlePrevWeek = () => {
    setWeekStart((prev) => {
      const next = new Date(prev)
      next.setDate(prev.getDate() - 7)
      return startOfWeekMonday(next)
    })
  }

  const handleNextWeek = () => {
    setWeekStart((prev) => {
      const next = new Date(prev)
      next.setDate(prev.getDate() + 7)
      return startOfWeekMonday(next)
    })
  }

  const handleOpenCreate = () => {
    setMeetingTitle("")
    setMeetingNotes("")
    setMeetingDate(toDateKey(new Date()))
    setStartHour("09")
    setStartMinute("00")
    setEndHour("10")
    setEndMinute("00")
    setAutoEndEnabled(true)
    setMeetingErrorMessage(null)
    setSelectedParticipants([])
    setParticipantQuery("")
    setParticipantResults([])
    setSelectedTeams([])
    setIsCreateOpen(true)
  }

  const handleOpenEdit = async (meeting: Meeting) => {
    setIsSummaryLoading(true)
    setSummaryError(null)
    try {
      const detail = await getMeetingDetail(meeting.reservation_id)
      if (meeting.user_id !== currentUser.user_id) {
        setSummaryMeeting(detail)
        setIsSummaryOpen(true)
        return
      }
      setSelectedParticipants(detail.attendees ?? [])
      setOriginalParticipants(detail.attendees ?? [])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "미팅 정보를 불러올 수 없습니다."
      setSummaryError(message)
      if (meeting.user_id !== currentUser.user_id) {
        setIsSummaryOpen(true)
        return
      }
    } finally {
      setIsSummaryLoading(false)
    }
    const start = new Date(meeting.start_at)
    const end = new Date(meeting.end_at)
    setWeekStart(startOfWeekMonday(start))
    setMeetingTitle(meeting.title)
    setMeetingNotes(meeting.notes ?? "")
    setMeetingDate(toDateKey(start))
    setStartHour(`${start.getHours()}`.padStart(2, "0"))
    setStartMinute(`${start.getMinutes()}`.padStart(2, "0"))
    setEndHour(`${end.getHours()}`.padStart(2, "0"))
    setEndMinute(`${end.getMinutes()}`.padStart(2, "0"))
    setMeetingLocation(meeting.location ?? "")
    setMeetingErrorMessage(null)
    setParticipantQuery("")
    setParticipantResults([])
    setAutoEndEnabled(false)
    setEditingMeeting(meeting)
    setSelectedTeams([])
    setIsEditOpen(true)
  }

  const handleOpenMyMeetings = async () => {
    setIsMeetingLoading(true)
    setMeetingError(null)
    try {
      const data = await getMyMeetings()
      setMyMeetings(data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "미팅을 불러오지 못했습니다."
      setMeetingError(message)
    } finally {
      setIsMeetingLoading(false)
    }
    setIsMyMeetingsOpen(true)
  }

  const handleCloseMyMeetings = () => {
    setIsMyMeetingsOpen(false)
    setIsMyDeleteMode(false)
    setPendingMyDelete(null)
    setDeleteMyMeetingError(null)
  }

  const handleToggleMyDeleteMode = () => {
    setIsMyDeleteMode((prev) => !prev)
    setDeleteMyMeetingError(null)
    setPendingMyDelete(null)
  }

  const handleCloseMyDelete = () => {
    if (isDeletingMyMeeting) {
      return
    }
    setPendingMyDelete(null)
    setDeleteMyMeetingError(null)
    setIsMyDeleteMode(false)
  }

  const handleToggleDeleteMode = () => {
    setIsDeleteMode((prev) => !prev)
    setDeleteMeetingError(null)
    setPendingDeleteMeeting(null)
  }

  const handleCloseDeleteMeeting = () => {
    if (isDeletingMeeting) {
      return
    }
    setPendingDeleteMeeting(null)
    setDeleteMeetingError(null)
    setIsDeleteMode(false)
  }

  const handleCloseCreate = () => {
    if (isSavingMeeting) {
      return
    }
    setIsCreateOpen(false)
    setMeetingErrorMessage(null)
    setSelectedTeams([])
  }

  const handleCloseEdit = () => {
    if (isSavingMeeting) {
      return
    }
    setIsEditOpen(false)
    setEditingMeeting(null)
    setMeetingErrorMessage(null)
    setOriginalParticipants([])
    setSelectedTeams([])
  }

  const handleCloseSummary = () => {
    setIsSummaryOpen(false)
    setSummaryMeeting(null)
    setSummaryError(null)
  }

  useEffect(() => {
    if (!autoEndEnabled) {
      return
    }
    const startTotalMinutes = Number(startHour) * 60 + Number(startMinute)
    const endTotalMinutes = startTotalMinutes + 60
    const endHourValue = Math.min(23, Math.floor(endTotalMinutes / 60))
    const endMinuteValue = endTotalMinutes % 60
    setEndHour(`${endHourValue}`.padStart(2, "0"))
    setEndMinute(`${endMinuteValue}`.padStart(2, "0"))
  }, [startHour, startMinute, autoEndEnabled])

  const handleAddParticipant = (participant: User) => {
    if (selectedParticipants.some((item) => item.user_id === participant.user_id)) {
      return
    }
    setSelectedParticipants((prev) => [...prev, participant])
    setParticipantQuery("")
    setParticipantResults([])
  }

  const handleRemoveParticipant = (userId: number) => {
    setSelectedParticipants((prev) =>
      prev.filter((participant) => participant.user_id !== userId)
    )
  }

  const handleRemoveTeam = (team: TeamValue) => {
    setSelectedTeams((prev) => prev.filter((item) => item !== team))
  }

  const handleAddTeam = async (team: TeamValue) => {
    if (editingMeeting) {
      try {
        const result = await addMeetingAttendeesByTeam(
          editingMeeting.reservation_id,
          team
        )
        if (result.overlapping_attendees.length > 0) {
          window.alert(
            `${result.overlapping_attendees.join(
              ", "
            )}은 이미 다른 미팅에 참석 중이라 추가되지 않았습니다.`
          )
        }
        const detail = await getMeetingDetail(editingMeeting.reservation_id)
        setSelectedParticipants(detail.attendees ?? [])
        setOriginalParticipants(detail.attendees ?? [])
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "팀 참석자를 추가할 수 없습니다."
        setMeetingErrorMessage(message)
      } finally {
        setParticipantQuery("")
        setParticipantResults([])
      }
      return
    }

    setSelectedTeams((prev) => (prev.includes(team) ? prev : [...prev, team]))
    setParticipantQuery("")
    setParticipantResults([])
  }

  const handleSubmitMeeting = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setMeetingErrorMessage(null)

    if (!meetingTitle.trim() || !meetingLocation) {
      setMeetingErrorMessage("제목과 위치를 입력하세요.")
      return
    }

    const [year, month, day] = meetingDate.split("-").map(Number)
    const startDate = new Date(
      year,
      month - 1,
      day,
      Number(startHour),
      Number(startMinute)
    )
    const endDate = new Date(
      year,
      month - 1,
      day,
      Number(endHour),
      Number(endMinute)
    )

    if (startDate >= endDate) {
      setMeetingErrorMessage("시작 시간은 종료 시간보다 이전이어야 합니다.")
      return
    }

    setIsSavingMeeting(true)
    try {
      const meeting = await createMeeting({
        title: meetingTitle.trim(),
        notes: meetingNotes.trim(),
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        location: meetingLocation,
      })
      for (const participant of selectedParticipants) {
        await addMeetingAttendee(meeting.reservation_id, {
          email: participant.email,
        })
      }
      const overlappingAttendees: string[] = []
      for (const team of selectedTeams) {
        const result = await addMeetingAttendeesByTeam(
          meeting.reservation_id,
          team
        )
        overlappingAttendees.push(...result.overlapping_attendees)
      }
      if (overlappingAttendees.length > 0) {
        window.alert(
          `${overlappingAttendees.join(
            ", "
          )}은 이미 다른 미팅에 참석 중이라 추가되지 않았습니다.`
        )
      }
      await loadMeetings()
      setIsCreateOpen(false)
      setSelectedTeams([])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "미팅을 생성할 수 없습니다."
      setMeetingErrorMessage(message)
    } finally {
      setIsSavingMeeting(false)
    }
  }

  const handleSubmitEdit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    if (!editingMeeting) {
      return
    }
    setMeetingErrorMessage(null)

    if (!meetingTitle.trim() || !meetingLocation) {
      setMeetingErrorMessage("제목과 위치를 입력하세요.")
      return
    }

    const [year, month, day] = meetingDate.split("-").map(Number)
    const startDate = new Date(
      year,
      month - 1,
      day,
      Number(startHour),
      Number(startMinute)
    )
    const endDate = new Date(
      year,
      month - 1,
      day,
      Number(endHour),
      Number(endMinute)
    )

    if (startDate >= endDate) {
      setMeetingErrorMessage("시작 시간은 종료 시간보다 이전이어야 합니다.")
      return
    }

    setIsSavingMeeting(true)
    try {
      await updateMeeting(editingMeeting.reservation_id, {
        title: meetingTitle.trim(),
        notes: meetingNotes.trim(),
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        location: meetingLocation,
      })
      const selectedIds = new Set(
        selectedParticipants.map((participant) => participant.user_id)
      )
      const originalIds = new Set(
        originalParticipants.map((participant) => participant.user_id)
      )
      const toAdd = selectedParticipants.filter(
        (participant) => !originalIds.has(participant.user_id)
      )
      const toRemove = originalParticipants.filter(
        (participant) => !selectedIds.has(participant.user_id)
      )
      for (const participant of toRemove) {
        await removeMeetingAttendee(editingMeeting.reservation_id, {
          email: participant.email,
        })
      }
      for (const participant of toAdd) {
        await addMeetingAttendee(editingMeeting.reservation_id, {
          email: participant.email,
        })
      }
      const overlappingAttendees: string[] = []
      for (const team of selectedTeams) {
        const result = await addMeetingAttendeesByTeam(
          editingMeeting.reservation_id,
          team
        )
        overlappingAttendees.push(...result.overlapping_attendees)
      }
      if (overlappingAttendees.length > 0) {
        window.alert(
          `${overlappingAttendees.join(
            ", "
          )}은 이미 다른 미팅에 참석 중이라 추가되지 않았습니다.`
        )
      }
      await loadMeetings()
      setIsEditOpen(false)
      setEditingMeeting(null)
      setOriginalParticipants([])
      setSelectedTeams([])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "미팅을 수정할 수 없습니다."
      setMeetingErrorMessage(message)
    } finally {
      setIsSavingMeeting(false)
    }
  }

  const handleConfirmDeleteMeeting = async () => {
    if (!pendingDeleteMeeting) {
      return
    }
    if (!pendingDeleteMeeting.location) {
      setDeleteMeetingError("회의실 정보를 찾을 수 없습니다.")
      return
    }
    setIsDeletingMeeting(true)
    setDeleteMeetingError(null)
    try {
      await cancelMeeting({
        location: pendingDeleteMeeting.location,
        start_at: pendingDeleteMeeting.start_at,
      })
      await loadMeetings()
      setPendingDeleteMeeting(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "미팅을 삭제할 수 없습니다."
      setDeleteMeetingError(message)
    } finally {
      setIsDeletingMeeting(false)
    }
  }

  const refreshMyMeetings = async () => {
    try {
      const data = await getMyMeetings()
      setMyMeetings(data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "미팅을 불러오지 못했습니다."
      setMeetingError(message)
    }
  }

  const handleConfirmDeleteMyMeeting = async () => {
    if (!pendingMyDelete) {
      return
    }
    if (!pendingMyDelete.location) {
      setDeleteMyMeetingError("회의실 정보를 찾을 수 없습니다.")
      return
    }
    setIsDeletingMyMeeting(true)
    setDeleteMyMeetingError(null)
    try {
      await cancelMeeting({
        location: pendingMyDelete.location,
        start_at: pendingMyDelete.start_at,
      })
      await loadMeetings()
      await refreshMyMeetings()
      setPendingMyDelete(null)
      setIsMyDeleteMode(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "미팅을 삭제할 수 없습니다."
      setDeleteMyMeetingError(message)
    } finally {
      setIsDeletingMyMeeting(false)
    }
  }

  // 화면 렌더링
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            회의 일정
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{monthLabel}</h1>
          {isMeetingLoading ? (
            <p className="mt-1 text-xs text-slate-500">불러오는 중...</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            마지막 동기화:{" "}
            {lastSyncedAt
              ? lastSyncedAt.toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "동기화 기록 없음"}
          </p>
          {googleSyncError ? (
            <p className="mt-1 text-xs text-[#FF6363]">{googleSyncError}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncGoogle}
            disabled={isSyncingGoogle}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncingGoogle ? "동기화 중..." : "Google 동기화"}
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF]"
          >
            + 새 미팅
          </button>
          <button
            type="button"
            onClick={handleToggleDeleteMode}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              isDeleteMode ? "bg-[#FF4242]" : "bg-[#FF6363] hover:bg-[#FF4242]"
            }`}
          >
            - 미팅 삭제
          </button>
          <button
            type="button"
            onClick={handleOpenMyMeetings}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white"
          >
            내 미팅
          </button>
          <button
            type="button"
            onClick={handlePrevWeek}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-indigo-400 hover:text-white"
            aria-label="이전 주"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={handleNextWeek}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-indigo-400 hover:text-white"
            aria-label="다음 주"
          >
            ▶
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60">
        {meetingError ? (
          <div className="px-4 py-3 text-sm text-[#FF6363]">{meetingError}</div>
        ) : null}
        <div className="overflow-x-auto">
          <div className="w-full">
            <div className="grid grid-cols-[56px_repeat(5,minmax(0,1fr))] border-b border-slate-800 text-slate-300">
              <div className="px-2 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                시간
              </div>
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="px-3 py-3">
                  <div className="text-[11px] text-slate-400">
                    {day.toLocaleDateString("en-US", { weekday: "long" })}
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-100">
                    {day.getDate()}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[56px_repeat(5,minmax(0,1fr))]">
              {timeSlots.map((minutes) => {
                const isLastSlot = minutes === timeSlots[timeSlots.length - 1]
                const borderClass = isLastSlot
                  ? ""
                  : isDark
                    ? "border-slate-800"
                    : "border-slate-800/60"
                return (
                <div
                  key={`row-${minutes}`}
                  className={`contents ${borderClass ? "border-b" : ""} ${borderClass}`}
                >
                  <div
                    className={`px-2 text-xs text-slate-500 ${
                      borderClass ? `border-b ${borderClass}` : ""
                    }`}
                    style={{ height: slotHeight }}
                  >
                    {formatTimeLabel(minutes)}
                  </div>
                  {weekDays.map((day) => {
                    const dateKey = toDateKey(day)
                    const slotKey = `${dateKey}-${minutes}`
                    const slotMeetings = meetingBySlot.get(slotKey) ?? []
                    return (
                      <div
                        key={`${day.toISOString()}-${minutes}`}
                        className={`relative overflow-visible px-2 ${
                          borderClass ? `border-b ${borderClass}` : ""
                        }`}
                        style={{ height: slotHeight }}
                      >
                        {slotMeetings.length > 0 ? (
                          <div
                            className="absolute left-1 right-1 top-1 overflow-visible"
                            style={{
                              height: slotMeetings.reduce((maxHeight, slot) => {
                                const start = new Date(slot.meeting.start_at)
                                const end = new Date(slot.meeting.end_at)
                                const startMinutes =
                                  start.getHours() * 60 + start.getMinutes()
                                const durationMinutes =
                                  (end.getTime() - start.getTime()) / 60000
                                const offsetMinutes = Math.max(
                                  0,
                                  startMinutes - minutes
                                )
                                const height =
                                  (durationMinutes / 30) * slotHeight - 6
                                const resolvedHeight = Math.max(8, height)
                                const bottom =
                                  (offsetMinutes / 30) * slotHeight +
                                  resolvedHeight
                                return Math.max(maxHeight, bottom)
                              }, 0),
                            }}
                          >
                            {slotMeetings.map((slot) => {
                              const meeting = slot.meeting
                              const hue = meeting.location
                                ? locationColors.get(meeting.location)
                                : undefined
                              const colors = colorFromLocation(hue, isDark)
                              const start = new Date(meeting.start_at)
                              const end = new Date(meeting.end_at)
                              const startMinutes =
                                start.getHours() * 60 + start.getMinutes()
                              const durationMinutes =
                                (end.getTime() - start.getTime()) / 60000
                              const offsetMinutes = Math.max(
                                0,
                                startMinutes - minutes
                              )
                              const height = (durationMinutes / 30) * slotHeight - 6
                              const resolvedHeight = Math.max(8, height)
                              const columnWidth = 100 / slot.columnCount
                              const columnGutter = 4
                              const shouldShowTooltip = durationMinutes <= 30
                              return (
                                <div
                                  key={meeting.reservation_id}
                                  className="absolute z-20 group"
                                  style={{
                                    height: resolvedHeight,
                                    top: (offsetMinutes / 30) * slotHeight,
                                    width: `calc(${columnWidth}% - ${columnGutter}px)`,
                                    left: `calc(${slot.columnIndex * columnWidth}% + ${
                                      columnGutter / 2
                                    }px)`,
                                  }}
                                  title={meeting.location ?? ""}
                                  onDoubleClick={() => handleOpenEdit(meeting)}
                                  onClick={() => {
                                    if (
                                      isDeleteMode &&
                                      meeting.user_id === currentUser.user_id
                                    ) {
                                      setPendingDeleteMeeting(meeting)
                                    }
                                  }}
                                >
                                  {shouldShowTooltip ? (
                                    <div
                                      className={`pointer-events-none absolute left-0 right-0 -top-6 z-50 hidden rounded-md border px-2 py-1 text-[10px] shadow-lg group-hover:block ${
                                        theme === "pink"
                                          ? "border-[#FF8FEA] bg-[#FFB8F3] text-[#3B0A2E]"
                                          : theme === "dark"
                                            ? "border-slate-800 bg-slate-950/95 text-slate-100"
                                            : "border-[#D6C6FF] bg-[#E8DAFF] text-[#2C1A4A]"
                                      }`}
                                    >
                                      {meeting.title}
                                    </div>
                                  ) : null}
                                  <div
                                    className={`relative h-full min-w-0 overflow-hidden rounded-md border px-2 py-1 text-xs ${
                                      isDeleteMode &&
                                      meeting.user_id === currentUser.user_id
                                        ? "cursor-pointer ring-1 ring-rose-400/60 hover:ring-2"
                                        : ""
                                    }`}
                                    style={{
                                      borderColor: colors.border,
                                      backgroundColor: colors.bg,
                                      color: colors.text,
                                    }}
                                  >
                                  <button
                                    type="button"
                                    onDoubleClick={() => handleOpenEdit(meeting)}
                                    className="absolute inset-0 cursor-pointer"
                                    aria-label="미팅 수정"
                                  />
                                  {meeting.user_id === currentUser.user_id ? (
                                    <span className="pointer-events-none absolute right-2 top-2 h-2 w-2 rounded-full bg-[#F741C1]" />
                                  ) : null}
                                  <div className="truncate font-semibold">
                                    {meeting.title}
                                  </div>
                                  <div className="truncate text-[11px]">
                                    {new Date(meeting.start_at).toLocaleTimeString(
                                      "en-US",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: false,
                                      }
                                    )}
                                    ...
                                  </div>
                                  {meeting.location ? (
                                    <div className="truncate text-[10px]">
                                      {meeting.location}
                                    </div>
                                  ) : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="h-6 rounded-md border border-transparent"></div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )})}
            </div>
          </div>
        </div>
      </div>
      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">새 미팅</h2>
                <p className="mt-1 text-sm text-slate-400">
                  회의 내용을 작성해주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseCreate}
                className="text-sm text-slate-400 hover:text-white"
              >
                닫기
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleSubmitMeeting}>
              <label className="block text-sm text-slate-300">
                제목 <span className="text-[#FF6363]">*</span>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(event) => setMeetingTitle(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  날짜 <span className="text-[#FF6363]">*</span>
                  <div className="mt-2">
                    <TypedDatePicker
                      selected={selectedMeetingDate}
                      onChange={(date: Date | null) => {
                        if (date) {
                          setMeetingDate(toDateKey(date))
                        }
                      }}
                      dateFormat="yyyy-MM-dd"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>
                </label>
                <label className="block text-sm text-slate-300">
                  위치 <span className="text-[#FF6363]">*</span>
                  <select
                    value={meetingLocation}
                    onChange={(event) => setMeetingLocation(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                  >
                    <option value="" disabled>
                      회의실 선택
                    </option>
                    {sortedRooms.map((room) => {
                      const locationLabel = formatRoomLocation(room)
                      return (
                        <option key={room.room_id} value={locationLabel}>
                          {locationLabel}
                        </option>
                      )
                    })}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-300">
                    시작 시간 <span className="text-[#FF6363]">*</span>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <select
                      value={startHour}
                      onChange={(event) => {
                        setStartHour(event.target.value)
                        setAutoEndEnabled(true)
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    >
                      {Array.from({ length: 16 }, (_, index) => index + 8).map(
                        (hour) => {
                          const label = `${hour}`.padStart(2, "0")
                          return (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          )
                        }
                      )}
                    </select>
                    <select
                      value={startMinute}
                      onChange={(event) => {
                        setStartMinute(event.target.value)
                        setAutoEndEnabled(true)
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    >
                      {["00", "30"].map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-300">
                    종료 시간 <span className="text-[#FF6363]">*</span>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <select
                      value={endHour}
                      onChange={(event) => {
                        setEndHour(event.target.value)
                        setAutoEndEnabled(false)
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    >
                      {Array.from({ length: 16 }, (_, index) => index + 8).map(
                        (hour) => {
                          const label = `${hour}`.padStart(2, "0")
                          return (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          )
                        }
                      )}
                    </select>
                    <select
                      value={endMinute}
                      onChange={(event) => {
                        setEndMinute(event.target.value)
                        setAutoEndEnabled(false)
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    >
                      {["00", "30"].map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <label className="block text-sm text-slate-300">
                메모 (선택)
                <textarea
                  value={meetingNotes}
                  onChange={(event) => setMeetingNotes(event.target.value)}
                  className="mt-2 min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <div className="space-y-2">
                <label className="block text-sm text-slate-300">
                  참석자 추가
                  <input
                    type="text"
                    value={participantQuery}
                    onChange={(event) => setParticipantQuery(event.target.value)}
                    placeholder="닉네임, 이름, 이메일 또는 팀 검색"
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                  />
                </label>
                {isSearchingParticipants ? (
                  <p className="text-xs text-slate-500">검색 중...</p>
                ) : null}
                {teamMatches.length > 0 || participantResults.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60">
                    {teamMatches.map((team) => (
                      <button
                        key={`team-${team.value}`}
                        type="button"
                        onClick={() => handleAddTeam(team.value)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-100 ${attendeeHoverClass}`}
                      >
                        <span>팀: {team.label}</span>
                        <span className="text-xs text-slate-500">
                          팀 전체 추가
                        </span>
                      </button>
                    ))}
                    {participantResults.map((participant) => (
                      <button
                        key={participant.user_id}
                        type="button"
                        onClick={() => handleAddParticipant(participant)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 ${attendeeHoverClass}`}
                      >
                        <span>{participant.nickname}</span>
                        <span className="text-xs text-slate-500">
                          {participant.email ?? participant.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedParticipants.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedParticipants.map((participant) => (
                      <span
                        key={participant.user_id}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                      >
                        {participant.nickname}
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(participant.user_id)}
                          className="text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {selectedTeams.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedTeams.map((team) => (
                      <span
                        key={`team-${team}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                      >
                        팀: {team}
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(team)}
                          className="text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {meetingErrorMessage ? (
                <p className="text-sm text-[#FF6363]">
                  {meetingErrorMessage}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSavingMeeting}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingMeeting ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseCreate}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {isMyMeetingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">내 미팅</h2>
                <p className="mt-1 text-sm text-slate-400">
                  내가 참석 중인 미팅을 확인합니다.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseMyMeetings}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleToggleMyDeleteMode}
                  className={`mt-1 text-xs font-semibold transition ${
                    isMyDeleteMode
                      ? "text-[#FF4242]"
                      : "text-slate-400 hover:text-[#FF4242]"
                  }`}
                >
                  미팅 삭제
                </button>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {isMeetingLoading ? (
                <p className="text-sm text-slate-400">불러오는 중...</p>
              ) : upcomingMyMeetings.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                  예정된 미팅이 없습니다.
                </div>
              ) : (
                upcomingMyMeetings.map((meeting) => {
                  const start = new Date(meeting.start_at)
                  const end = new Date(meeting.end_at)
                  const dateLabel = start.toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                  })
                  const timeLabel = `${start.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })} - ${end.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}`
                  return (
                    <div
                      key={meeting.reservation_id}
                      className="group flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                      onDoubleClick={() => handleOpenEdit(meeting)}
                    >
                      <div className="flex w-20 flex-col items-center justify-center rounded-lg bg-indigo-500/10 px-2 py-3 text-center">
                        <div className="text-xs uppercase text-indigo-200">
                          {dateLabel.split(" ")[0]}
                        </div>
                        <div className="text-lg font-semibold text-indigo-100">
                          {dateLabel.split(" ")[1]}
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-sm font-semibold text-slate-100">
                          {meeting.title}
                        </div>
                        <div className="text-sm text-slate-400">
                          {timeLabel}
                        </div>
                        {meeting.location ? (
                          <div className="text-sm text-slate-400">
                            {meeting.location}
                          </div>
                        ) : null}
                      </div>
                      {isMyDeleteMode &&
                      meeting.user_id === currentUser.user_id ? (
                        <button
                          type="button"
                          onClick={() => setPendingMyDelete(meeting)}
                          className="invisible rounded-lg border border-[#FF4242] px-3 py-1 text-xs text-[#FF4242] transition hover:border-[#E53A3A] hover:text-[#E53A3A] group-hover:visible"
                        >
                          삭제
                        </button>
                      ) : null}
                      {meeting.user_id === currentUser.user_id ? (
                        <div className="flex items-center gap-2 text-xs text-[#F741C1]">
                          <span className="h-2 w-2 rounded-full bg-[#F741C1]" />
                          host
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">미팅 수정</h2>
                <p className="mt-1 text-sm text-slate-400">
                  기존 미팅 정보를 수정합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="text-sm text-slate-400 hover:text-white"
              >
                닫기
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleSubmitEdit}>
              <label className="block text-sm text-slate-300">
                제목
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(event) => setMeetingTitle(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  날짜
                  <div className="mt-2">
                    <TypedDatePicker
                      selected={selectedMeetingDate}
                      onChange={(date: Date | null) => {
                        if (date) {
                          setMeetingDate(toDateKey(date))
                        }
                      }}
                      dateFormat="yyyy-MM-dd"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>
                </label>
                <label className="block text-sm text-slate-300">
                  위치
                  <select
                    value={meetingLocation}
                    onChange={(event) => setMeetingLocation(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                  >
                    <option value="" disabled>
                      회의실 선택
                    </option>
                    {sortedRooms.map((room) => {
                      const locationLabel = formatRoomLocation(room)
                      return (
                        <option key={room.room_id} value={locationLabel}>
                          {locationLabel}
                        </option>
                      )
                    })}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-300">시작 시간</p>
                  <div className="mt-2 flex gap-2">
                    <select
                      value={startHour}
                      onChange={(event) => {
                        setStartHour(event.target.value)
                        setAutoEndEnabled(true)
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    >
                      {Array.from({ length: 16 }, (_, index) => index + 8).map(
                        (hour) => {
                          const label = `${hour}`.padStart(2, "0")
                          return (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          )
                        }
                      )}
                    </select>
                    <select
                      value={startMinute}
                      onChange={(event) => {
                        setStartMinute(event.target.value)
                        setAutoEndEnabled(true)
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    >
                      {["00", "30"].map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-300">종료 시간</p>
                  <div className="mt-2 flex gap-2">
                    <select
                      value={endHour}
                      onChange={(event) => {
                        setEndHour(event.target.value)
                        setAutoEndEnabled(false)
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    >
                      {Array.from({ length: 16 }, (_, index) => index + 8).map(
                        (hour) => {
                          const label = `${hour}`.padStart(2, "0")
                          return (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          )
                        }
                      )}
                    </select>
                    <select
                      value={endMinute}
                      onChange={(event) => {
                        setEndMinute(event.target.value)
                        setAutoEndEnabled(false)
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    >
                      {["00", "30"].map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <label className="block text-sm text-slate-300">
                메모 (선택)
                <textarea
                  value={meetingNotes}
                  onChange={(event) => setMeetingNotes(event.target.value)}
                  className="mt-2 min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <div className="space-y-2">
                <label className="block text-sm text-slate-300">
                  참석자 추가
                  <input
                    type="text"
                    value={participantQuery}
                    onChange={(event) => setParticipantQuery(event.target.value)}
                    placeholder="닉네임, 이름, 이메일 또는 팀 검색"
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                  />
                </label>
                {isSearchingParticipants ? (
                  <p className="text-xs text-slate-500">검색 중...</p>
                ) : null}
                {teamMatches.length > 0 || participantResults.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60">
                    {teamMatches.map((team) => (
                      <button
                        key={`team-${team.value}`}
                        type="button"
                        onClick={() => handleAddTeam(team.value)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-100 ${attendeeHoverClass}`}
                      >
                        <span>팀: {team.label}</span>
                        <span className="text-xs text-slate-500">
                          팀 전체 추가
                        </span>
                      </button>
                    ))}
                    {participantResults.map((participant) => (
                      <button
                        key={participant.user_id}
                        type="button"
                        onClick={() => handleAddParticipant(participant)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 ${attendeeHoverClass}`}
                      >
                        <span>{participant.nickname}</span>
                        <span className="text-xs text-slate-500">
                          {participant.email ?? participant.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedParticipants.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedParticipants.map((participant) => (
                      <span
                        key={participant.user_id}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                      >
                        {participant.nickname}
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(participant.user_id)}
                          className="text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {selectedTeams.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedTeams.map((team) => (
                      <span
                        key={`team-${team}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                      >
                        팀: {team}
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(team)}
                          className="text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {meetingErrorMessage ? (
                <p className="text-sm text-[#FF6363]">
                  {meetingErrorMessage}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSavingMeeting}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingMeeting ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {isSummaryOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">미팅 정보</h2>
                <p className="mt-1 text-sm text-slate-400">
                  미팅 세부 정보를 확인하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseSummary}
                className="text-sm text-slate-400 hover:text-white"
              >
                닫기
              </button>
            </div>
            <div className="mt-6 space-y-4 text-sm text-slate-200">
              {isSummaryLoading ? (
                <p className="text-slate-400">불러오는 중...</p>
              ) : summaryError ? (
                <p className="text-sm text-[#FF6363]">{summaryError}</p>
              ) : summaryMeeting ? (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      제목
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-100">
                      {summaryMeeting.title}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        시간
                      </p>
                      <p className="mt-1 text-sm text-slate-200">
                        {new Date(summaryMeeting.start_at).toLocaleString(
                          "en-US",
                          {
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }
                        )}{" "}
                        -{" "}
                        {new Date(summaryMeeting.end_at).toLocaleString(
                          "en-US",
                          {
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        위치
                      </p>
                      <p className="mt-1 text-sm text-slate-200">
                        {summaryMeeting.location ?? "-"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      메모
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {summaryMeeting.notes?.trim() || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      참석자
                    </p>
                    {summaryAttendees.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-400">없음</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {summaryAttendees.map((attendee) => (
                          <span
                            key={attendee.user_id}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                          >
                            {attendee.nickname}
                            <span className="text-slate-400">
                              {attendee.name}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {pendingDeleteMeeting ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">미팅 삭제</h2>
              <p className="text-sm text-slate-300">
                {pendingDeleteMeeting.title}을/를 삭제하시겠습니까?
              </p>
            </div>
            {deleteMeetingError ? (
              <p className="mt-4 text-sm text-[#FF6363]">
                {deleteMeetingError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConfirmDeleteMeeting}
                disabled={isDeletingMeeting}
                className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingMeeting ? "삭제 중..." : "예"}
              </button>
              <button
                type="button"
                onClick={handleCloseDeleteMeeting}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingMyDelete ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">미팅 삭제</h2>
              <p className="text-sm text-slate-300">
                {pendingMyDelete.title}을/를 삭제하시겠습니까?
              </p>
            </div>
            {deleteMyMeetingError ? (
              <p className="mt-4 text-sm text-[#FF6363]">
                {deleteMyMeetingError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConfirmDeleteMyMeeting}
                disabled={isDeletingMyMeeting}
                className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingMyMeeting ? "삭제 중..." : "예"}
              </button>
              <button
                type="button"
                onClick={handleCloseMyDelete}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
