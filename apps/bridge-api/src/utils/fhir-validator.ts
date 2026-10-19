import { AppError } from '@hs/ehr-data-service';

type Schema = Record<string, unknown>;
type FormatFn = (value: string) => boolean;

const FORMATS: Record<string, FormatFn> = {
  'yyyy-mm-dd': (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
  'apt-date': (v) => {
    const dateRegex =
      /^(ge|le|gt|lt|eq|ne|sa|eb|ap)?\d{4}(-\d{2}(-\d{2}(T\d{2}(:\d{2}(:\d{2}(\.\d+)?)?)?(Z|([+-]\d{2}:\d{2}))?)?)?)?$/;
    return v.split(',').every((part) => dateRegex.test(part.trim()));
  },
  'date-time': (v) => !isNaN(Date.parse(v)),
  email: (v) => v.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  'postal-code': (v) => /^\d{5}(-\d{4})?$/.test(v),
};

class FhirValidator {
  private readonly schemas = new Map<string, Schema>();

  validate(schema: object, data: unknown): void {
    const errors = this.check(schema as Schema, data, '');
    if (errors.length > 0) {
      throw new AppError(400, errors.join(', '));
    }
  }

  addSchema(key: string, schema: object): void {
    this.schemas.set(key, schema as Schema);
  }

  private check(schema: Schema, data: unknown, path: string): string[] {
    const errors: string[] = [];

    if (schema['type'] !== undefined) {
      const typeErr = this.checkType(schema['type'] as string | string[], data, path);
      if (typeErr) return [typeErr];
    }

    if (schema['format'] !== undefined && typeof data === 'string') {
      const fn = FORMATS[schema['format'] as string];
      if (fn && !fn(data)) {
        errors.push(`${path || '/'} must match format "${schema['format']}"`);
      }
    }

    if (schema['enum'] !== undefined && !(schema['enum'] as unknown[]).includes(data)) {
      errors.push(`${path || '/'} must be one of: ${(schema['enum'] as unknown[]).join(', ')}`);
    }

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;

      if (Array.isArray(schema['required'])) {
        for (const field of schema['required'] as string[]) {
          if (!(field in obj)) {
            errors.push(`${path}/${field} is required`);
          }
        }
      }

      if (schema['properties'] !== undefined) {
        for (const [key, sub] of Object.entries(schema['properties'] as Record<string, Schema>)) {
          if (key in obj) {
            errors.push(...this.check(sub, obj[key], `${path}/${key}`));
          }
        }
      }
    }

    if (Array.isArray(data) && schema['items'] !== undefined) {
      data.forEach((item, i) => errors.push(...this.check(schema['items'] as Schema, item, `${path}/${i}`)));
    }

    return errors;
  }

  private checkType(type: string | string[], data: unknown, path: string): string | null {
    const types = Array.isArray(type) ? type : [type];
    const actual = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
    if (!types.includes(actual)) {
      return `${path || '/'} must be of type ${types.join(' or ')}, got ${actual}`;
    }
    return null;
  }
}

export const fhirValidator = new FhirValidator();
