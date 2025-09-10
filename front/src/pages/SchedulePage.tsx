import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventInput, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { useEffect, useMemo, useState } from 'react'
import { useSchedules } from '../hooks/useSchedules'
import { type FlightSchedule, type ScheduleStatus } from '../api'

function toIso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const h = pad(d.getHours())
  const min = pad(d.getMinutes())
  const s = pad(d.getSeconds())
  return `${y}-${m}-${day}T${h}:${min}:${s}`
}

function colorFor(status: ScheduleStatus) {
  switch (status) {
    case 'CONFIRMED':
      return '#22c55e'
    case 'CANCELLED':
      return '#ef4444'
    default:
      return '#3b82f6'
  }
}

export default function SchedulePage() {
  const [currentRange, setCurrentRange] = useState<{ from: string; to: string }>(() => {
    const start = new Date()
    start.setDate(1)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    return { from: toIso(start), to: toIso(end) }
  })
  const { list, create, update, remove } = useSchedules(currentRange)
  const [selected, setSelected] = useState<FlightSchedule | null>(null)

  const toInputValue = (dt?: string) => (dt ? dt.slice(0, 16) : '') // 'YYYY-MM-DDTHH:mm'
  const fromInputValue = (val: string) => (val.length === 16 ? `${val}:00` : val)

  // 배경 클릭/스크롤 방지 및 ESC로 모달 닫기
  useEffect(() => {
    if (!selected) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [selected])

  const events = useMemo<EventInput[]>(() => {
    if (!list.data) return []
    return list.data.content.map((s: FlightSchedule) => ({
      id: String(s.id),
      title: s.title,
      start: s.startsAt,
      end: s.endsAt,
      backgroundColor: colorFor(s.status),
      borderColor: colorFor(s.status),
    }))
  }, [list.data])

  const onSelect = async (arg: DateSelectArg) => {
    const title = prompt('제목 입력', 'New Flight') || 'New Flight'
    try {
      await create.mutateAsync({
        title,
        description: '',
        startsAt: toIso(arg.start),
        endsAt: toIso(arg.end ?? new Date(arg.start.getTime() + (arg.allDay ? 24 : 1) * 60 * 60 * 1000)),
        locationName: '',
        lat: undefined,
        lng: undefined,
        status: 'PLANNED',
      })
    } catch (e: any) {
      alert(e?.message || '생성 실패')
    }
  }

  const onEventDrop = async (arg: EventDropArg) => {
    const id = Number(arg.event.id)
    try {
      const start = arg.event.start!
      const end = arg.event.end ?? new Date(start.getTime() + (arg.event.allDay ? 24 : 1) * 60 * 60 * 1000)
      await update.mutateAsync({ id, data: { startsAt: toIso(start), endsAt: toIso(end) } })
    } catch (e: any) {
      alert(e?.message || '이동 실패')
      arg.revert()
    }
  }

  const onEventResize = async (arg: EventResizeDoneArg) => {
    const id = Number(arg.event.id)
    try {
      const start = arg.event.start!
      const end = arg.event.end ?? new Date(start.getTime() + (arg.event.allDay ? 24 : 1) * 60 * 60 * 1000)
      await update.mutateAsync({ id, data: { startsAt: toIso(start), endsAt: toIso(end) } })
    } catch (e: any) {
      alert(e?.message || '리사이즈 실패')
      arg.revert()
    }
  }

  const onEventClick = (info: any) => {
    const id = Number(info.event.id)
    const found = list.data?.content.find((s) => s.id === id) || null
    setSelected(found)
  }

  const handleSave = async () => {
    if (!selected) return
    try {
      await update.mutateAsync({
        id: selected.id,
        data: {
          title: selected.title,
          description: selected.description,
          startsAt: selected.startsAt ? fromInputValue(selected.startsAt) : undefined,
          endsAt: selected.endsAt ? fromInputValue(selected.endsAt) : undefined,
          locationName: selected.locationName,
          lat: selected.lat,
          lng: selected.lng,
          status: selected.status,
        },
      })
      setSelected(null)
    } catch (e: any) {
      alert(e?.message || '수정 실패')
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await remove.mutateAsync(selected.id)
      setSelected(null)
    } catch (e: any) {
      alert(e?.message || '삭제 실패')
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">비행 스케줄</h1>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
        selectable
        selectMirror
        dayMaxEvents
        events={events}
        select={onSelect}
        editable
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        eventClick={onEventClick}
        datesSet={(info) => setCurrentRange({ from: toIso(info.start), to: toIso(info.end) })}
        height="auto"
      />
      {list.isLoading && <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>}
      {list.error && <p className="mt-3 text-sm text-red-500">{(list.error as any).message}</p>}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded shadow-lg p-4 w-full max-w-md"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-medium mb-3">스케줄 상세</h2>
            <div className="space-y-2">
              <div>
                <label className="block text-sm text-gray-600">제목</label>
                <input
                  autoFocus
                  className="border rounded w-full px-2 py-1"
                  value={selected.title}
                  onChange={(e) => setSelected({ ...selected, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">설명</label>
                <textarea
                  className="border rounded w-full px-2 py-1"
                  value={selected.description || ''}
                  onChange={(e) => setSelected({ ...selected, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600">시작</label>
                  <input
                    type="datetime-local"
                    className="border rounded w-full px-2 py-1"
                    value={toInputValue(selected.startsAt)}
                    onChange={(e) => setSelected({ ...selected, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">종료</label>
                  <input
                    type="datetime-local"
                    className="border rounded w-full px-2 py-1"
                    value={toInputValue(selected.endsAt)}
                    onChange={(e) => setSelected({ ...selected, endsAt: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600">장소</label>
                <input
                  className="border rounded w-full px-2 py-1"
                  value={selected.locationName || ''}
                  onChange={(e) => setSelected({ ...selected, locationName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600">위도</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="border rounded w-full px-2 py-1"
                    value={selected.lat ?? ''}
                    onChange={(e) =>
                      setSelected({ ...selected, lat: e.target.value === '' ? undefined : Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">경도</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="border rounded w-full px-2 py-1"
                    value={selected.lng ?? ''}
                    onChange={(e) =>
                      setSelected({ ...selected, lng: e.target.value === '' ? undefined : Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600">상태</label>
                <select
                  className="border rounded w-full px-2 py-1"
                  value={selected.status}
                  onChange={(e) => setSelected({ ...selected, status: e.target.value as any })}
                >
                  <option value="PLANNED">PLANNED</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 text-sm" onClick={() => setSelected(null)}>
                닫기
              </button>
              <button className="px-3 py-1 text-sm text-red-600" onClick={handleDelete}>
                삭제
              </button>
              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded" onClick={handleSave}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

