export type Sex = 'Male' | 'Female' | 'Other';

export type MediaKind = 'image' | 'pdf' | 'doc' | 'video' | 'dicom' | 'other';

export type MediaFile = {
  id: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size?: number;
  storage_path: string;
  section: 'pre_op' | 'post_op' | 'video';
  uploaded_at?: string;
  dataUrl?: string;
};

export type ShareEntry = {
  user_id: string;
  scope: 'read' | 'edit';
  email: string;
  name: string;
  shared_at?: string;
};

export type Patient = {
  id: string;
  name: string;
  age: number;
  sex: Sex;
  mobile: string;
  country_code: string;
  diagnosis: string;
  history: string;
  date_of_surgery?: string | null;
  followup_days?: number | null;
  operative_note: string;
  discharge_note: string;
  result: string;
  pre_op: MediaFile[];
  post_op: MediaFile[];
  videos: MediaFile[];
  shared_with?: ShareEntry[];
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type Role = 'admin' | 'editor' | 'viewer';

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture: string;
  role: Role;
  last_active?: string | null;
};

export type Invite = {
  email: string;
  role: Role;
  invited_at?: string | null;
  emailed?: boolean;
};

export type Colleague = {
  user_id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor';
};

export type ActivityEvent = {
  id: string;
  actor_id: string;
  actor_name: string;
  action: 'create' | 'update' | 'delete' | 'share' | 'unshare' | 'media_added' | string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  meta: Record<string, any>;
  at: string;
};

export type ThemeMode = 'light' | 'dark' | 'system';
