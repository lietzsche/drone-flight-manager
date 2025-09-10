import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  updateSchedule,
  updateScheduleStatus,
  type FlightSchedule,
  type ScheduleStatus,
  type Page,
} from '../api'

export function useSchedules(range: { from: string; to: string }) {
  const queryClient = useQueryClient()
  const queryKey = ['schedules', range]

  const list = useQuery<Page<FlightSchedule>>({
    queryKey,
    queryFn: () => getSchedules({ from: range.from, to: range.to, size: 500 }),
  })

  const create = useMutation({
    mutationFn: (payload: Omit<FlightSchedule, 'id' | 'ownerId'>) => createSchedule(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<FlightSchedule, 'id' | 'ownerId'>> }) =>
      updateSchedule(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ScheduleStatus }) => updateScheduleStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteSchedule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { list, create, update, updateStatus: updateStatusMutation, remove }
}

