import { useEffect, useState, type FormEvent } from "react"
import type { User } from "../lib/api"
import { updateUser } from "../lib/api"
import type { ThemeMode } from "../types/theme"

type DashboardProps = {
  user: User
  onLogout: () => Promise<void>
  onUpdateUser: (user: User) => void
  onUpdatePassword: (currentPassword: string, newPassword: string) => Promise<void>
  theme: ThemeMode
  onThemeChange: (nextTheme: ThemeMode) => void
}

export default function Dashboard({
  user,
  onLogout,
  onUpdateUser,
  onUpdatePassword,
  theme,
  onThemeChange,
}: DashboardProps) {
  // 화면 상태 관리
  const [isEditing, setIsEditing] = useState(false)
  const [email, setEmail] = useState(user.email)
  const [nickname, setNickname] = useState(user.nickname)
  const [name, setName] = useState(user.name)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // 편집 모드 초기화
  useEffect(() => {
    if (!isEditing) {
      setEmail(user.email)
      setNickname(user.nickname)
      setName(user.name)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setError(null)
    }
  }, [isEditing, user.email, user.nickname, user.name])

  // 프로필/비밀번호 저장 처리
  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    const trimmedNickname = nickname.trim()
    const trimmedName = name.trim()

    const updates: Partial<Pick<User, "email" | "nickname" | "name">> = {}
    if (trimmedEmail && trimmedEmail !== user.email) {
      updates.email = trimmedEmail
    }
    if (trimmedNickname && trimmedNickname !== user.nickname) {
      updates.nickname = trimmedNickname
    }
    if (trimmedName && trimmedName !== user.name) {
      updates.name = trimmedName
    }

    const wantsPasswordChange =
      currentPassword.trim() || newPassword.trim() || confirmPassword.trim()
    if (
      wantsPasswordChange &&
      (!currentPassword.trim() ||
        !newPassword.trim() ||
        !confirmPassword.trim())
    ) {
      setError("현재 비밀번호와 새 비밀번호를 모두 입력하세요.")
      return
    }
    if (wantsPasswordChange && newPassword.trim() !== confirmPassword.trim()) {
      setError("새 비밀번호가 일치하지 않습니다.")
      return
    }

    if (!Object.keys(updates).length && !wantsPasswordChange) {
      setError("변경할 내용을 입력하세요.")
      return
    }

    setIsSaving(true)
    try {
      if (Object.keys(updates).length) {
        const nextUser = await updateUser(updates)
        onUpdateUser(nextUser)
      }
      if (wantsPasswordChange && currentPassword.trim() && newPassword.trim()) {
        await onUpdatePassword(currentPassword, newPassword)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
      setIsEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "정보 변경에 실패했습니다."
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  // 화면 렌더링
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            환영합니다, {user.nickname} 님
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onThemeChange("light")}
              title="라이트 모드"
              aria-label="라이트 모드"
              className={`h-3 w-3 rounded-full border transition ${
                theme === "light"
                  ? "border-[#9804F9] bg-[#9804F9]"
                  : "border-[#505462] bg-transparent hover:border-[#9804F9]"
              }`}
            />
            <button
              type="button"
              onClick={() => onThemeChange("dark")}
              title="다크 모드"
              aria-label="다크 모드"
              className={`h-3 w-3 rounded-full border transition ${
                theme === "dark"
                  ? "border-[#9804F9] bg-[#9804F9]"
                  : "border-[#505462] bg-transparent hover:border-[#9804F9]"
              }`}
            />
            <button
              type="button"
              onClick={() => onThemeChange("pink")}
              title="핑크 테마"
              aria-label="핑크 테마"
              className={`h-3 w-3 rounded-full border transition ${
                theme === "pink"
                  ? "border-[#F741C1] bg-[#F741C1]"
                  : "border-[#505462] bg-transparent hover:border-[#F741C1]"
              }`}
            />
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-indigo-400 hover:text-white"
          >
            로그아웃
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-sm text-slate-400">현재 로그인 계정</p>
        <div className="mt-3 grid gap-2 text-sm text-slate-200">
          <div>이메일: {user.email}</div>
          <div>닉네임: {user.nickname}</div>
          <div>이름: {user.name}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-indigo-400 hover:text-white"
          >
            내 정보 변경
          </button>
        </div>
        {isEditing ? (
          <form className="mt-6 space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                이메일
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <label className="block text-sm text-slate-300">
                닉네임
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              이름
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                현재 비밀번호
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
              <label className="block text-sm text-slate-300">
                새 비밀번호
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              새 비밀번호 확인
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>
            {error ? <p className="text-sm text-[#FF6363]">{error}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                취소
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  )
}
