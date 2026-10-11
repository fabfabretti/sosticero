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
export type Assignment = { v: string; t: string; c: string };
export type Data = {
  dataset: {
    teachers: Record<string, Teacher>;
    classes: string[];
    warnings: unknown[];
  };
  state: {
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
