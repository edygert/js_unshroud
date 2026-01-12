import { WriteStream, createWriteStream } from 'node:fs';
import type { MonitoringEvent, SessionConfig } from '../schema/types.ts';
import { serializeEvent, validateEvent } from '../schema/events.ts';

export class EventLogger {
  private writeStream: WriteStream;
  private sessionConfig: SessionConfig;
  private eventCount = 0;

  constructor(sessionConfig: SessionConfig) {
    this.sessionConfig = sessionConfig;
    this.writeStream = createWriteStream(sessionConfig.outputPath, { flags: 'a' });

    this.writeStream.on('error', (error) => {
      console.error('Error writing to log file:', error);
    });

    // Log session start
    this.writeStream.write(JSON.stringify({
      type: 'session_start',
      sessionId: sessionConfig.id,
      timestamp: sessionConfig.startTime,
      url: sessionConfig.url
    }) + '\n');
  }

  logEvent(event: MonitoringEvent): void {
    if (!validateEvent(event)) {
      console.warn('Invalid event received:', event);
      return;
    }

    try {
      const serialized = serializeEvent(event);
      this.writeStream.write(serialized + '\n');
      this.eventCount++;
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }

  logEvents(events: MonitoringEvent[]): void {
    for (const event of events) {
      this.logEvent(event);
    }
  }

  getEventCount(): number {
    return this.eventCount;
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Log session end
      this.writeStream.write(JSON.stringify({
        type: 'session_end',
        sessionId: this.sessionConfig.id,
        timestamp: Date.now(),
        totalEvents: this.eventCount
      }) + '\n');

      this.writeStream.end((error?: Error | null) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
