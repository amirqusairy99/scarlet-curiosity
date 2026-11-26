import { errorResponse } from './response.js';

function base64UrlEncode(bytes) {
    let str = '';
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) {
        str += String.fromCharCode(arr[i]);
    }
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function getHmacKey(secret) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

export async function signJwt(payload, secret, expiresInSeconds = 3600) {
    const enc = new TextEncoder();
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
        ...payload,
        iat: now,
        exp: now + expiresInSeconds
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(fullPayload)));
    const dataToSign = `${headerB64}.${payloadB64}`;

    const key = await getHmacKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));
    const sigB64 = base64UrlEncode(signature);

    return `${dataToSign}.${sigB64}`;
}

export async function verifyJwt(token, secret) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const enc = new TextEncoder();
    const dataToVerify = `${headerB64}.${payloadB64}`;

    try {
        const key = await getHmacKey(secret);
        const signatureBytes = base64UrlDecode(sigB64);
        const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, enc.encode(dataToVerify));
        if (!isValid) return null;

        const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
        const payload = JSON.parse(payloadJson);

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return { expired: true };
        }

        return payload;
    } catch (e) {
        return null;
    }
}

export async function authenticateRequest(request, env) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: errorResponse('No token provided', 401) };
    }

    const token = authHeader.split(' ')[1];
    const secret = env.JWT_SECRET || 'scarlet_super_secret_jwt_key_change_in_production';
    const decoded = await verifyJwt(token, secret);

    if (!decoded) {
        return { error: errorResponse('Invalid token', 403) };
    }
    if (decoded.expired) {
        return { error: errorResponse('Token expired', 403) };
    }

    return { user: decoded };
}
