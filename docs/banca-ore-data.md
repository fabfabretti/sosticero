# Recurring Banca ore declarations and account attribution

A declaration is identified by `(weekday, teacher ID, hour)`, not by its author or campus.
`paidAvailability[weekday][teacher ID][hour]` stores:

```json
{"createdBy":"immutable-account-id","createdFrom":{"id":"immutable-account-id","username":"maria.rossi","name":"Maria Rossi"}}
```

`createdFrom` is now an account snapshot, not a campus. `createdBy` remains the
immutable ID for compatibility. Permit creators and paid-assignment `assignedBy`
use the same `{id,username,name}` snapshot shape; Inbox already uses it. Actual
campus is separate, for example `paidContext.site`. The UI resolves the current full name and username by saved account ID. Stored
snapshots are used only if that account is unavailable. Ordinary edits preserve existing authors;
removing and readding a declaration records the current account.

Schema 9 exports preserve snapshots. Imports accept schemas 1–9 and legacy campus
strings. Startup and restore normalize legacy attribution idempotently. Existing
paid `createdBy` IDs take precedence over campus labels. Legacy null IDs remain
unknown; the former Centrale placeholder does not prove authorship. Campus-only
permit/assignment authors use the explicitly verified, persisted legacy mapping.
Unresolved authors retain readable legacy/unknown labels. Historical names never
change on later account renames or permission changes.

Imported foreign snapshots remain intact without requiring their accounts locally.
Imports never create users. School archives/backups contain no passwords or sessions.
The per-teacher/weekday concurrency boundary and derived hour-array report stay intact.

## Budget e tariffe delle supplenze a pagamento

In **Amministrazione → Configurazione → Supplenze a pagamento**, gli amministratori
possono impostare per ogni sede un budget e le tariffe orarie per laureati e
diplomati. Tutti gli importi sono facoltativi: vuoto significa non configurato,
mentre zero è un valore esplicito. ITP usa automaticamente la tariffa diplomato;
gli altri ruoli usano laureato. Le eccezioni si impostano nella classificazione
economica del docente, senza cambiare il ruolo importato.

Ogni salvataggio ricalcola tutte le assegnazioni a pagamento già registrate,
anche future, con le tariffe e classificazioni correnti. Se una tariffa viene
rimossa, le ore corrispondenti tornano da valorizzare. Ogni ora
usa la tariffa della sede in cui si svolge la supplenza. Rimuovere o sostituire
un’assegnazione elimina il suo contributo; un nuovo incarico usa la tariffa corrente.

Banca ore mostra gli importi impegnati per tutte le ore registrate, comprese quelle
future e quelle da verificare, indipendentemente dalla settimana della griglia.
Non ci sono anni scolastici separati o azzeramenti automatici. Le ore senza tariffa
compaiono come **Da valorizzare** e rendono il totale monetario parziale.
Lo sforamento produce un avviso ma consente l’assegnazione: la percentuale può
superare il 100% e viene mostrato l’importo eccedente. Con budget zero, la
percentuale non è disponibile. Se una sola sede ha un budget, la percentuale
complessiva riguarda solo quella sede; la spesa dell’altra resta visibile.
Il registro dettagliato è l’unico elenco delle assegnazioni a pagamento.

### Persistenza e API

`paidFinance` è un documento con `sites.centrale` e `sites.succursale`, ciascuno
contenente `budget`, `laureato` e `diplomato` (centesimi interi non negativi o
`null`), e `overrides` (ID stabile docente → `laureato`/`diplomato`).
`GET /api/paid-finance` e `POST /api/paid-finance` sono riservati agli admin.
Il POST richiede `{config, expected}` con il token ottenuto dal GET; il client
conserva anche la generazione per evitare salvataggi attraverso un ripristino.
La risposta riporta `priced` (ore con costo o classificazione modificati) e `unpriced` (ore rimanenti).

Ogni assegnazione PAID valorizzata conserva `paidPrice: {cents, classification}`.
Il report `/api/paid-availability` include `finance` con i totali derivati per sede,
le sedi con budget, il loro totale e il totale generale. I conteggi per docente
restano disponibili per l’ordinamento equo dei candidati, senza riepilogo inline.
Gli avvisi di budget sono restituiti nelle risposte di salvataggio assegnazione.
Gli archivi schema 11 includono configurazione e costi; gli schemi precedenti
restano importabili con configurazione assente e ore legacy non valorizzate.
Importare un archivio conserva i costi presenti senza eseguire una valorizzazione
implicita. Backup SQLite e ripristini conservano entrambi i documenti.
