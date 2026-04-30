# 🎯 Progetto Tesi: Compromissione Infrastruttura DMZ e Movimento Laterale (Target 1)

Questo repository contiene il codice sorgente e le configurazioni vulnerabili del **Target 1 (DMZ Server)**, parte di un laboratorio di Penetration Testing avanzato sviluppato per scopi di ricerca e tesi accademica. 

Lo scenario simula una web application legacy esposta su internet ("Legacy Dashboard"), progettata per dimostrare come catene di vulnerabilità applicative e di configurazione possano portare alla compromissione totale del server e consentire il *Pivoting* verso reti interne isolate.

---

## ⚙️ Architettura e Tecnologie

* **Sistema Operativo:** Linux (Ubuntu/Debian)
* **Web Server:** Node.js con framework Express
* **Template Engine:** EJS (Embedded JavaScript templates)
* **Ruolo di Rete:** Server esposto in DMZ (Dual-homed: connesso a Internet e alla rete interna `10.0.0.x`).
* **Principi Violati (OWASP Top 10):**
    * A01:2021 - Broken Access Control
    * A02:2021 - Cryptographic Failures (JWT Algorithm Confusion)
    * A03:2021 - Injection (XXE, SSTI)
    * A05:2021 - Security Misconfiguration

---

## ⛓️ Full Cyber Kill Chain (Il Flusso di Attacco)

Il laboratorio è progettato per essere risolto seguendo una precisa metodologia per fasi:

### Fase 1: Ricognizione ed Enumerazione (Reconnaissance)
L'attacco ha inizio con la mappatura dei servizi esposti sulla macchina Target (IP `192.168.1.192`):
* **Nmap Scanning:** Una scansione mirata (`nmap -sC -sV -O`) rivela l'apertura delle porte 22 (SSH) e 3000 (HTTP/Node.js).
* **Directory Enumeration:** L'analisi del codice sorgente (`view-source`) rivela l'uso di EJS. L'utilizzo di strumenti come `dirb` espone path critici, in particolare `/login`, `/reports` e un'area riservata `/management` protetta da errore 401 (Unauthorized).

### Fase 2: Initial Access & Information Disclosure (XXE)
L'endpoint `/reports` accetta il caricamento di file XML per la gestione documentale aziendale, risultando vulnerabile a **XML External Entity (XXE) Injection**.
1. L'attaccante verifica la falla leggendo `/etc/passwd`, scoprendo gli utenti di sistema `dmz-server` e l'account di servizio `legacyreport` (con home directory `/opt/app`).
2. **Il trucco del Path Virtuale:** Impossibilitato a listare le directory, l'attaccante sfrutta il symlink di Linux `file:///proc/self/cwd/` per estrarre file dalla directory di lavoro del processo web.
3. Estraendo il file `package.json`, mappa le dipendenze (es. `jsonwebtoken`) e gli entry-point dell'app. Attraverso lo stesso vettore, legge il file sorgente `routes/auth.js`.

### Fase 3: Authentication Bypass (JWT Algorithm Confusion)
La lettura del codice sorgente rivela credenziali a basso privilegio hardcoded (`guest:guest123`) e svela una vulnerabilità critica nel middleware di validazione dei token: il **Trust Boundary Violation** (CVE-2015-9256).
1. L'attaccante estrae la chiave pubblica RSA esposta dal server (`/.well-known/jwks.json`).
2. Sfruttando la mancanza di una whitelist di algoritmi nel backend, l'attaccante forgia un token JWT modificando l'header in `alg: HS256` e il payload in `role: admin`.
3. Il token viene firmato simmetricamente usando il modulo `n` della chiave pubblica come secret HMAC. Il server verifica positivamente la firma, garantendo l'accesso non autorizzato all'endpoint `/management/dashboard`.

### Fase 4: Remote Code Execution (SSTI)
All'interno del pannello di amministrazione, il meccanismo di rendering dei report soffre di **Server-Side Template Injection (SSTI)**.
* **Frontend Evasion:** L'attaccante aggira i blocchi di validazione JavaScript lato client forzando l'inserimento del token JWT contraffatto direttamente nel `sessionStorage` del browser.
* **Asynchronous Reverse Shell:** Inettando un payload Node.js asincrono nel template EJS (`require('child_process').spawn`), l'attaccante stabilisce una Reverse Shell interattiva verso la macchina Kali, agganciando l'utente `legacyreport`.

