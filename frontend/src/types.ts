export type AbsenceKind = "planned" | "last_minute" | "trip" | null;
export type Teacher = {
  id: string;
  name: string;
  code: string;
  role: string;
  classe_concorso?: string;
  retired?: boolean;
};
export type Row = {
  id: string;
  ids: string[];
  h: number;
  c: string;
  k: string;
  aula: string | null;
  sede: string | null;
};
export type Candidate = {
  convenient?: boolean;
  rpHours?: number;
  exceptional?: boolean;
  typeLabel?: string;
  color?: string;
  id: string;
  name: string;
  ty: string;
  loc: string | null;
  why: string;
  tag: string;
  today: number;
  total: number;
  role?: string;
  cdc?: string;
  cdcName?: string;
  clsWeek?: string[];
  inClass?: boolean;
  enable?: boolean;
  info?: string;
};
export type PermitRecovery = { id: string; deadline: string; recovered: number; remaining: number; expired: boolean; recoveries: { date: string; h: number; key: string }[] };
export type Assignment = { v: string; t: string; c: string; permitId?: string };
export type Data = {
  dataset: {
    teachers: Record<string, Teacher>;
    lessons: Record<string, { classes: string[] }>;
    classes: string[];
    warnings: unknown[];
  };
  state: {
    absenceNotes?: Record<string, Record<string, string>>;
    permitNotes?: Record<string, Record<string, string>>;
    absenceKinds?: Record<string, Record<string, AbsenceKind>>;
    permitKinds?: Record<string, Record<string, AbsenceKind>>;
    permessi?: Record<string, Record<string, number[]>>;
    permitRequests?: Record<string, Record<string, string>>;
    abs: Record<string, Record<string, number[]>>;
    cf: Record<string, Record<string, number[]>>;
    dis: Record<string, Record<string, number[]>>;
    disSites: Record<string, Record<string, string>>;
    asg: Record<string, Record<string, Assignment>>;
  };
  rows: Row[];
  issues: { key: string; message: string }[];
  autoDis: Record<string, Record<string, Record<number, string[]>>>;
};
