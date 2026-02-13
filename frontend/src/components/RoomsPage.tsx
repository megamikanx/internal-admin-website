import { useEffect, useState } from "react"
import RoomsManagement from "./admin/RoomsManagement"
import { createRoom, deleteRoom, getRooms, type Room } from "../lib/api"

export default function RoomsPage() {
  // 화면 상태 관리
  const [rooms, setRooms] = useState<Room[]>([])
  const [isRoomsLoading, setIsRoomsLoading] = useState(false)
  const [roomsError, setRoomsError] = useState<string | null>(null)
  const [isRoomCreateOpen, setIsRoomCreateOpen] = useState(false)
  const [roomBuilding, setRoomBuilding] = useState("성수 오피스")
  const [roomFloor, setRoomFloor] = useState("")
  const [roomCapacity, setRoomCapacity] = useState("")
  const [roomName, setRoomName] = useState("")
  const [roomCreateError, setRoomCreateError] = useState<string | null>(null)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [isRoomDeleteMode, setIsRoomDeleteMode] = useState(false)
  const [pendingRoomDelete, setPendingRoomDelete] = useState<Room | null>(null)
  const [isDeletingRoom, setIsDeletingRoom] = useState(false)
  const [roomDeleteError, setRoomDeleteError] = useState<string | null>(null)

  // 회의실 목록 로드
  useEffect(() => {
    let isMounted = true
    setIsRoomsLoading(true)
    setRoomsError(null)

    getRooms()
      .then((loadedRooms) => {
        if (isMounted) {
          setRooms(loadedRooms)
        }
      })
      .catch((err) => {
        if (isMounted) {
          const message =
            err instanceof Error ? err.message : "회의실 목록을 불러오지 못했습니다."
          setRoomsError(message)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsRoomsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  // 모달 및 모드 토글
  const handleOpenRoomCreate = () => {
    setRoomBuilding("성수 오피스")
    setRoomFloor("")
    setRoomCapacity("")
    setRoomName("")
    setRoomCreateError(null)
    setIsRoomCreateOpen(true)
  }

  const handleCloseRoomCreate = () => {
    if (isCreatingRoom) {
      return
    }
    setRoomCreateError(null)
    setIsRoomCreateOpen(false)
  }

  const handleToggleRoomDeleteMode = () => {
    setIsRoomDeleteMode((prev) => !prev)
    setRoomDeleteError(null)
    if (!isRoomDeleteMode) {
      setPendingRoomDelete(null)
    }
  }

  const handleCloseRoomDelete = () => {
    if (isDeletingRoom) {
      return
    }
    setPendingRoomDelete(null)
    setRoomDeleteError(null)
  }

  // 회의실 생성/삭제 처리
  const handleCreateRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRoomCreateError(null)

    const trimmedBuilding = roomBuilding.trim()
    const trimmedRoomName = roomName.trim()
    const floorValue = Number(roomFloor)
    const capacityValue = Number(roomCapacity)
    if (
      !trimmedBuilding ||
      !trimmedRoomName ||
      !roomFloor.trim() ||
      !roomCapacity.trim()
    ) {
      setRoomCreateError("건물, 층, 정원, 회의실명을 입력하세요.")
      return
    }
    if (!Number.isFinite(floorValue) || floorValue < 1) {
      setRoomCreateError("층수는 1층 이상이어야 합니다.")
      return
    }
    if (!Number.isFinite(capacityValue) || capacityValue < 1) {
      setRoomCreateError("정원은 1명 이상이어야 합니다.")
      return
    }

    setIsCreatingRoom(true)
    try {
      const newRoom = await createRoom({
        building: trimmedBuilding,
        floor: floorValue,
        room_name: trimmedRoomName,
        capacity: capacityValue,
      })
      setRooms((prev) => [newRoom, ...prev])
      setIsRoomCreateOpen(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "회의실을 생성할 수 없습니다."
      setRoomCreateError(message)
    } finally {
      setIsCreatingRoom(false)
    }
  }

  const handleConfirmRoomDelete = async () => {
    if (!pendingRoomDelete) {
      return
    }

    setIsDeletingRoom(true)
    setRoomDeleteError(null)

    try {
      await deleteRoom({
        building: pendingRoomDelete.building,
        floor: pendingRoomDelete.floor,
        room_name: pendingRoomDelete.room_name,
        capacity: pendingRoomDelete.capacity,
      })
      setRooms((prev) =>
        prev.filter((room) => room.room_id !== pendingRoomDelete.room_id)
      )
      setPendingRoomDelete(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "회의실을 삭제할 수 없습니다."
      setRoomDeleteError(message)
    } finally {
      setIsDeletingRoom(false)
    }
  }

  // 화면 렌더링
  return (
    <RoomsManagement
      rooms={rooms}
      isLoading={isRoomsLoading}
      error={roomsError}
      isDeleteMode={isRoomDeleteMode}
      onOpenCreate={handleOpenRoomCreate}
      onToggleDeleteMode={handleToggleRoomDeleteMode}
      onSelectDelete={setPendingRoomDelete}
      isCreateOpen={isRoomCreateOpen}
      onCloseCreate={handleCloseRoomCreate}
      onCreateRoom={handleCreateRoom}
      roomBuilding={roomBuilding}
      onRoomBuildingChange={setRoomBuilding}
      roomFloor={roomFloor}
      onRoomFloorChange={setRoomFloor}
      roomCapacity={roomCapacity}
      onRoomCapacityChange={setRoomCapacity}
      roomName={roomName}
      onRoomNameChange={setRoomName}
      roomCreateError={roomCreateError}
      isCreating={isCreatingRoom}
      pendingDelete={pendingRoomDelete}
      deleteError={roomDeleteError}
      onConfirmDelete={handleConfirmRoomDelete}
      isDeleting={isDeletingRoom}
      onCloseDelete={handleCloseRoomDelete}
    />
  )
}
