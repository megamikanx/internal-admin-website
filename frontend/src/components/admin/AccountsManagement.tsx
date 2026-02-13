import type { FormEvent } from "react"
import type { TeamValue, User } from "../../lib/api"
import type { ThemeMode } from "../../types/theme"

type TeamOption = { value: TeamValue; label: string }

type AccountsManagementProps = {
  users: User[]
  isLoading: boolean
  error: string | null
  isDeleteMode: boolean
  isRoleMode: boolean
  isTeamMode: boolean
  isResetMode: boolean
  theme: ThemeMode
  teamOptions: TeamOption[]
  onOpenCreate: () => void
  onToggleDeleteMode: () => void
  onToggleRoleMode: () => void
  onToggleTeamMode: () => void
  onToggleResetMode: () => void
  onSelectDelete: (user: User) => void
  onSelectRoleChange: (user: User) => void
  onSelectTeamChange: (user: User) => void
  onSelectReset: (user: User) => void
  isCreateOpen: boolean
  onCloseCreate: () => void
  onCreateUser: (event: FormEvent<HTMLFormElement>) => void
  createNickname: string
  onCreateNicknameChange: (value: string) => void
  createName: string
  onCreateNameChange: (value: string) => void
  createEmail: string
  onCreateEmailChange: (value: string) => void
  createTeam: TeamValue
  onCreateTeamChange: (value: TeamValue) => void
  createError: string | null
  isCreating: boolean
  pendingRoleChange: User | null
  roleError: string | null
  onConfirmRoleChange: () => void
  isRoleUpdating: boolean
  onCloseRoleChange: () => void
  pendingTeamChange: User | null
  teamError: string | null
  teamValue: TeamValue
  onTeamValueChange: (value: TeamValue) => void
  onConfirmTeamChange: () => void
  isTeamUpdating: boolean
  onCloseTeamChange: () => void
  pendingReset: User | null
  resetError: string | null
  onConfirmReset: () => void
  isResetting: boolean
  onCloseReset: () => void
  pendingDelete: User | null
  deleteError: string | null
  onConfirmDelete: () => void
  isDeleting: boolean
  onCloseDelete: () => void
}

