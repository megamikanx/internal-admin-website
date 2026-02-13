import { useEffect, useMemo, useState } from "react"
import Login from "./pages/Login"
import Dashboard from "./components/Dashboard"
import MeetingSchedule from "./components/MeetingSchedule"
import DrinksPage from "./components/DrinksPage"
import AccountsPage from "./components/AccountsPage"
import RoomsPage from "./components/RoomsPage"
import type { ThemeMode } from "./types/theme"
import {
  getMe,
  logout,
  type User,
  updatePassword,
} from "./lib/api"

type PageKey = "dashboard" | "meetings" | "drinks" | "accounts" | "rooms"

function App() {
  // 전역 테마 및 사용자 상태
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light"
    }
    const stored = window.localStorage.getItem("theme")
    return stored === "dark" || stored === "pink" ? stored : "light"
  })
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", theme)
    }
  }, [theme])
  // 화면 전환 상태
  const [activePage, setActivePage] = useState<PageKey>("dashboard")

  const availablePages = useMemo<PageKey[]>(() => {
    const base: PageKey[] = ["dashboard", "meetings", "drinks"]
    if (user?.admin_status) {
      base.push("accounts", "rooms")
    }
    return base
  }, [user?.admin_status])

  // 초기 사용자 로딩
  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      try {
        const me = await getMe()
        if (isMounted) {
          setUser(me)
          window.history.replaceState({}, "", "/dashboard")
          setActivePage("dashboard")
        }
      } catch {
        
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadUser()
    return () => {
      isMounted = false
    }
  }, [])

  // 로그인 상태에 따른 라우팅
  useEffect(() => {
    if (!isLoading && !user) {
      window.history.replaceState({}, "", "/login")
    }
  }, [isLoading, user])

  // 권한에 따라 화면 보정
  useEffect(() => {
    if (user && !availablePages.includes(activePage)) {
      setActivePage("dashboard")
    }
  }, [activePage, availablePages, user])

  

  const handleLogin = (nextUser: User) => {
    setUser(nextUser)
    window.history.replaceState({}, "", "/dashboard")
    setActivePage("dashboard")
  }

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      setUser(null)
      window.history.replaceState({}, "", "/login")
      setActivePage("dashboard")
    }
  }

  // 비밀번호 변경 요청
  const handleUpdatePassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    await updatePassword(currentPassword, newPassword)
  }

  // 로딩/로그인 화면 처리
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EEEEF0] text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-12">
          <p className="text-sm text-slate-400">사용자 정보를 확인 중...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  // 네비게이션 버튼 스타일
  const navButtonClasses = (page: PageKey) => {
    if (theme === "dark") {
      return `flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
        activePage === page
          ? "bg-[#4e0082] text-white"
          : "text-[#F8FAFC] hover:bg-[var(--bg)] hover:text-white"
      }`
    }
    if (theme === "pink") {
      return `flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
        activePage === page
          ? "bg-[#FA73DA] text-[#22232A]"
          : "text-[#22232A] hover:bg-[#FF94E4] hover:text-[#22232A]"
      }`
    }
    return `flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
      activePage === page
        ? "bg-[#DAB1FD] text-black"
        : "text-[#393B46] hover:bg-[#C7CCD1] hover:text-black"
    }`
  }

  // 화면 렌더링
  return (
    <div className="min-h-screen bg-[#EEEEF0] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-row">
        <aside className="w-56 border-r border-slate-800 bg-slate-900/60 px-5 py-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Remited Admin
            </p>
            <p className="mt-2 text-lg font-semibold">메뉴</p>
          </div>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActivePage("dashboard")}
              className={navButtonClasses("dashboard")}
            >
              대시보드
            </button>
            <button
              type="button"
              onClick={() => setActivePage("meetings")}
              className={navButtonClasses("meetings")}
            >
              일정
            </button>
            <button
              type="button"
              onClick={() => setActivePage("drinks")}
              className={navButtonClasses("drinks")}
            >
              음료 주문
            </button>
            {user.admin_status ? (
              <>
                <button
                  type="button"
                  onClick={() => setActivePage("accounts")}
                  className={navButtonClasses("accounts")}
                >
                  계정 관리
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage("rooms")}
                  className={navButtonClasses("rooms")}
                >
                  회의실 관리
                </button>
              </>
            ) : null}
          </nav>
        </aside>
        <main className="flex-1 px-6 py-10">
          {activePage === "dashboard" ? (
            <Dashboard
              user={user}
              onLogout={handleLogout}
              onUpdateUser={setUser}
              onUpdatePassword={handleUpdatePassword}
              theme={theme}
              onThemeChange={setTheme}
            />
          ) : null}
          {activePage === "meetings" ? (
            <MeetingSchedule
              currentUser={user}
              isDark={theme === "dark"}
              theme={theme}
            />
          ) : null}
          {activePage === "drinks" ? (
            <DrinksPage user={user} theme={theme} />
          ) : null}
          {activePage === "accounts" && user.admin_status ? (
            <AccountsPage theme={theme} />
          ) : null}
          {activePage === "rooms" && user.admin_status ? (
            <RoomsPage />
          ) : null}
        </main>
      </div>
    </div>
  )
}

export default App
