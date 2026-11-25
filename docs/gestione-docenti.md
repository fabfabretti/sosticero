# Gestione docenti

Gli amministratori aprono **Amministrazione → Gestione docenti**. Non serve accesso operativo a Orari.

## Assenze prolungate

La schermata iniziale elenca i docenti attualmente assenti per un periodo lungo, per esempio per maternità o cessazione del servizio. Per ogni docente mostra le date e l’eventuale supplente. Le assenze giornaliere ordinarie si inseriscono sempre in **Supplenze**.

**Nuova assenza prolungata** permette di cercare il docente e indicare le date. La data finale è facoltativa e inclusa nel periodo. Senza data finale l’assenza resta aperta. Le assenze future e concluse sono consultabili in un elenco separato.

Un’assenza prolungata senza supplente genera automaticamente le assenze nelle ore previste dall’orario. Le ore derivate sono bloccate in Supplenze e non creano permessi o debiti. I giorni senza ore non generano righe.

## Assegna supplente

Usare **Assegna supplente** accanto al docente assente. La cattedra è già individuata: cercare e selezionare il supplente con i suggerimenti per nome o cognome, oppure scegliere **Nuovo docente** per aggiungerlo direttamente. Le frecce e Invio permettono la selezione da tastiera; scrivere un nome non salva automaticamente.

Nell’anteprima, per ogni ora settimanale con attività non di lezione si può scegliere se mantenerla attiva o disabilitarla nell’orario del supplente. Le scelte restano modificabili nel periodo di supplenza; le supplenze già registrate mantengono il comportamento precedente finché non vengono modificate. Solo le assenze del supplente generano necessità di copertura durante la supplenza. L’originale rimane consultabile in Orari, ma non compare come assente nelle tabelle giornaliere.

**Modifica periodo** modifica le date dell’assenza; **Modifica supplenza** modifica le date della copertura. I periodi restano indipendenti. Se la supplenza termina mentre l’assenza originale continua, le necessità giornaliere riprendono. La sezione dei periodi di supplenza permette anche di programmare un successore sulla stessa cattedra. Le sovrapposizioni sono rifiutate.

## Docenti

La vista **Docenti** permette di cercare le persone e aggiungerne una con **Nuovo docente**. La classe di concorso è facoltativa e si cerca per codice o disciplina: il risultato mostra entrambi, per esempio **A041 — Scienze e tecnologie informatiche**. Viene salvato il codice, mentre il nome è ricavato dal catalogo dell’app.

Ogni persona conserva il proprio ID, permessi, saldo e recuperi anche quando cambia cattedra. Le supplenze precedentemente registrate correttamente restano invariate: i nomi fra parentesi non vengono trasformati automaticamente in nuovi periodi.

## Verifica e salvataggio

Ogni operazione ha una verifica prima del salvataggio. Le coperture e le assenze già registrate sono mantenute e consultabili nei dettagli, senza una casella di revisione. Se il docente assente è stato assegnato a coprire un altro docente nel periodo, la copertura viene mostrata come conflitto e blocca la conferma. Quando un supplente eredita la cattedra, l’anteprima elenca le coperture giornaliere non più necessarie nel periodo: vengono eliminate solo alla conferma. Le coperture fuori periodo restano invariate; eventuali necessità condivise con altri assenti restano soggette a verifica. Nessuna assegnazione o debito viene trasferito implicitamente. Se i dati sono cambiati altrove, ricaricare prima di riprovare.

In Orari il nome originale è barrato accanto al supplente, gli originali assenti sono in grigio e POT è barrato con “non ereditato”. Le ore escluse non contano nel carico, nei limiti dei permessi o nella disponibilità.

Archivi schema 10 e backup conservano persone, periodi e collegamenti. I formati precedenti restano importabili senza inventare supplenze. Gli interventi straordinari su vecchi dati sono manutenzione separata, non una funzione della schermata.

## Accesso personale dei docenti

La scheda **Docenti** mostra lo stato effettivamente salvato: **Email mancante**, **Da attivare**, **Attivo** o **Disattivato**. Attivazione e disattivazione sono immediate: non richiedono un altro salvataggio.

### Inserire molte email

Selezionare **Modifica email**. Scrivere direttamente nelle righe e usare Tab per passare tra i campi. La barra sempre visibile sopra la tabella mostra **Salva email (N)** e **Annulla**. La ricerca e il filtro **Senza email** aiutano a completare l’elenco; il salvataggio comprende anche le righe modificate nascoste dai filtri. Email duplicate o revisioni concorrenti bloccano l’intero salvataggio conservando i valori inseriti. Durante la modifica email, le azioni sugli accessi sono sospese.

L’email serve solo come nome utente, senza invio di messaggi né verifica della casella. Spazi esterni e maiuscole non distinguono gli accessi. Modificare l’email revoca le sessioni precedenti. Per rimuovere un’email da un account attivo, disattivare prima l’accesso.

### Attivare uno o tutti i docenti

Dopo aver salvato le email, selezionare **Attiva accesso** sulla riga oppure **Attiva tutti con email (N)** sopra la tabella. Le caselle di selezione consentono anche di attivare un gruppo specifico tramite **Attiva selezionati (N)**; la casella nell’intestazione seleziona i docenti visibili con email. Il pulsante per tutti include tutti i docenti con email da attivare, anche fuori dal filtro corrente.

L’attivazione salva subito lo stato e genera automaticamente solo i PIN mancanti. I PIN già assegnati non cambiano. Un conflitto blocca l’intero gruppo senza attivazioni parziali. Lo stato **Attivo** compare dopo la conferma del server.

Il pannello dei nuovi PIN consente **Copia elenco** e **Scarica elenco PIN** come file di testo, conservando gli zeri iniziali. I codici restano visibili durante altre modifiche agli accessi e si chiudono esplicitamente; conservare l’elenco prima di uscire. I PIN sono mostrati solo in questa sessione e non sono recuperabili in seguito. Consegnarli personalmente ai docenti.

**Disattiva** salva immediatamente lo stato e revoca le sessioni. **Reimposta PIN** richiede conferma, cambia il codice e revoca le sessioni senza cambiare lo stato attivo/disattivato. Se una risposta di generazione non arriva, ricaricare gli accessi e reimpostare esplicitamente il PIN interessato: ripetere l’attivazione non recupera né rigenera un PIN esistente.

### Accesso al portale

**Apri portale docenti** apre **/docenti** sullo stesso indirizzo dell’app. La pagina di accesso uffici ha anche il pulsante **Accedi al portale docenti**; quella docenti offre **Accedi agli uffici**. Le credenziali dei due accessi sono separate: il docente usa email e PIN personale, non la password Google o quella degli uffici.

**Mostra PIN** consente di controllare il codice inserito; gli spazi esterni incollati sono ignorati. Dopo ripetuti tentativi errati può comparire una limitazione temporanea di quindici minuti, che non richiede reimpostazione del codice. Un PIN dimenticato si recupera rivolgendosi all’amministratore per un reset.

**Il mio orario** apre la data odierna italiana e permette di scegliere altre date, mostrando solo le proprie lezioni e attività, con classe, aula e sede. Gli incarichi dei supplenti seguono i periodi configurati e le credenziali restano personali. Questa versione non mostra supplenze giornaliere, recuperi permessi o conferme di ricezione. Non sono previsti invio email o login Google. Le sessioni scadono dopo dodici ore; **Esci** le revoca subito.
