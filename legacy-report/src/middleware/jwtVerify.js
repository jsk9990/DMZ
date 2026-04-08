/**
 * middleware/jwtVerify.js
 *
 * VULNERABILITÀ: Algorithm Confusion Attack (RS256 → HS256)
 *
 * Il middleware legge l'algoritmo direttamente dall'header del token
 * senza validare che sia RS256. Se l'attaccante presenta un token
 * firmato con HS256 usando la chiave pubblica RSA come secret,
 * il server lo verifica correttamente e lo accetta.
 *
 * Riferimento: CVE-2022-21449, CWE-327, CWE-347 CONTROLLARE BENE RIFERIMENTO CVE, FORSE è QUELLO SBAGLIATO
 */

const jwt  = require('jsonwebtoken');
const fs   = require('fs');
const path = require('path');

// Carica chiavi a runtime dal .config
function loadKeys() {
    try {
        const config  = fs.readFileSync('/opt/app/.config', 'utf-8');
        const getProp = (key) => {
            const m = config.match(new RegExp(`^${key}=(.+)$`, 'm'));
            return m ? m[1].trim() : null;
        };

        const pubPath  = getProp('JWT_PUBLIC_KEY_PATH');
        const privPath = getProp('JWT_PRIVATE_KEY_PATH');

        return {
            publicKey:  pubPath  ? fs.readFileSync(pubPath,  'utf-8') : null,
            privateKey: privPath ? fs.readFileSync(privPath, 'utf-8') : null,
        };
    } catch {
        // Fallback locale per sviluppo
        const keysDir = path.join(__dirname, '..', 'keys');
        return {
            publicKey:  fs.existsSync(path.join(keysDir, 'public.crt'))
                            ? fs.readFileSync(path.join(keysDir, 'public.crt'),  'utf-8')
                            : null,
            privateKey: fs.existsSync(path.join(keysDir, 'private.pem'))
                            ? fs.readFileSync(path.join(keysDir, 'private.pem'), 'utf-8')
                            : null,
        };
    }
}

/**
 * Genera un JWT RS256 legittimo per un utente guest.
 * Usato dall'endpoint /api/auth/login.
 */
function generateGuestToken() {
    const { privateKey } = loadKeys();
    if (!privateKey) throw new Error('Chiave privata non disponibile');

    return jwt.sign(
        { user: 'guest', role: 'user' },
        privateKey,
        { algorithm: 'RS256', expiresIn: '2h' }
    );
}

/**
 * Middleware di verifica JWT — VULNERABILE.
 *
 * Il problema sta in jwt.verify() chiamato con [publicKey, publicKey]:
 * jsonwebtoken v8 accetta un array di segreti/chiavi e prova ognuno.
 * Se il token dichiara alg:HS256, la libreria usa la chiave come
 * segreto HMAC invece che come chiave RSA pubblica per la verifica.
 * Poiché l'attaccante ha firmato il token con la stessa chiave pubblica
 * usata come segreto HMAC, la verifica passa.
 *
 * Una implementazione sicura fisserebbe algorithms: ['RS256']
 * e non accetterebbe mai alg dall'header del token.
 * 
 * PROBLEMA: 
 * Nelle recenti e addiritura nella versione 8.x, gli sviluppatori hanno patchato
 * questa cosa all'interno della libreria, quindi anche volendo forzare il comportamento 
 * vulnerabile, questa cosa comunque crea dei problemi. errore continuo di "invalid signature"
 * andando ad analizzare la libreria, verificato questo problema, si è pensato di aggirarlo sotto 
 * forma di certificato X.509, in quanto la patch era sulla verifica della stringa "BEGIN KEY". 
 * Dato che il certificato inizia per "BEGIN CERTIFICATE" pensavo di riuscire ad aggirarlo. Invece no, quindi
 * ho adottato un codice credo abbastanza banale, ma che mi permette di replicare il problema del JWT Confusion
 * 
 */
function requireAuth(role = 'user') {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).send('Accesso negato');
        }

        const token = authHeader.slice(7).trim();
        const { publicKey } = loadKeys();
        console.log("DEBUG SERVER - Lunghezza chiave pubblica:", publicKey.length)

        if (!publicKey) {
            return res.status(500).send('Errore configurazione server');
        }

        try {
            // 1. Spacchiamo il token in tre parti: header.payload.signature
            const parts = token.split('.');
            if (parts.length !== 3) {
                return res.status(401).send("Formato token non valido");
            }

            // 2. Decodifichiamo l'header a mano in puro JavaScript (infallibile)
            const headerStr = Buffer.from(parts[0], 'base64').toString('utf-8');
            const header = JSON.parse(headerStr);
            
            let decoded;
            
            // 3. LA VERA SIMULAZIONE DELL'ALGORITHM CONFUSION
            if (header.alg === 'HS256') {
                // Se attacca con HS256, forziamo la libreria a usare la chiave testuale
                decoded = jwt.verify(token, publicKey, { algorithms: ['HS256'] });
            } else {
                // Comportamento normale
                decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
            }

            // 4. Controllo privilegi
            if (role === 'admin' && decoded.role !== 'admin') {
                return res.status(403).render('403', { message: 'Privilegi insufficienti.' });
            }

            req.user = decoded;
            next();
            
        } catch (err) {
            console.log("ERRORE JWT:", err.message);
            return res.status(401).send("ERRORE: " + err.message);
        }
    };
}

/**
 * Funzione creata a fini di controllo della macchina, in quanto avendo problemi con 
 * la chiave, pensavo che ci fosse una qualche sorta di controllo, oppure problemi a livello di 
 * byte di creazione, quindi una volta conferma di altro si può pure rimuovere 
*/
function generateForgedAdminToken(username = 'guest_hacker') {
    const { publicKey } = loadKeys();
    
    if (!publicKey) {
        console.log("[-] Impossibile generare il token: chiave pubblica mancante.");
        return;
    }

    const payload = {
        user: username,
        role: 'admin' // Scaliamo i privilegi
    };

    // VULNERABILITÀ EXPLOITATA DIRETTAMENTE QUI:
    // Usiamo la publicKey come password testuale per l'HS256
    const forgedToken = jwt.sign(payload, publicKey, { algorithm: 'HS256' });

    console.log("\n=======================================================");
    console.log(`🔥 TOKEN ADMIN FORGIATO PER L'UTENTE: ${username}`);
    console.log("Lunghezza esatta della chiave in memoria:", publicKey.length);
    console.log("Copia la riga seguente e usala in Postman/Curl:");
    console.log("Bearer " + forgedToken);
    console.log("=======================================================\n");

    return forgedToken;
}

module.exports = { requireAuth, generateGuestToken, loadKeys, generateForgedAdminToken };
