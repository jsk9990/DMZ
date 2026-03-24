/**
 * setup.js — Inizializzazione ambiente LegacyReportEngine
 * Eseguire una sola volta con: node setup.js
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const KEYS_DIR   = path.join(__dirname, 'keys');
const CONFIG_PATH = '/opt/app/.config';

console.log('[setup] Avvio inizializzazione...');

// ── 1. Genera coppia RSA 2048 ─────────────────────────────────────────────
if (!fs.existsSync(path.join(KEYS_DIR, 'private.pem'))) {
    console.log('[setup] Generazione chiavi RSA 2048...');
    execSync(`openssl genrsa -out ${KEYS_DIR}/private.pem 2048`);
    execSync(`openssl rsa -in ${KEYS_DIR}/private.pem -pubout -out ${KEYS_DIR}/public.pem`);
    console.log('[setup] Chiavi generate.');
} else {
    console.log('[setup] Chiavi RSA già presenti, skip.');
}

// ── 2. Genera JWK dalla chiave pubblica ──────────────────────────────────
console.log('[setup] Calcolo JWK dalla chiave pubblica...');
const pubPem = fs.readFileSync(path.join(KEYS_DIR, 'public.pem'), 'utf-8');

// Estrai modulus e exponent dalla chiave pubblica
const pubKeyBuf = execSync(
    `openssl rsa -pubin -in ${KEYS_DIR}/public.pem -noout -text 2>/dev/null || true`
).toString();

// Usa node per estrarre i parametri JWK
const crypto = require('crypto');
const pubKey = crypto.createPublicKey(pubPem);
const jwkObj = pubKey.export({ format: 'jwk' });

const jwks = {
    keys: [{
        kty: jwkObj.kty,
        use: "sig",
        alg: "RS256",
        kid: "legacy-report-key-1",
        n:   jwkObj.n,
        e:   jwkObj.e
    }]
};

fs.writeFileSync(
    path.join(__dirname, 'public', 'jwks.json'),
    JSON.stringify(jwks, null, 2)
);
console.log('[setup] jwks.json generato in public/.');

// ── 3. Crea /opt/app/.config ─────────────────────────────────────────────
const configContent = [
    '# LegacyReportEngine — Runtime Configuration',
    '# DO NOT EXPOSE THIS FILE',
    '',
    'JWT_ALGORITHM=RS256',
    `JWT_PUBLIC_KEY_PATH=${KEYS_DIR}/public.pem`,
    `JWT_PRIVATE_KEY_PATH=${KEYS_DIR}/private.pem`,
    'INTERNAL_NETWORK_HOST=10.0.0.2',
    'INTERNAL_NETWORK_PORT=8080',
    'INTERNAL_API_TOKEN=3f9a2c1b-7e4d-4a8f-b6c5-9d2e1f0a3b4c',
    'DB_HOST=10.0.0.5',
    'DB_PORT=5432',
    'DB_NAME=reports_archive',
    'DB_USER=reportuser',
    'DB_PASS=R3p0rt$3rv3r!2024',
    'APP_ENV=production',
    'DEBUG=false',
].join('\n');

try {
    // Crea /opt/app se non esiste
    execSync('mkdir -p /opt/app');
    fs.writeFileSync(CONFIG_PATH, configContent, { mode: 0o600 });
    console.log(`[setup] ${CONFIG_PATH} creato.`);
} catch (e) {
    console.warn(`[setup] WARN: impossibile scrivere ${CONFIG_PATH}: ${e.message}`);
    console.warn('[setup] Assicurarsi di eseguire setup.js con sudo oppure creare il file manualmente.');
}

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
    path.join(__dirname, 'public', 'backup', 'report_config.xml.bak'),
    bakContent
);
console.log('[setup] public/backup/report_config.xml.bak aggiornato.');

console.log('\n[setup] ✓ Setup completato. Avviare con: node app.js\n');
