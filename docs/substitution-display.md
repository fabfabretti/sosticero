# Staff-room substitution display

Open either link on the app host:

- `/display?campus=centrale`
- `/display?campus=succursale`

No login is needed and no button is added to the operational top bar. Campus must be explicit; a missing/invalid value shows the two valid links. Anyone able to reach the host can read the displayed substitute/replaced-teacher names, assignments and class entry/exit changes. There is no separate approval or Comunicato requirement before a saved assignment appears.

The screen shows today's teachers with at least one saved substitution at the selected target campus, alphabetically. Hours 1–7 show class, room and the names of the teachers being replaced; ordinary lessons stay blank. Multiple classes in one hour remain visible. Missing rooms say `Aula n.d.`. Uncovered rows and entry/exit or Dirigente actions do not create teacher rows. A compact section below the grid lists classes entering later or leaving earlier, grouped once per class/action using the latest skipped entry period or earliest exit period. These notes remain visible even when no substitute teachers are assigned. Unresolved saved assignments produce a generic warning; use the authenticated operational app to investigate.

## Monitor setup

Use a landscape 16:9 monitor, preferably 1920×1080, at normal browser zoom. Use the browser's fullscreen command (usually F11). There is no in-app fullscreen button, teacher-count banner or refresh-interval text. The board measures actual content: one table when it fits, two side by side when needed, then alphabetical pages changing every 15 seconds for rare overflow. Page numbering appears when rotating. A fit warning appears if a complete teacher row cannot fit; increase available resolution or reduce browser zoom and check readability at the actual viewing distance.

When pages rotate, moving the pointer or using Tab reveals a pause/resume button. Rotation pauses while a control has keyboard focus, so it does not move away while being used.

The board refreshes every 30 seconds and on returning to the tab. Dates follow Europe/Rome, including daylight saving time, independently of the monitor's timezone. At midnight the previous day's board clears and the new day loads. Weekends show that actual day's assignments; the display does not jump ahead to Monday.

The last successful snapshot time stays visible. A failed same-day refresh retains that snapshot with a stale-data warning and retries automatically. An initial load failure, missing timetable or failed new-day load shows unavailable, never yesterday's assignments as today's. A successful empty board explicitly says no substitutions are assigned today.

Verify the physical monitor's size, viewing distance and longest names/room labels before relying on a particular teacher capacity. In testing mode the red TESTING ribbon remains visible.

## Public read contract

`GET /api/display?campus=centrale|succursale` returns:

```json
{
  "day": "2026-10-28",
  "campus": "centrale",
  "updated": "2026-10-28T09:00:00+01:00",
  "teachers": [
    {"name": "Rossi Maria", "slots": [{"period": 2, "classe": "1A", "room": "A12", "replaced": ["Bianchi Anna"]}]}
  ],
  "changes": [{"classe": "2A", "action": "ENTRA", "period": 2}],
  "incomplete": false
}
```

The server chooses today's date and the effective saved timetable, overrides and displayed names. It exposes only these fields, uses a coordinated read snapshot and sends `Cache-Control: no-store`. It returns 422 for a missing/invalid campus and 503 when no timetable is available. This endpoint has no mutation operation. Existing day APIs, exports, attachments and all operational write permissions retain their authentication requirements. Full state, absence reasons, private notes, attachments and recovery records are excluded from the public response.
