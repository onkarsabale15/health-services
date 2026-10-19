import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { logger } from '@hs/observability';
import { FILE_ARRAY_KEY, type SnomedMappingFileRecord } from './icd-snomed-file.interfaces';

// ─── Streaming JSON Reader ───────────────────────────────────────────────────
//
// The source file is ~72MB. Loading it with `JSON.parse(readFileSync(...))`
// would spike memory and risk OOM. Instead we pipe it through `stream-json`:
//
//   fs.createReadStream(file)
//     → parser()               ← tokenizes JSON
//     → pick({ filter: KEY })  ← descends into the top-level array key
//     → streamArray()          ← emits one { key, value } per record
//
// The returned async iterator yields records one at a time so the orchestrator
// can batch them into fixed-size chunks for the DB upsert.

export interface IcdSnomedFileReader {
  /** Validate the file exists and return its size in bytes. */
  inspect(): Promise<{ absolutePath: string; sizeBytes: number }>;

  /** Async iterator over every record in the file. */
  iterate(): AsyncIterable<SnomedMappingFileRecord>;
}

export class StreamingIcdSnomedFileReader implements IcdSnomedFileReader {
  constructor(private readonly filePath: string) {}

  async inspect(): Promise<{ absolutePath: string; sizeBytes: number }> {
    const absolutePath = resolvePath(this.filePath);
    await access(absolutePath);
    const { size } = await stat(absolutePath);
    logger.info('SNOMED mapping file located', {
      path: absolutePath,
      sizeBytes: size,
    });
    return { absolutePath, sizeBytes: size };
  }

  iterate(): AsyncIterable<SnomedMappingFileRecord> {
    const absolutePath = resolvePath(this.filePath);
    return iterateRecords(absolutePath);
  }
}

// ─── Internal: stream → async iterator ───────────────────────────────────────

async function* iterateRecords(absolutePath: string): AsyncGenerator<SnomedMappingFileRecord> {
  const pipeline = createReadStream(absolutePath, { encoding: 'utf8' })
    .pipe(parser())
    .pipe(pick({ filter: FILE_ARRAY_KEY }))
    .pipe(streamArray());

  for await (const item of pipeline as AsyncIterable<{
    key: number;
    value: SnomedMappingFileRecord;
  }>) {
    yield item.value;
  }
}
