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
 * Riferimento: CVE-2022-21449, CWE-327, CWE-347
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
            publicKey:  fs.existsSync(path.join(keysDir, 'public.pem'))
                            ? fs.readFileSync(path.join(keysDir, 'public.pem'),  'utf-8')
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
 */
function requireAuth(role = 'user') {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.redirect('/login');
        }

        const token = authHeader.slice(7);
        const { publicKey } = loadKeys();

        if (!publicKey) {
            return res.status(500).send('Errore configurazione server');
        }

        try {
            // VULNERABILE: algorithms non è fissato a ['RS256']
            // La libreria accetta qualsiasi algoritmo dichiarato nel token
            const decoded = jwt.verify(token, publicKey, {
                // algorithms: ['RS256']  ← questa riga mancante è la vulnerabilità
            });

            // Controlla il ruolo richiesto
            if (role === 'admin' && decoded.role !== 'admin') {
                return res.status(403).render('403', {
                    message: 'Privilegi insufficienti.'
                });
            }

            req.user = decoded;
            next();
        } catch (err) {
            return res.redirect('/login');
        }
    };
}

module.exports = { requireAuth, generateGuestToken, loadKeys };
