/**
 * app.js — LegacyReportEngine v2.1.3
 * Entry point principale
 */

const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');
const fs   = require('fs');


const authRoutes       = require('./routes/auth');
const reportsRoutes    = require('./routes/reports');
const managementRoutes = require('./routes/management');

const app = express();

// ── Inizializzazione automatica ───────────────────────────────────────────
const { execSync } = require('child_process');
const crypto = require('crypto');

(function init() {
    const keysDir   = path.join(__dirname, 'keys');
    const privPath  = path.join(keysDir, 'private.pem');
    const crtPath   = path.join(keysDir, 'public.crt');
    const jwksPath  = path.join(__dirname, 'public', 'jwks.json');
    const configPath = '/opt/app/.config';

    // 1. Genera chiavi RSA se non esistono
    if (!fs.existsSync(privPath) || !fs.existsSync(crtPath)) {
        console.log('[init] Generazione chiavi RSA 2048 e Certificato...');
        fs.mkdirSync(keysDir, { recursive: true });
        //Generazione chiave privata...
        execSync(`openssl genrsa -out ${privPath} 2048`);
        //Modifica: generazione certificato x.509 autofirmato (bypass jsonwebtoken v8)
        execSync(`openssl req -new -x509 -key ${privPath} -out ${crtPath} -days 3650 -subj "/CN=LegacyReportEngine"`);
        
        console.log('[init] Chiavi RSA generate.');
    }

    // 2. Rigenera sempre jwks.json dalla chiave pubblica corrente
    const certPem = fs.readFileSync(crtPath, 'utf-8');
    const pubKey = crypto.createPublicKey(certPem);
    const jwk    = pubKey.export({ format: 'jwk' });
    const jwks   = {
        keys: [{
            kty: jwk.kty,
            use: 'sig',
            alg: 'RS256',
            kid: 'legacy-report-key-1',
            n:   jwk.n,
            e:   jwk.e
        }]
    };
    fs.writeFileSync(jwksPath, JSON.stringify(jwks, null, 2));
    console.log('[init] jwks.json aggiornato.');

    // 3. Crea /opt/app/.config se non esiste
    if (!fs.existsSync(configPath)) {
        console.log('[init] Creazione /opt/app/.config...');
        try {
            fs.mkdirSync('/opt/app', { recursive: true });
            fs.writeFileSync(configPath, [
                '# LegacyReportEngine — Runtime Configuration',
                '# DO NOT EXPOSE THIS FILE',
                '',
                'JWT_ALGORITHM=RS256',
                `JWT_PUBLIC_KEY_PATH=${crtPath}`,
                `JWT_PRIVATE_KEY_PATH=${privPath}`,
                'INTERNAL_NETWORK_HOST= da cambiare dopo per proseguo',
                'INTERNAL_NETWORK_PORT= discorso sopra',
                'APP_ENV=production',
                'DEBUG=false',
            ].join('\n'), { mode: 0o600 });
            console.log('[init] /opt/app/.config creato.');
        } catch (e) {
            console.warn(`[init] WARN: impossibile creare .config — ${e.message}`);
            console.warn('[init] Eseguire con sudo oppure creare il file manualmente.');
        }
    }
})();

// ── 4. Crea file backup pubblico con hint ────────────────────────────────
const bakContent = `<?xml version="1.0" encoding="UTF-8"?>
<!--
    LegacyReportEngine v2.1.3 — Template di configurazione report
    Backup generato il: 2024-01-15T09:22:11Z
    Autore: sysadmin@legacy-corp.internal

    NOTE SVILUPPATORE:
    - Il sistema di autenticazione è stato migrato a JWT in v2.1.0
    - Algoritmo in uso: RS256
    - Claims obbligatorie: user (string), role (string: user|admin)
    - Il pannello di gestione è su /management/dashboard
    - Autenticazione tramite Bearer token nell'header Authorization
    - JWKS disponibile per validazione esterna
-->
<report-config>
    <metadata>
        <version>2.1.3</version>
        <engine>LegacyReportEngine</engine>
        <auth-scheme>JWT-RS256</auth-scheme>
    </metadata>
    <template>
        <title>Report Mensile</title>
        <author>Sistema Automatico</author>
        <fields>
            <field name="title"  required="true"  maxlen="128"/>
            <field name="author" required="false" maxlen="64"/>
            <field name="date"   required="false" format="DD/MM/YYYY"/>
            <field name="body"   required="true"  maxlen="4096"/>
        </fields>
    </template>
</report-config>`;

fs.writeFileSync(
    path.join(__dirname, 'backup', 'config.bak'),
    bakContent
);

// ── View engine ───────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Header fuorvianti
app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('Server', 'Apache/2.2.31 (Ubuntu)');
    res.setHeader('X-Application', 'LegacyReportEngine/2.1.3');
    next();
});

// ── Rotte pubbliche ───────────────────────────────────────────────────────

// Homepage
app.get('/', (req, res) => {
    res.render('index', { title: 'LegacyReport Dashboard' });
});

// Auth routes: /login, /api/auth/login, /.well-known/jwks.json
app.use('/', authRoutes);

// Reports routes: /reports, /reports/upload
app.use('/reports', reportsRoutes);

// Management routes: /management/dashboard (JWT protetto)
app.use('/management', managementRoutes);

// ── Error handlers ────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', message: 'Resource not found' });
});

app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    res.status(500).send('Internal Server Error');
});

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LegacyReportEngine] Avviato su http://0.0.0.0:${PORT}`);
    console.log(`[LegacyReportEngine] Ambiente: ${process.env.NODE_ENV || 'production'}`);
});
