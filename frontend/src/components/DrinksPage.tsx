import { useEffect, useState } from "react"
import type { ThemeMode } from "../types/theme"
import {
  approveDrinkOrder,
  cancelDrinkOrder,
  createDrinkOrder,
  getDrinkOrders,
  getMyDrinkOrders,
  rejectDrinkOrder,
  type DrinkOrder,
  type User,
} from "../lib/api"

type DecisionPayload = {
  order: DrinkOrder
  action: "approve" | "reject"
}

export default function DrinksPage({
  user,
  theme,
}: {
  user: User
  theme: ThemeMode
}) {
  // 화면 상태 관리
  const [drinkOrders, setDrinkOrders] = useState<DrinkOrder[]>([])
  const [isDrinkLoading, setIsDrinkLoading] = useState(false)
  const [drinkError, setDrinkError] = useState<string | null>(null)
  const [isDrinkModalOpen, setIsDrinkModalOpen] = useState(false)
  const [drinkName, setDrinkName] = useState("")
  const [drinkUrl, setDrinkUrl] = useState("")
  const [drinkSubmitError, setDrinkSubmitError] = useState<string | null>(null)
  const [isSubmittingDrink, setIsSubmittingDrink] = useState(false)
  const [drinkSuccess, setDrinkSuccess] = useState(false)
  const [isCancelMode, setIsCancelMode] = useState(false)
  const [pendingCancel, setPendingCancel] = useState<DrinkOrder | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [isDecisionMode, setIsDecisionMode] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<DecisionPayload | null>(
    null
  )
  const [isDecisionProcessing, setIsDecisionProcessing] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [decisionReason, setDecisionReason] = useState("")
  const [drinkPage, setDrinkPage] = useState(1)

  // 주문 목록 로드
  useEffect(() => {
    let isMounted = true
    const loadOrders = async () => {
      setIsDrinkLoading(true)
      setDrinkError(null)

      try {
        const loader = user.admin_status ? getDrinkOrders : getMyDrinkOrders
        const orders = await loader()
        if (isMounted) {
          setDrinkOrders(orders)
        }
      } catch (err) {
        if (isMounted) {
          const message =
            err instanceof Error ? err.message : "주문 목록을 불러오지 못했습니다."
          setDrinkError(message)
        }
      } finally {
        if (isMounted) {
          setIsDrinkLoading(false)
        }
      }
    }

    loadOrders()

    return () => {
      isMounted = false
    }
  }, [user])

  // 페이지네이션 초기화
  useEffect(() => {
    setDrinkPage(1)
  }, [drinkOrders.length, user.admin_status])

  // 주문 목록 새로고침
  const refreshDrinkOrders = async () => {
    setIsDrinkLoading(true)
    setDrinkError(null)

    try {
      const loader = user.admin_status ? getDrinkOrders : getMyDrinkOrders
      const orders = await loader()
      setDrinkOrders(orders)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "주문 목록을 불러오지 못했습니다."
      setDrinkError(message)
    } finally {
      setIsDrinkLoading(false)
    }
  }

  // 모달 및 폼 액션
  const handleOpenDrinkModal = () => {
    setDrinkName("")
    setDrinkUrl("")
    setDrinkSubmitError(null)
    setIsDrinkModalOpen(true)
  }

  const handleCloseDrinkModal = () => {
    if (isSubmittingDrink) {
      return
    }
    setIsDrinkModalOpen(false)
    setDrinkSubmitError(null)
  }

  const handleSubmitDrink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDrinkSubmitError(null)

    const name = drinkName.trim()
    const url = drinkUrl.trim()

    if (!name || !url) {
      setDrinkSubmitError("상품명과 상품 링크를 모두 입력하세요.")
      return
    }

    setIsSubmittingDrink(true)
    try {
      const newOrder = await createDrinkOrder({
        drink_name: name,
        product_url: url,
      })
      setDrinkOrders((prev) => [newOrder, ...prev])
      setDrinkSuccess(true)
      setIsDrinkModalOpen(false)
      setDrinkName("")
      setDrinkUrl("")
      window.setTimeout(() => {
        setDrinkSuccess(false)
      }, 2500)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "주문을 처리할 수 없습니다."
      setDrinkSubmitError(message)
    } finally {
      setIsSubmittingDrink(false)
    }
  }

  const handleToggleCancelMode = () => {
    setIsCancelMode((prev) => !prev)
    setCancelError(null)
    setPendingCancel(null)
    setIsDecisionMode(false)
    setPendingDecision(null)
    setDecisionError(null)
  }

  const handleCloseCancel = () => {
    if (isCancelling) {
      return
    }
    setPendingCancel(null)
    setCancelError(null)
  }

  const handleConfirmCancel = async () => {
    if (!pendingCancel) {
      return
    }

    setIsCancelling(true)
    setCancelError(null)

    try {
      await cancelDrinkOrder(pendingCancel.order_id)
      setDrinkOrders((prev) =>
        prev.filter((order) => order.order_id !== pendingCancel.order_id)
      )
      setPendingCancel(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "주문을 취소할 수 없습니다."
      setCancelError(message)
    } finally {
      setIsCancelling(false)
    }
  }

  const handleToggleDecisionMode = () => {
    setIsDecisionMode((prev) => !prev)
    setDecisionError(null)
    setPendingDecision(null)
    setIsCancelMode(false)
    setCancelError(null)
    setPendingCancel(null)
  }

  const handleCloseDecision = () => {
    if (isDecisionProcessing) {
      return
    }
    setPendingDecision(null)
    setDecisionError(null)
    setDecisionReason("")
  }

  const handleConfirmDecision = async () => {
    if (!pendingDecision) {
      return
    }

    setIsDecisionProcessing(true)
    setDecisionError(null)

    try {
      if (pendingDecision.action === "approve") {
        await approveDrinkOrder(pendingDecision.order.order_id)
      } else {
        await rejectDrinkOrder(
          pendingDecision.order.order_id,
          decisionReason.trim() || undefined
        )
      }
      await refreshDrinkOrders()
      setPendingDecision(null)
      setDecisionReason("")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "주문 처리를 완료할 수 없습니다."
      setDecisionError(message)
    } finally {
      setIsDecisionProcessing(false)
    }
  }

  // 화면 렌더링
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">음료 주문</h1>
          <p className="mt-2 text-sm text-slate-400">
            {user.admin_status
              ? "전체 음료 주문 현황을 확인합니다."
              : "내가 신청한 음료 주문 현황을 확인합니다."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenDrinkModal}
            className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF]"
          >
            + 신청하기
          </button>
          <button
            type="button"
            onClick={handleToggleCancelMode}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              isCancelMode
                ? "bg-[#FF4242]"
                : "bg-[#FF6363] hover:bg-[#FF4242]"
            }`}
          >
            - 신청 취소
          </button>
          {user.admin_status ? (
            <button
              type="button"
              onClick={handleToggleDecisionMode}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                theme === "dark"
                  ? "bg-[#B968ff] text-white hover:bg-[#B968ff]"
                  : "bg-[#DAB1FD] text-black hover:bg-[#B968FF]"
              }`}
            >
              승인하기
            </button>
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        {drinkSuccess ? (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            주문이 정상적으로 처리되었습니다
          </div>
        ) : null}
        {isCancelMode ? (
          <p className="mb-3 text-sm text-[#FF4242]">
            취소할 주문을 선택해주세요.
          </p>
        ) : null}
        {isDrinkLoading ? (
          <p className="text-sm text-slate-400">불러오는 중...</p>
        ) : null}
        {drinkError ? (
          <p className="text-sm text-[#FF6363]">{drinkError}</p>
        ) : null}
        {!isDrinkLoading && !drinkError ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="whitespace-nowrap px-2 py-2 font-medium">
                    상품명
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">
                    상품 링크
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">
                    현황
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">
                    신청 일시
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">
                    승인
                  </th>
                  <th className="w-24 whitespace-nowrap px-2 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {drinkOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-2 py-6 text-center text-slate-400"
                    >
                      표시할 주문이 없습니다.
                    </td>
                  </tr>
                ) : (
                  [...drinkOrders]
                    .sort((a, b) => {
                      const rank = (status: DrinkOrder["status"]) => {
                        if (status === "pending") return 0
                        if (status === "approved") return 1
                        return 2
                      }
                      return rank(a.status) - rank(b.status)
                    })
                    .slice((drinkPage - 1) * 10, drinkPage * 10)
                    .map((order) => (
                      <tr
                        key={order.order_id}
                        className="group border-b border-slate-900/80 last:border-b-0"
                      >
                        <td className="whitespace-nowrap px-2 py-2">
                          {order.drink_name}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <a
                            href={order.product_url}
                            target="_blank"
                            rel="noreferrer"
                            title={order.product_url}
                            className={`block max-w-xs truncate transition ${
                              theme === "dark"
                                ? "text-[#EEEEF0] hover:text-white"
                                : "text-[#505462] hover:text-[#393B46]"
                            }`}
                          >
                            {order.product_url}
                          </a>
                        </td>
                        <td
                          className={`whitespace-nowrap px-2 py-2 capitalize ${
                            order.status === "pending"
                              ? "text-amber-300"
                              : order.status === "approved"
                                ? "text-emerald-300"
                                : "text-rose-300"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            {order.status}
                            {order.status === "rejected" && order.reason ? (
                              <span className="relative inline-flex">
                                <span className="h-2 w-2 rounded-full bg-[#FF4242]" />
                                <span className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 shadow-lg group-hover:inline-flex">
                                  {order.reason}
                                </span>
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {order.submitted_at
                            ? new Date(order.submitted_at).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                }
                              )
                            : "-"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <span
                            className="block max-w-[140px] truncate"
                            title={
                              order.reviewed_by_name ??
                              (order.reviewed_by !== null &&
                              order.reviewed_by !== undefined
                                ? String(order.reviewed_by)
                                : "-")
                            }
                          >
                            {order.reviewed_by_name ??
                              order.reviewed_by ??
                              "-"}
                          </span>
                        </td>
                        <td className="w-24 px-2 py-2 text-right">
                          {isCancelMode &&
                          order.status === "pending" &&
                          (!user.admin_status ||
                            order.user_id === user.user_id ||
                            order.user_id === undefined) ? (
                            <button
                              type="button"
                              onClick={() => setPendingCancel(order)}
                              className="invisible whitespace-nowrap rounded-lg border border-[#FF4242] px-3 py-1 text-xs text-[#FF4242] transition hover:border-[#E53A3A] hover:text-[#E53A3A] group-hover:visible"
                            >
                              취소
                            </button>
                          ) : null}
                          {isDecisionMode &&
                          user.admin_status &&
                          order.status === "pending" ? (
                            <div className="invisible flex justify-end gap-2 group-hover:visible">
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDecision({
                                    order,
                                    action: "approve",
                                  })
                                }
                                className="whitespace-nowrap rounded-lg border border-[#36CB5B] px-2 py-0.5 text-[11px] text-[#36CB5B] transition hover:border-[#2FB350] hover:text-[#2FB350]"
                              >
                                승인
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDecision({
                                    order,
                                    action: "reject",
                                  })
                                }
                                className="whitespace-nowrap rounded-lg border border-[#FF4242] px-2 py-0.5 text-[11px] text-[#FF4242] transition hover:border-[#E53A3A] hover:text-[#E53A3A]"
                              >
                                취소
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
        {drinkOrders.length > 10 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            {(() => {
              const totalPages = Math.ceil(drinkOrders.length / 10)
              const windowSize = 10
              const windowIndex = Math.floor((drinkPage - 1) / windowSize)
              const startPage = windowIndex * windowSize + 1
              const endPage = Math.min(startPage + windowSize - 1, totalPages)
              const pages = Array.from(
                { length: endPage - startPage + 1 },
                (_, index) => startPage + index
              )

              return (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setDrinkPage(Math.max(1, startPage - windowSize))
                    }
                    disabled={startPage === 1}
                    className={`h-8 w-8 rounded-full border transition ${
                      startPage === 1
                        ? "cursor-not-allowed border-slate-800 text-slate-600"
                        : "border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-indigo-100"
                    }`}
                    aria-label="이전 페이지"
                  >
                    ◀
                  </button>
                  {pages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setDrinkPage(page)}
                      className={`h-8 w-8 rounded-full border transition ${
                        drinkPage === page
                          ? theme === "dark"
                            ? "border-[#DAB1FD] bg-[#DAB1FD] text-black"
                            : "border-indigo-400 bg-indigo-500/20 text-indigo-100"
                          : theme === "dark"
                            ? "border-[#505462] text-[#F8FAFC] hover:border-[#DAB1FD] hover:text-[#DAB1FD]"
                            : "border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-indigo-100"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setDrinkPage(Math.min(totalPages, endPage + 1))
                    }
                    disabled={endPage === totalPages}
                    className={`h-8 w-8 rounded-full border transition ${
                      endPage === totalPages
                        ? "cursor-not-allowed border-slate-800 text-slate-600"
                        : "border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-indigo-100"
                    }`}
                    aria-label="다음 페이지"
                  >
                    ▶
                  </button>
                </>
              )
            })()}
          </div>
        ) : null}
      </div>
      {isDrinkModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">주문 내용을 작성해주세요.</h2>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleSubmitDrink}>
              <label className="block text-sm text-slate-300">
                상품명 <span className="text-[#FF6363]">*</span>
                <input
                  type="text"
                  value={drinkName}
                  onChange={(event) => setDrinkName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </label>
              <label className="block text-sm text-slate-300">
                상품 링크 <span className="text-[#FF6363]">*</span>
                <input
                  type="url"
                  value={drinkUrl}
                  onChange={(event) => setDrinkUrl(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </label>
              {drinkSubmitError ? (
                <p className="text-sm text-[#FF6363]">{drinkSubmitError}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSubmittingDrink}
                  className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingDrink ? "신청 중..." : "신청"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseDrinkModal}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {pendingCancel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">주문 취소</h2>
              <p className="text-sm text-slate-300">
                {pendingCancel.drink_name} 주문을 취소하시겠습니까?
              </p>
            </div>
            {cancelError ? (
              <p className="mt-4 text-sm text-[#FF6363]">{cancelError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancelling ? "취소 중..." : "예"}
              </button>
              <button
                type="button"
                onClick={handleCloseCancel}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDecision ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">주문 처리</h2>
              <p className="text-sm text-slate-300">
                {pendingDecision.order.drink_name} 주문을{" "}
                {pendingDecision.action === "approve"
                  ? "승인하시겠습니까?"
                  : "취소하시겠습니까?"}
              </p>
              {pendingDecision.action === "reject" ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-300">
                    이유를 적어주세요 (선택)
                  </p>
                  <textarea
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                    className="min-h-[90px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#FF4242] focus:outline-none focus:ring-2 focus:ring-[#FF4242]/30"
                    placeholder="거절 사유를 입력하세요."
                  />
                </div>
              ) : null}
            </div>
            {decisionError ? (
              <p className="mt-4 text-sm text-[#FF6363]">{decisionError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConfirmDecision}
                disabled={isDecisionProcessing}
                className="rounded-lg bg-[#9804F9] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B968FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDecisionProcessing ? "처리 중..." : "예"}
              </button>
              <button
                type="button"
                onClick={handleCloseDecision}
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
