import type { FormEvent } from "react"
import type { Room } from "../../lib/api"

type RoomsManagementProps = {
  rooms: Room[]
  isLoading: boolean
  error: string | null
  isDeleteMode: boolean
  onOpenCreate: () => void
  onToggleDeleteMode: () => void
  onSelectDelete: (room: Room) => void
  isCreateOpen: boolean
  onCloseCreate: () => void
  onCreateRoom: (event: FormEvent<HTMLFormElement>) => void
  roomBuilding: string
  onRoomBuildingChange: (value: string) => void
  roomFloor: string
  onRoomFloorChange: (value: string) => void
  roomCapacity: string
  onRoomCapacityChange: (value: string) => void
  roomName: string
  onRoomNameChange: (value: string) => void
  roomCreateError: string | null
  isCreating: boolean
  pendingDelete: Room | null
  deleteError: string | null
  onConfirmDelete: () => void
  isDeleting: boolean
  onCloseDelete: () => void
}

export default function RoomsManagement({
  rooms,
  isLoading,
  error,
  isDeleteMode,
  onOpenCreate,
  onToggleDeleteMode,
  onSelectDelete,
  isCreateOpen,
  onCloseCreate,
  onCreateRoom,
  roomBuilding,
  onRoomBuildingChange,
  roomFloor,
  onRoomFloorChange,
  roomCapacity,
  onRoomCapacityChange,
  roomName,
  onRoomNameChange,
  roomCreateError,
  isCreating,
  pendingDelete,
  deleteError,
  onConfirmDelete,
  isDeleting,
  onCloseDelete,
}: RoomsManagementProps) {
  const formatRoomLocation = (room: Room) =>
    `${room.building}-${room.floor}-${room.room_name} (${room.capacity})`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">회의실 관리</h1>
          <p className="mt-2 text-sm text-slate-400">회의실 목록을 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenCreate}
            className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF]"
          >
            + 회의실 추가
          </button>
          <button
            type="button"
            onClick={onToggleDeleteMode}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              isDeleteMode ? "bg-[#FF4242]" : "bg-[#FF6363] hover:bg-[#FF4242]"
            }`}
          >
            - 회의실 삭제
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        {isLoading ? <p className="text-sm text-slate-400">불러오는 중...</p> : null}
        {error ? <p className="text-sm text-[#FF6363]">{error}</p> : null}
        {isDeleteMode && !isLoading ? (
          <p className="mb-3 text-sm text-[#FF4242]">
            삭제할 회의실을 선택해주세요.
          </p>
        ) : null}
        {!isLoading && !error ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="px-3 py-2 font-medium">빌딩</th>
                  <th className="px-3 py-2 font-medium">층</th>
                  <th className="px-3 py-2 font-medium">호수</th>
                  <th className="px-3 py-2 font-medium">정원</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-slate-400"
                    >
                      표시할 회의실이 없습니다.
                    </td>
                  </tr>
                ) : (
                  [...rooms]
                    .sort((a, b) =>
                      formatRoomLocation(a).localeCompare(formatRoomLocation(b))
                    )
                    .map((room) => (
                      <tr
                        key={room.room_id}
                        className="group border-b border-slate-900/80 last:border-b-0"
                      >
                        <td className="px-3 py-2">{room.building}</td>
                        <td className="px-3 py-2">{room.floor}</td>
                        <td className="px-3 py-2">{room.room_name}</td>
                        <td className="px-3 py-2">{room.capacity}</td>
                        <td className="px-3 py-2 text-right">
                          {isDeleteMode ? (
                            <button
                              type="button"
                              onClick={() => onSelectDelete(room)}
                              className="invisible rounded-lg border border-[#FF4242] px-3 py-1 text-xs text-[#FF4242] transition hover:border-[#E53A3A] hover:text-[#E53A3A] group-hover:visible"
                            >
                              삭제
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">회의실 추가</h2>
                <p className="mt-1 text-sm text-slate-400">
                  회의실 정보를 입력하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseCreate}
                className="text-sm text-slate-400 hover:text-white"
              >
                닫기
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={onCreateRoom}>
              <label className="block text-sm text-slate-300">
                건물 <span className="text-[#FF6363]">*</span>
                <input
                  type="text"
                  value={roomBuilding}
                  onChange={(event) => onRoomBuildingChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  층 <span className="text-[#FF6363]">*</span>
                  <input
                    type="number"
                    min={1}
                    value={roomFloor}
                    onChange={(event) => onRoomFloorChange(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  정원 <span className="text-[#FF6363]">*</span>
                  <input
                    type="number"
                    min={1}
                    value={roomCapacity}
                    onChange={(event) => onRoomCapacityChange(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                  />
                </label>
              </div>
              <label className="block text-sm text-slate-300">
                회의실명 <span className="text-[#FF6363]">*</span>
                <input
                  type="text"
                  value={roomName}
                  onChange={(event) => onRoomNameChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              {roomCreateError ? (
                <p className="text-sm text-[#FF6363]">{roomCreateError}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? "추가 중..." : "추가"}
                </button>
                <button
                  type="button"
                  onClick={onCloseCreate}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">회의실 삭제</h2>
              <p className="text-sm text-slate-300">
                {formatRoomLocation(pendingDelete)} 회의실을 삭제하시겠습니까?
              </p>
            </div>
            {deleteError ? (
              <p className="mt-4 text-sm text-[#FF6363]">{deleteError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={isDeleting}
                className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "삭제 중..." : "예"}
              </button>
              <button
                type="button"
                onClick={onCloseDelete}
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
