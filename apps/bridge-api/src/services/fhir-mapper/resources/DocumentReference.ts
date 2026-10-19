import type {
  DocumentReference as FhirDocumentReference,
  Extension,
  Meta,
  Reference,
  Identifier,
  CodeableConcept,
} from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export class DocumentReference extends BaseResource {
  constructor(id?: string | number) {
    super('DocumentReference', id);
    this.data.identifier = [];
    this.data.docStatus = undefined;
    this.data.category = [];
    this.data.author = [];
    this.data.relatesTo = [];
    this.data.securityLabel = [];
    this.data.content = [];
    this.data.extension = [];
  }

  addIdentifier(identifier: Identifier): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  setStatus(status: FhirDocumentReference['status']): this {
    this.data.status = status;
    return this;
  }

  setType(type: CodeableConcept): this {
    this.data.type = type;
    return this;
  }

  addCategory(category: CodeableConcept): this {
    if (!this.data.category) this.data.category = [];
    (this.data.category as any[]).push(category);
    return this;
  }

  setSubject(subject: Reference): this {
    this.data.subject = subject;
    return this;
  }

  setDate(date: string): this {
    this.data.date = date;
    return this;
  }

  addAuthor(author: Reference): this {
    if (!this.data.author) this.data.author = [];
    (this.data.author as any[]).push(author);
    return this;
  }

  setCustodian(custodian: Reference): this {
    this.data.custodian = custodian;
    return this;
  }

  addContent(content: FhirDocumentReference['content'] extends (infer U)[] ? U : never): this {
    if (!this.data.content) this.data.content = [];
    (this.data.content as any[]).push(content);
    return this;
  }

  setContext(context: FhirDocumentReference['context']): this {
    this.data.context = context;
    return this;
  }

  addExtension(extension: Extension): this {
    if (!this.data.extension) this.data.extension = [];
    (this.data.extension as any[]).push(extension);
    return this;
  }

  setMeta(meta: Meta): this {
    this.data.meta = meta;
    return this;
  }
}
