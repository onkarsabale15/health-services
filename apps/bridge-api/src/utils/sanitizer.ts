import sanitizeHtml from 'sanitize-html';

export function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    return sanitizeHtml(data, { allowedTags: [], allowedAttributes: {} });
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeInput(item));
  }
  if (data && typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return data;
}
