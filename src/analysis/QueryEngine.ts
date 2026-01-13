import type { MonitoringEvent } from '../schema/types.ts';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export interface QueryFilter {
  type?: string;
  method?: string;
  url?: string | RegExp;
  status?: number;
  level?: string;
  correlationId?: string;
  timestamp?: {
    from?: number;
    to?: number;
  };
  storageType?: 'localStorage' | 'sessionStorage';
  operation?: 'set' | 'get' | 'remove' | 'clear';
}

export class QueryEngine {
  private async* streamEvents(filePath: string): AsyncGenerator<MonitoringEvent> {
    const fileStream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const event = JSON.parse(line) as MonitoringEvent;
          yield event;
        } catch {
          // Skip malformed lines
          continue;
        }
      }
    }
  }

  private matchesFilter(event: MonitoringEvent, filter: QueryFilter): boolean {
    // Type filter (supports comma-separated types)
    if (filter.type) {
      const allowedTypes = filter.type.split(',').map(t => t.trim());
      if (!allowedTypes.includes(event.type)) {
        return false;
      }
    }

    // Network-specific filters
    if (event.type === 'network') {
      const networkEvent = event;
      if (filter.method && networkEvent.method !== filter.method) {
        return false;
      }
      if (filter.url) {
        const urlMatch = typeof filter.url === 'string'
          ? networkEvent.url === filter.url
          : filter.url.test(networkEvent.url);
        if (!urlMatch) return false;
      }
      if (filter.status && networkEvent.status !== filter.status) {
        return false;
      }
      if (filter.correlationId && networkEvent.correlationId !== filter.correlationId) {
        return false;
      }
    }

    // Console-specific filters
    if (event.type === 'console') {
      const consoleEvent = event;
      if (filter.level && consoleEvent.level !== filter.level) {
        return false;
      }
    }

    // Timestamp range filter
    if (filter.timestamp) {
      if (filter.timestamp.from && event.timestamp < filter.timestamp.from) {
        return false;
      }
      if (filter.timestamp.to && event.timestamp > filter.timestamp.to) {
        return false;
      }
    }

    // Correlation ID filter (general)
    if (filter.correlationId && event.correlationId !== filter.correlationId) {
      return false;
    }

    return true;
  }

  async queryEvents(inputPath: string, filter: QueryFilter): Promise<MonitoringEvent[]> {
    const results: MonitoringEvent[] = [];

    for await (const event of this.streamEvents(inputPath)) {
      if (this.matchesFilter(event, filter)) {
        results.push(event);
      }
    }

    return results;
  }

  async* queryEventsStream(inputPath: string, filter: QueryFilter): AsyncGenerator<MonitoringEvent> {
    for await (const event of this.streamEvents(inputPath)) {
      if (this.matchesFilter(event, filter)) {
        yield event;
      }
    }
  }

  async countEvents(inputPath: string, filter: QueryFilter): Promise<number> {
    let count = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of this.queryEventsStream(inputPath, filter)) {
      count++;
    }

    return count;
  }
}