export default function AccountsManagement({
  users,
  isLoading,
  error,
  isDeleteMode,
  isRoleMode,
  isTeamMode,
  isResetMode,
  theme,
  teamOptions,
  onOpenCreate,
  onToggleDeleteMode,
  onToggleRoleMode,
  onToggleTeamMode,
  onToggleResetMode,
  onSelectDelete,
  onSelectRoleChange,
  onSelectTeamChange,
  onSelectReset,
  isCreateOpen,
  onCloseCreate,
  onCreateUser,
  createNickname,
  onCreateNicknameChange,
  createName,
  onCreateNameChange,
  createEmail,
  onCreateEmailChange,
  createTeam,
  onCreateTeamChange,
  createError,
  isCreating,
  pendingRoleChange,
  roleError,
  onConfirmRoleChange,
  isRoleUpdating,
  onCloseRoleChange,
  pendingTeamChange,
  teamError,
  teamValue,
  onTeamValueChange,
  onConfirmTeamChange,
  isTeamUpdating,
  onCloseTeamChange,
  pendingReset,
  resetError,
  onConfirmReset,
  isResetting,
  onCloseReset,
  pendingDelete,
  deleteError,
  onConfirmDelete,
  isDeleting,
  onCloseDelete,
}: AccountsManagementProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">계정 관리</h1>
          <p className="mt-2 text-sm text-slate-400">
            사용자 계정 목록을 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenCreate}
            className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF]"
          >
            + 계정 생성
          </button>
          <button
            type="button"
            onClick={onToggleDeleteMode}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              isDeleteMode ? "bg-[#FF4242]" : "bg-[#FF6363] hover:bg-[#FF4242]"
            }`}
          >
            - 계정 삭제
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        {isLoading ? <p className="text-sm text-slate-400">불러오는 중...</p> : null}
        {error ? <p className="text-sm text-[#FF6363]">{error}</p> : null}
        {isDeleteMode && !isLoading ? (
          <p className="mb-3 text-sm text-[#FF4242]">
            어느 계정을 삭제하시겠습니까?
          </p>
        ) : null}
        {isTeamMode && !isLoading ? (
          <p
            className={`mb-3 text-sm ${
              theme === "dark" ? "text-[#B968ff]" : "text-[#9804F9]"
            }`}
          >
            팀을 변경할 계정을 선택해주세요.
          </p>
        ) : null}
        {isResetMode && !isLoading ? (
          <p
            className={`mb-3 text-sm ${
              theme === "dark" ? "text-[#B968ff]" : "text-[#9804F9]"
            }`}
          >
            비밀번호를 리셋할 계정을 선택해주세요.
          </p>
        ) : null}
        {!isLoading && !error ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="px-3 py-2 font-medium">닉네임</th>
                  <th className="px-3 py-2 font-medium">이름</th>
                  <th className="px-3 py-2 font-medium">부서</th>
                  <th className="px-3 py-2 font-medium">이메일</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-slate-400"
                    >
                      표시할 계정이 없습니다.
                    </td>
                  </tr>
                ) : (
                  [...users]
                    .sort((a, b) => {
                      const teamCompare = a.team.localeCompare(b.team)
                      if (teamCompare !== 0) {
                        return teamCompare
                      }
                      return a.nickname.localeCompare(b.nickname)
                    })
                    .map((account) => (
                      <tr
                        key={account.user_id}
                        className="group border-b border-slate-900/80 last:border-b-0"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                account.admin_status
                                  ? "bg-[#F741C1]"
                                  : "bg-transparent"
                              }`}
                              aria-hidden="true"
                            />
                            <span>{account.nickname}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">{account.name}</td>
                        <td className="px-3 py-2">{account.team}</td>
                        <td className="px-3 py-2">{account.email}</td>
                        <td className="px-3 py-2 text-right">
                          {isDeleteMode ? (
                            <button
                              type="button"
                              onClick={() => onSelectDelete(account)}
                              className="invisible rounded-lg border border-[#FF4242] px-3 py-1 text-xs text-[#FF4242] transition hover:border-[#E53A3A] hover:text-[#E53A3A] group-hover:visible"
                            >
                              삭제
                            </button>
                          ) : null}
                          {isRoleMode ? (
                            <button
                              type="button"
                              onClick={() => onSelectRoleChange(account)}
                              className={`invisible rounded-lg border px-3 py-1 text-xs transition group-hover:visible ${
                                account.admin_status
                                  ? "border-[#FF4242] text-[#FF4242] hover:border-[#E53A3A] hover:text-[#E53A3A]"
                                  : theme === "dark"
                                    ? "border-[#B968ff] text-[#B968ff] hover:border-[#B968ff] hover:text-[#B968ff]"
                                    : "border-indigo-400/70 text-indigo-200 hover:border-indigo-300 hover:text-indigo-100"
                              }`}
                            >
                              {account.admin_status ? "강등" : "관리자로 등록"}
                            </button>
                          ) : null}
                          {isTeamMode ? (
                            <button
                              type="button"
                              onClick={() => onSelectTeamChange(account)}
                              className={`invisible rounded-lg border px-3 py-1 text-xs transition group-hover:visible ${
                                theme === "dark"
                                  ? "border-[#B968ff] text-[#B968ff] hover:border-[#B968ff] hover:text-[#B968ff]"
                                  : "border-[#9804F9] text-[#9804F9] hover:border-[#9804F9] hover:text-[#9804F9]"
                              }`}
                            >
                              팀 변경
                            </button>
                          ) : null}
                          {isResetMode ? (
                            <button
                              type="button"
                              onClick={() => onSelectReset(account)}
                              className={`invisible rounded-lg border px-3 py-1 text-xs transition group-hover:visible ${
                                theme === "dark"
                                  ? "border-[#B968ff] text-[#B968ff] hover:border-[#B968ff] hover:text-[#B968ff]"
                                  : "border-[#9804F9] text-[#9804F9] hover:border-[#9804F9] hover:text-[#9804F9]"
                              }`}
                            >
                              비밀번호 리셋
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
      <div className="flex flex-wrap justify-start gap-2">
        <button
          type="button"
          onClick={onToggleRoleMode}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            isRoleMode
              ? theme === "dark"
                ? "border-[#B968ff] text-[#B968ff]"
                : "border-indigo-400 text-indigo-200"
              : theme === "dark"
                ? "border-[#505462] text-white hover:border-[#B968ff] hover:text-[#B968ff]"
                : "border-slate-700 text-slate-200 hover:border-indigo-400 hover:text-indigo-200"
          }`}
        >
          권한 변경
        </button>
        <button
          type="button"
          onClick={onToggleTeamMode}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            isTeamMode
              ? theme === "dark"
                ? "border-[#B968ff] text-[#B968ff]"
                : "border-[#9804F9] text-[#9804F9]"
              : theme === "dark"
                ? "border-[#505462] text-white hover:border-[#B968ff] hover:text-[#B968ff]"
                : "border-[#505462] text-black hover:border-[#9804F9] hover:text-[#9804F9]"
          }`}
        >
          팀 변경
        </button>
        <button
          type="button"
          onClick={onToggleResetMode}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            isResetMode
              ? theme === "dark"
                ? "border-[#B968ff] text-[#B968ff]"
                : "border-[#9804F9] text-[#9804F9]"
              : theme === "dark"
                ? "border-[#505462] text-white hover:border-[#B968ff] hover:text-[#B968ff]"
                : "border-[#505462] text-black hover:border-[#9804F9] hover:text-[#9804F9]"
          }`}
        >
          비밀번호 리셋
        </button>
      </div>
      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">계정 생성</h2>
                <p className="mt-1 text-sm text-slate-400">
                  기본 비밀번호는 230602!! 입니다.
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
            <form className="mt-6 space-y-4" onSubmit={onCreateUser}>
              <label className="block text-sm text-slate-300">
                닉네임 <span className="text-[#FF6363]">*</span>
                <input
                  type="text"
                  value={createNickname}
                  onChange={(event) => onCreateNicknameChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <label className="block text-sm text-slate-300">
                이름 <span className="text-[#FF6363]">*</span>
                <input
                  type="text"
                  value={createName}
                  onChange={(event) => onCreateNameChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <label className="block text-sm text-slate-300">
                이메일 <span className="text-[#FF6363]">*</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={createEmail}
                  onChange={(event) => onCreateEmailChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <label className="block text-sm text-slate-300">
                팀 <span className="text-[#FF6363]">*</span>
                <select
                  value={createTeam}
                  onChange={(event) => onCreateTeamChange(event.target.value as TeamValue)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                >
                  {teamOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {createError ? (
                <p className="text-sm text-[#FF6363]">{createError}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? "생성 중..." : "생성"}
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
      {pendingRoleChange ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">권한 변경</h2>
              <p className="text-sm text-slate-300">
                {pendingRoleChange.nickname}님의 계정을{" "}
                {pendingRoleChange.admin_status
                  ? "일반 유저로 변경하시겠습니까?"
                  : "관리자로 등록하시겠습니까?"}
              </p>
            </div>
            {roleError ? (
              <p className="mt-4 text-sm text-[#FF6363]">{roleError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onConfirmRoleChange}
                disabled={isRoleUpdating}
                className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRoleUpdating ? "처리 중..." : "예"}
              </button>
              <button
                type="button"
                onClick={onCloseRoleChange}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingTeamChange ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">팀 변경</h2>
              <p className="text-sm text-slate-300">
                {pendingTeamChange.nickname}님의 팀을 변경합니다.
              </p>
            </div>
            <div className="mt-4">
              <label className="block text-sm text-slate-300">
                팀
                <select
                  value={teamValue}
                  onChange={(event) =>
                    onTeamValueChange(event.target.value as TeamValue)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                >
                  {teamOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {teamError ? (
              <p className="mt-4 text-sm text-[#FF6363]">{teamError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onConfirmTeamChange}
                disabled={isTeamUpdating}
                className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTeamUpdating ? "처리 중..." : "예"}
              </button>
              <button
                type="button"
                onClick={onCloseTeamChange}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">비밀번호 리셋</h2>
              <p className="text-sm text-slate-300">
                {pendingReset.nickname}님의 비밀번호를 리셋하시겠습니까?
              </p>
              <p className="text-xs text-slate-500">
                기본 비밀번호는 230602!! 입니다.
              </p>
            </div>
            {resetError ? (
              <p className="mt-4 text-sm text-[#FF6363]">{resetError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onConfirmReset}
                disabled={isResetting}
                className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResetting ? "처리 중..." : "예"}
              </button>
              <button
                type="button"
                onClick={onCloseReset}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">계정 삭제</h2>
              <p className="text-sm text-slate-300">
                {pendingDelete.nickname}님의 계정을 삭제하시겠습니까?
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
