import type { Device, EventsResponse, Filters, Stats } from './types.ts';

const BASE = '/api';

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE}/status`);
  return res.json();
}

export async function fetchDevices(): Promise<Device[]> {
  const res = await fetch(`${BASE}/devices`);
  return res.json();
}

export async function fetchEvents(
  filters: Partial<Filters>,
  limit = 50,
  offset = 0
): Promise<EventsResponse> {
  const params = new URLSearchParams();
  if (filters.device_ids?.length) filters.device_ids.forEach(id => params.append('device_id', id));
  if (filters.kind)        params.set('kind',        filters.kind);
  if (filters.downloaded !== undefined && filters.downloaded !== '')
                           params.set('downloaded',  filters.downloaded);
  if (filters.favorited  !== undefined && filters.favorited  !== '')
                           params.set('favorited',   filters.favorited);
  if (filters.date_from)  params.set('date_from',   String(new Date(filters.date_from).getTime() / 1000));
  if (filters.date_to)    params.set('date_to',     String(new Date(filters.date_to).getTime() / 1000 + 86399));
  params.set('limit',  String(limit));
  params.set('offset', String(offset));

  const res = await fetch(`${BASE}/events?${params}`);
  return res.json();
}

export function videoUrl(eventId: string): string {
  return `${BASE}/video/${eventId}`;
}

export function thumbnailUrl(eventId: string): string {
  return `${BASE}/thumbnail/${eventId}`;
}

export async function toggleFavorite(eventId: string): Promise<{ favorited: number }> {
  const res = await fetch(`${BASE}/events/${eventId}/favorite`, { method: 'POST' });
  return res.json();
}
