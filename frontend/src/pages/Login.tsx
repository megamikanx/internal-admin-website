import { useState, type FormEvent } from "react"
import { getMe, login, type User } from "../lib/api"

type LoginProps = {
  onLogin: (user: User) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(email, password)
      const user = await getMe()
      onLogin(user)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "로그인에 실패했습니다."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL?.toString() ?? "http://localhost:8000"

  return (
    <div className="min-h-screen bg-[#EEEEF0] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Remited Admin
            </p>
            <h1 className="mt-2 text-2xl font-semibold">유저 로그인</h1>
            <p className="mt-2 text-sm text-slate-400">
              teamremited.com 이메일로 로그인하세요.
            </p>
          </div>

          <form className="space-y-4 text-left" onSubmit={handleSubmit}>
            <label className="block text-sm text-slate-300">
              이메일
              <input
                type="email"
                autoComplete="email"
                placeholder="name@teamremited.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>

            <label className="block text-sm text-slate-300">
              비밀번호
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </label>

            {error ? (
              <p className="text-sm text-[#FF6363]">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
          <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-800" />
            또는
            <span className="h-px flex-1 bg-slate-800" />
          </div>
          <a
            href={`${apiBaseUrl}/auth/google/login`}
            className="flex w-full items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white"
          >
            Google로 로그인
          </a>
        </div>
      </div>
    </div>
  )
}
