export interface Device {
  id: string;
  name: string;
  kind: string;
}

export interface Event {
  id: string;
  device_id: string;
  device_name: string;
  kind: string;
  created_at: number;
  duration: number | null;
  file_size: number | null;
  downloaded: number;
  file_deleted: number;
  file_path: string | null;
  downloaded_at: number | null;
  thumbnail_path: string | null;
  favorited: number;
}

export interface EventsResponse {
  events: Event[];
  total: number;
}

export interface Stats {
  total: number;
  downloaded: number;
  pending: number;
}

export interface Filters {
  device_ids: string[];
  kind: string;
  downloaded: string;
  favorited: string;
  show_deleted: boolean;
  date_from: string;
  date_to: string;
}
