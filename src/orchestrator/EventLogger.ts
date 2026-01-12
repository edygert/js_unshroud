import { WriteStream, createWriteStream } from 'node:fs';
import type { MonitoringEvent, SessionConfig } from '../schema/types.ts';
import { serializeEvent, validateEvent } from '../schema/events.ts';

export class EventLogger {
  private writeStream: WriteStream;
  private sessionConfig: SessionConfig;
  private eventCount = 0;
  private closed = false;

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

  async logEvent(event: MonitoringEvent): Promise<void> {
    // Ignore events after logger is closed
    if (this.closed) {
      return Promise.resolve();
    }

    if (!validateEvent(event)) {
      console.warn('Invalid event received:', event);
      return;
    }

    try {
      const serialized = serializeEvent(event);
      return new Promise((resolve, reject) => {
        this.writeStream.write(serialized + '\n', (error) => {
          if (error) {
            console.error('Failed to log event:', error);
            reject(error);
          } else {
            this.eventCount++;
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Failed to serialize event:', error);
      return Promise.resolve();
    }
  }

  async logEvents(events: MonitoringEvent[]): Promise<void> {
    await Promise.all(events.map(event => this.logEvent(event)));
  }

  getEventCount(): number {
    return this.eventCount;
  }

  async close(): Promise<void> {
    // Mark as closed to prevent new events from being logged
    this.closed = true;

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
