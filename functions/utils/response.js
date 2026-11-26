export function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...extraHeaders
        }
    });
}

export function errorResponse(message, status = 400, details = null) {
    const payload = { success: false, error: message };
    if (details) payload.details = details;
    return jsonResponse(payload, status);
}