### Fase 5: Privilege Escalation (Security Misconfiguration)
La scalata ai privilegi massimi sfrutta il principio del "Least Privilege" implementato in modo errato dagli amministratori.
* L'enumerazione locale (`sudo -l`) rivela che l'utente `legacyreport` possiede diritti sudo *passwordless* per riavviare il demone `/etc/systemd/system/legacy-monitor.service`.
* L'eseguibile richiamato dal demone (`/opt/app/monitor.sh`) risulta scrivibile dall'utente compromesso.
* L'attaccante sovrascrive lo script iniettando istruzioni per copiare la `/bin/bash` in locale e assegnarle il bit **SUID**. Riavviando il servizio, la trappola scatta ed elargisce una shell `root`.

### Fase 6: Post-Exploitation e Network Discovery
Ottenuto l'accesso `root`, l'attaccante raccoglie gli "Artifacts" per pianificare il movimento laterale. Attraverso l'ispezione di file ambientali (`.config`), e  analisi del codice scopre:
* La topologia della rete interna isolata (`10.10.10.x`).
* Il Target Intermedio (**Legacy-Data-Processor**: `10.10.10.20:5000`).
* Il meccanismo di trasmissione dati inter-server: i dati vengono inviati dalla DMZ al backend sotto forma di oggetti JSON codificati in (`base64`). L'assenza di controlli crittografici su questo canale fiduciario apre la strada all'identificazione di una vulnerabilità di **Insecure Deserialization** sul parser del backend `(che si scoprirà essere vulnerabile tramite parsing YAML)`.

---

## 🎓 Ostacoli Tecnici e Realismo del Sistema

Questo laboratorio è ingegnerizzato per riflettere dinamiche reali di mitigazione e hardening, obbligando l'attaccante a deviare dai percorsi di exploit standard:
* **Il Flaw Logico JWT:** Il backend applica un parsing manuale dell'header JWT per isolare e dimostrare accademicamente la falla architetturale originaria, senza l'interferenza delle "regex patch" aggiunte silenziosamente dalle librerie moderne, richiedendo una forgiatura chirurgica tramite script custom o `jwt_tool`.
* **Systemd PrivateTmp & nosuid:** Durante la Privilege Escalation, i tentativi di creare la shell SUID in `/tmp` vengono intercettati e annullati dalle flag `nosuid` e dall'isolamento temporaneo generato dal modulo `PrivateTmp` di systemd.

---

## 🛠️ Setup del Laboratorio (Istruzioni di Deploy)

Per ricreare questo ambiente su una macchina virtuale Linux vergine:

1.  **Clonare il repository:**
    ```bash
    git clone [https://github.com/TUO-NOME/legacy-report-dmz-lab.git](https://github.com/TUO-NOME/legacy-report-dmz-lab.git)
    cd legacy-report-dmz-lab
    ```

2.  **Installare le dipendenze dell'app:**
    ```bash
    cd src
    npm install
    ```

3.  **Configurare le vulnerabilità di sistema (Richiede privilegi di Root):**
    Configurare l'utente di servizio (`legacyreport`) e copiare i file dalla cartella `vulnerable_configs/` nelle rispettive directory di sistema preservando i permessi di scrittura intenzionalmente errati:
    * `/etc/systemd/system/legacy-monitor.service` (Demone)
    * `/etc/sudoers.d/legacy-monitor` (Policy Sudo)
    * `/opt/app/monitor.sh` (Script esca)
    * `/root/.bash_history` (Indizi Post-Exploitation)

4.  **Avviare l'applicazione:**
    ```bash
    node app.js
    ```

---
*Disclaimer: Questo progetto è stato realizzato esclusivamente a scopo accademico e di ricerca. Qualsiasi utilizzo delle tecniche qui descritte su sistemi non autorizzati è strettamente proibito.*
