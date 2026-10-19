import { FhirDate } from '../fhir-mapper.types';

export class Period {
  start?: FhirDate;
  end?: FhirDate;

  constructor(start?: string | Date | null, end?: string | Date | null) {
    this.start = start ? formatDate(start) : undefined;
    this.end = end ? formatDate(end) : undefined;
  }
}

function formatDate(date: string | Date): FhirDate {
  const d = new Date(date);
  return d.toISOString().substring(0, 10);
}
