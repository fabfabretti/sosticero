
## Campus-change notices for availability assignments

`GET /api/day/{day}` includes `campusNotices`, indexed by qualifying assignment key. Each notice contains `day`, `teacher`, `origin`, `destination`, chronological `rows`, a content `fingerprint`, and independent `communicated` / `accepted` booleans. Rows for the same teacher, day and campus pair share one notice. Only D assignments between two different known campuses qualify.

`POST /api/assignments` accepts `{day, key, campus_notice: true, communicated: true, expected}` or the equivalent `accepted` field (one status per request). `expected` must include the current `asg|<day>|<key>` and `campusNotice|<day>|<key>` tokens from daily concurrency data, plus the existing generation precondition when present. The server resolves and updates the complete group atomically, enforcing destination-campus assignment permission. Stale membership, content or status yields 409; invalid requests yield 422. Copying text does not mark communication or acceptance.

Assignments optionally persist `campusNotice: {fingerprint, communicated, accepted}`. This metadata is validated on archive import. Missing metadata defaults to false; changes to notice membership or message content invalidate both statuses. Existing RP, paid and entry/exit status fields retain their semantics.

All teacher-facing clipboard templates (recupero permesso, paid substitution and campus change) greet the assigned teacher as `Gentile Professore/Professoressa <nome>,` and sign with the currently authenticated account's full `name`. Copying uses the current displayed teacher name, including any configured name override, without changing communication or acceptance status.
