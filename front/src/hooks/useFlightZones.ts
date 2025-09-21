import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFlightZone,
  deleteFlightZone,
  getFlightZones,
  updateFlightZone,
  type FlightZone,
  type FlightZonePayload,
  type CreateFlightZonePayload,
} from '../api';

type UpdateArgs = { id: number; data: FlightZonePayload };

type CreateArgs = CreateFlightZonePayload;

export function useFlightZones() {
  const queryClient = useQueryClient();
  const queryKey = ['flight-zones'];

  const list = useQuery<FlightZone[]>({
    queryKey,
    queryFn: getFlightZones,
  });

  const create = useMutation({
    mutationFn: (payload: CreateArgs) => createFlightZone(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: UpdateArgs) => updateFlightZone(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteFlightZone(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { list, create, update, remove };
}
