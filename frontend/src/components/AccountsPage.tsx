import { useEffect, useState } from "react"
import AccountsManagement from "./admin/AccountsManagement"
import type { ThemeMode } from "../types/theme"
import {
  createUser,
  deleteUser,
  demoteUser,
  getUsers,
  promoteUser,
  resetUserPassword,
  type TeamValue,
  type User,
  updateUserTeam,
} from "../lib/api"

const ACCOUNT_TEAM_OPTIONS: Array<{ value: TeamValue; label: string }> = [
  { value: "DEV", label: "DEV" },
  { value: "DATA", label: "DATA" },
  { value: "PRODUCT", label: "PRODUCT" },
  { value: "CS", label: "CS" },
  { value: "OPS", label: "OPS" },
]

export default function AccountsPage({ theme }: { theme: ThemeMode }) {
  // 화면 상태 관리
  const [accountUsers, setAccountUsers] = useState<User[]>([])
  const [isAccountsLoading, setIsAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createNickname, setCreateNickname] = useState("")
  const [createName, setCreateName] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createTeam, setCreateTeam] = useState<TeamValue>("DEV")
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isRoleMode, setIsRoleMode] = useState(false)
  const [pendingRoleChange, setPendingRoleChange] = useState<User | null>(null)
  const [isRoleUpdating, setIsRoleUpdating] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [isTeamMode, setIsTeamMode] = useState(false)
  const [pendingTeamChange, setPendingTeamChange] = useState<User | null>(null)
  const [teamValue, setTeamValue] = useState<TeamValue>("DEV")
  const [isTeamUpdating, setIsTeamUpdating] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [isResetMode, setIsResetMode] = useState(false)
  const [pendingReset, setPendingReset] = useState<User | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // 계정 목록 로드
  useEffect(() => {
    let isMounted = true
    setIsAccountsLoading(true)
    setAccountsError(null)

    getUsers()
      .then((users) => {
        if (isMounted) {
          setAccountUsers(users)
        }
      })
      .catch((err) => {
        if (isMounted) {
          const message =
            err instanceof Error ? err.message : "계정 목록을 불러오지 못했습니다."
          setAccountsError(message)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAccountsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  // UI 모드 토글 및 모달 제어
  const handleOpenCreate = () => {
    setCreateNickname("")
    setCreateName("")
    setCreateEmail("")
    setCreateTeam("DEV")
    setCreateError(null)
    setIsCreateOpen(true)
  }

  const handleCloseCreate = () => {
    if (isCreating) {
      return
    }
    setIsCreateOpen(false)
  }

  const handleToggleDeleteMode = () => {
    setIsDeleteMode((prev) => !prev)
    setDeleteError(null)
    if (!isDeleteMode) {
      setIsRoleMode(false)
      setIsTeamMode(false)
      setIsResetMode(false)
    }
  }

  const handleCloseDelete = () => {
    if (isDeleting) {
      return
    }
    setPendingDelete(null)
    setDeleteError(null)
  }

  const handleToggleRoleMode = () => {
    setIsRoleMode((prev) => !prev)
    setRoleError(null)
    if (!isRoleMode) {
      setIsDeleteMode(false)
      setIsTeamMode(false)
      setIsResetMode(false)
    }
  }

  const handleCloseRoleChange = () => {
    if (isRoleUpdating) {
      return
    }
    setPendingRoleChange(null)
    setRoleError(null)
  }

  const handleToggleTeamMode = () => {
    setIsTeamMode((prev) => !prev)
    setTeamError(null)
    if (!isTeamMode) {
      setIsDeleteMode(false)
      setIsRoleMode(false)
      setIsResetMode(false)
    } else {
      setPendingTeamChange(null)
    }
  }

  const handleCloseTeamChange = () => {
    if (isTeamUpdating) {
      return
    }
    setPendingTeamChange(null)
    setTeamError(null)
  }

  const handleToggleResetMode = () => {
    setIsResetMode((prev) => !prev)
    setResetError(null)
    if (!isResetMode) {
      setIsDeleteMode(false)
      setIsRoleMode(false)
      setIsTeamMode(false)
    }
  }

  const handleCloseReset = () => {
    if (isResetting) {
      return
    }
    setPendingReset(null)
    setResetError(null)
  }

  // 계정 액션 처리
  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateError(null)

    const nickname = createNickname.trim()
    const name = createName.trim()
    const email = createEmail.trim()

    if (!nickname || !name || !email) {
      setCreateError("닉네임, 이름, 이메일을 모두 입력하세요.")
      return
    }

    setIsCreating(true)
    try {
      const newUser = await createUser({
        nickname,
        name,
        email,
        password: "230602!!",
        team: createTeam,
      })
      setAccountUsers((prev) => [newUser, ...prev])
      setIsCreateOpen(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "계정을 생성할 수 없습니다."
      setCreateError(message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return
    }

    if (pendingDelete.admin_status) {
      const adminCount = accountUsers.filter((userItem) => userItem.admin_status)
        .length
      if (adminCount <= 1) {
        setDeleteError("최소 한개의 관리자 계정이 필요합니다.")
        return
      }
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteUser(pendingDelete.user_id)
      setAccountUsers((prev) =>
        prev.filter((userItem) => userItem.user_id !== pendingDelete.user_id)
      )
      setPendingDelete(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "계정을 삭제할 수 없습니다."
      setDeleteError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSelectTeamChange = (account: User) => {
    setPendingTeamChange(account)
    setTeamValue(account.team)
    setTeamError(null)
  }

  const handleConfirmRoleChange = async () => {
    if (!pendingRoleChange) {
      return
    }

    if (pendingRoleChange.admin_status) {
      const adminCount = accountUsers.filter((userItem) => userItem.admin_status)
        .length
      if (adminCount <= 1) {
        setRoleError("최소 한개의 관리자 계정이 필요합니다.")
        return
      }
    }

    setIsRoleUpdating(true)
    setRoleError(null)

    try {
      const updatedUser = pendingRoleChange.admin_status
        ? await demoteUser(pendingRoleChange.user_id)
        : await promoteUser(pendingRoleChange.user_id)
      setAccountUsers((prev) =>
        prev.map((userItem) =>
          userItem.user_id === updatedUser.user_id ? updatedUser : userItem
        )
      )
      setPendingRoleChange(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "권한을 변경할 수 없습니다."
      setRoleError(message)
    } finally {
      setIsRoleUpdating(false)
    }
  }

  const handleConfirmTeamChange = async () => {
    if (!pendingTeamChange) {
      return
    }

    setIsTeamUpdating(true)
    setTeamError(null)

    try {
      const updatedUser = await updateUserTeam(
        pendingTeamChange.user_id,
        teamValue
      )
      setAccountUsers((prev) =>
        prev.map((userItem) =>
          userItem.user_id === updatedUser.user_id ? updatedUser : userItem
        )
      )
      setPendingTeamChange(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "팀을 변경할 수 없습니다."
      setTeamError(message)
    } finally {
      setIsTeamUpdating(false)
    }
  }

  const handleConfirmReset = async () => {
    if (!pendingReset) {
      return
    }

    setIsResetting(true)
    setResetError(null)

    try {
      const updatedUser = await resetUserPassword(pendingReset.user_id)
      setAccountUsers((prev) =>
        prev.map((userItem) =>
          userItem.user_id === updatedUser.user_id ? updatedUser : userItem
        )
      )
      setPendingReset(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "비밀번호를 리셋할 수 없습니다."
      setResetError(message)
    } finally {
      setIsResetting(false)
    }
  }

  // 화면 렌더링
  return (
    <AccountsManagement
      users={accountUsers}
      isLoading={isAccountsLoading}
      error={accountsError}
      isDeleteMode={isDeleteMode}
      isRoleMode={isRoleMode}
      isTeamMode={isTeamMode}
      isResetMode={isResetMode}
      theme={theme}
      teamOptions={ACCOUNT_TEAM_OPTIONS}
      onOpenCreate={handleOpenCreate}
      onToggleDeleteMode={handleToggleDeleteMode}
      onToggleRoleMode={handleToggleRoleMode}
      onToggleTeamMode={handleToggleTeamMode}
      onToggleResetMode={handleToggleResetMode}
      onSelectDelete={setPendingDelete}
      onSelectRoleChange={setPendingRoleChange}
      onSelectTeamChange={handleSelectTeamChange}
      onSelectReset={setPendingReset}
      isCreateOpen={isCreateOpen}
      onCloseCreate={handleCloseCreate}
      onCreateUser={handleCreateUser}
      createNickname={createNickname}
      onCreateNicknameChange={setCreateNickname}
      createName={createName}
      onCreateNameChange={setCreateName}
      createEmail={createEmail}
      onCreateEmailChange={setCreateEmail}
      createTeam={createTeam}
      onCreateTeamChange={setCreateTeam}
      createError={createError}
      isCreating={isCreating}
      pendingRoleChange={pendingRoleChange}
      roleError={roleError}
      onConfirmRoleChange={handleConfirmRoleChange}
      isRoleUpdating={isRoleUpdating}
      onCloseRoleChange={handleCloseRoleChange}
      pendingTeamChange={pendingTeamChange}
      teamError={teamError}
      teamValue={teamValue}
      onTeamValueChange={setTeamValue}
      onConfirmTeamChange={handleConfirmTeamChange}
      isTeamUpdating={isTeamUpdating}
      onCloseTeamChange={handleCloseTeamChange}
      pendingReset={pendingReset}
      resetError={resetError}
      onConfirmReset={handleConfirmReset}
      isResetting={isResetting}
      onCloseReset={handleCloseReset}
      pendingDelete={pendingDelete}
      deleteError={deleteError}
      onConfirmDelete={handleConfirmDelete}
      isDeleting={isDeleting}
      onCloseDelete={handleCloseDelete}
    />
  )
}
