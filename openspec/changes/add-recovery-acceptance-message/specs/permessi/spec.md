# Spec Delta

## ADDED Requirements

### Requirement: Recovery acceptance marker
Each assigned RP row SHALL expose a reversible Accettata toggle beside the substitute. Its shared state SHALL persist across reloads, backups and archive round trips. Missing state SHALL mean unaccepted. Toggling SHALL NOT change permit attribution, reservation, recovered hours or balances. Changing the substitute or replacing the RP assignment SHALL clear acceptance; resaving the same RP assignment SHALL preserve it.

#### Scenario: Confirm and undo
- **WHEN** an authorized user activates Accettata for an RP assignment and reloads
- **THEN** the row shows the accepted state, including a check mark and accessible pressed state
- **AND** activating it again clears acceptance without changing the linked permit or accounting

#### Scenario: Legacy and portable state
- **WHEN** older data without acceptance is loaded
- **THEN** RP assignments appear unaccepted
- **AND** acceptance saved in new data survives backup restoration and validated archive round trips

#### Scenario: Replace accepted assignment
- **WHEN** an accepted RP assignment is removed or assigned to another substitute or assignment type
- **THEN** its acceptance does not transfer to the new assignment
- **AND** resaving the same RP substitute preserves acceptance

### Requirement: Validated recovery acceptance edits
Acceptance edits SHALL require an existing RP assignment, a strict boolean and the existing assignment concurrency baseline. They SHALL require the account's campus to match the server-derived row campus. Unauthorized controls SHALL explain their disabled state. Invalid, stale or unauthorized requests SHALL leave data unchanged. Archives SHALL reject malformed acceptance values or acceptance metadata on non-RP assignments atomically.

#### Scenario: Campus restriction
- **WHEN** an account tries to accept another campus's RP assignment
- **THEN** the control is visibly disabled with an accessible reason and sends no mutation
- **AND** a direct request is rejected with 403

#### Scenario: Stale or malformed edit
- **WHEN** acceptance is submitted against an outdated assignment baseline, a missing or non-RP assignment, or with a non-boolean value
- **THEN** the request fails without changing the assignment or permit balance

#### Scenario: Invalid archive
- **WHEN** an archive contains non-boolean acceptance or acceptance on a non-RP assignment
- **THEN** import fails atomically

### Requirement: Copy recovery request
Each assigned RP row SHALL expose a keyboard-accessible copy-icon button with an accessible label. It SHALL copy the complete subject and body as plain text, using current substitution details and the linked permit, without sending email or changing acceptance. Successful copies SHALL announce Copiato; unavailable or failed clipboard access SHALL show an accessible error without claiming success. Copy SHALL remain available across campuses.

#### Scenario: Dated single-period permit
- **WHEN** the user copies a request for a substitution on 27/10/2026, period 3, class 1A, room 12, linked to a permit on 12/10/2026 for period 2
- **THEN** the clipboard contains exactly the following text, with a blank line between subject and greeting:

```text
[Recupero permesso] 27/10/2026 · 3ª ora · 1A

Gentile Professoressa/Professore,

In assenza di altre soluzioni, richiederei la sua presenza in data/ora
27/10/2026 · 3ª ora classe 1A, aula 12, recuperando l'ora di permesso presa il 12/10/2026 alla 2ª ora. Le è possibile?

Grazie mille e cordiali saluti,
Fabiola Fabretti
```

#### Scenario: Copy does not confirm acceptance
- **WHEN** either campus's account successfully copies an unaccepted RP request
- **THEN** Copiato is announced and the assignment remains unaccepted
- **AND** no email is sent

#### Scenario: Clipboard failure
- **WHEN** clipboard access is unavailable or denied
- **THEN** an accessible error explains that copying failed and acceptance remains unchanged

### Requirement: Recovery message permit variants
Request text SHALL use Italian dates in gg/mm/aaaa format. For a dated permit with several periods it SHALL list all periods in ascending order, without inventing individual-hour attribution. For a manual balance it SHALL omit original date and periods. Missing room SHALL appear as aula da verificare; missing linked-permit details SHALL prevent copying and explain the problem rather than fabricate values.

#### Scenario: Several original periods
- **WHEN** the linked permit contains periods 3 and 2 on 12/10/2026
- **THEN** the recovery clause is "recuperando l'ora di permesso presa il 12/10/2026 alle ore 2ª e 3ª. Le è possibile?"
- **AND** additional periods use commas with e before the final period

#### Scenario: Manual balance
- **WHEN** the RP assignment uses a manual permit balance without an original date
- **THEN** the recovery clause is "recuperando un'ora del saldo permessi pregresso. Le è possibile?"

#### Scenario: Missing room or permit
- **WHEN** the substitution room is missing but the linked permit is available
- **THEN** the request uses "aula da verificare"
- **WHEN** the linked permit information cannot be resolved
- **THEN** copying is blocked with an accessible explanation
