export const DAYS = ["lun", "mar", "mer", "gio", "ven"];
export const HOURS = [1, 2, 3, 4, 5, 6, 7];

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f.\s]/g, "");

type Lesson = { classes?: string[]; activities?: string[]; special?: string; site?: string | null };
type Dataset = {
  teachers: Record<string, { name: string; code?: string; classe_concorso?: string; cdcName?: string; retired?: boolean }>;
  lessons: Record<string, Lesson>;
};

export type TimetableCell = { classes: string[]; codes: string[]; partners: string[]; site: string | null };
export type TeacherTimetable = {
  id: string;
  name: string;
  code: string;
  cdc: string;
  cdcName: string;
  cells: (TimetableCell | null)[][];
};

// One teacher's week, with compresenza taken from the other teachers who share a class and hour.
export function buildTeacherTimetables(dataset: Dataset): TeacherTimetable[] {
  const byClass: Record<string, string[]> = {};
  for (const [key, l] of Object.entries(dataset.lessons || {})) {
    const [id, day, hour] = key.split("|");
    for (const c of l.classes || []) (byClass[`${day}|${hour}|${c}`] ||= []).push(id);
  }
  const scheduled = new Set(Object.keys(dataset.lessons || {}).map(k => k.split("|")[0]));
  return Object.entries(dataset.teachers || {})
    .filter(([id, t]) => !t.retired && scheduled.has(id))
    .map(([id, t]) => ({
      id,
      name: t.name,
      code: t.code || "",
      cdc: t.classe_concorso || "",
      cdcName: t.cdcName || t.classe_concorso || "",
      cells: DAYS.map(day =>
        HOURS.map(h => {
          const l = dataset.lessons[`${id}|${day}|${h}`];
          if (!l) return null;
          const classes = l.classes || [];
          const partners = new Set<string>();
          for (const c of classes)
            for (const other of byClass[`${day}|${h}|${c}`] || []) if (other !== id) partners.add(other);
          return {
            classes,
            site: l.site || null,
            codes: l.activities?.length ? l.activities : l.special ? [l.special] : [],
            partners: [...partners],
          };
        }),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
