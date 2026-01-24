import type { WriteStream} from 'node:fs';
import { createWriteStream } from 'node:fs';
import dgram from 'node:dgram';
import type { MonitoringEvent, SessionConfig, UDPLoggingConfig } from '../schema/types.ts';
import { serializeEvent, validateEvent } from '../schema/events.ts';

export class EventLogger {
  private readonly writeStream: WriteStream | null = null;
  private readonly sessionConfig: SessionConfig;
  private eventCount = 0;
  private closed = false;

  // UDP support
  private readonly udpClient: dgram.Socket | null = null;
  private readonly udpConfig: UDPLoggingConfig | null = null;
  private readonly outputMode: 'file' | 'udp' | 'both';

  constructor(
    sessionConfig: SessionConfig,
    outputMode: 'file' | 'udp' | 'both' = 'file',
    udpConfig?: UDPLoggingConfig
  ) {
    this.sessionConfig = sessionConfig;
    this.outputMode = outputMode;
    this.udpConfig = udpConfig ?? null;

    // Initialize file output if needed
    if (outputMode === 'file' || outputMode === 'both') {
      // Use 'w' (write) mode to overwrite file each run, not 'a' (append) mode
      this.writeStream = createWriteStream(sessionConfig.outputPath, { flags: 'w' });

      this.writeStream.on('error', (error) => {
        console.error('[EventLogger] File write error:', error);
      });

      // Log session start to file
      this.writeStream.write(JSON.stringify({
        type: 'session_start',
        sessionId: sessionConfig.id,
        timestamp: sessionConfig.startTime,
        url: sessionConfig.url
      }) + '\n');
    }

    // Initialize UDP output if needed
    if (outputMode === 'udp' || outputMode === 'both') {
      if (udpConfig?.enabled) {
        this.udpClient = dgram.createSocket('udp4');

        this.udpClient.on('error', (err) => {
          console.error('[EventLogger] UDP error:', err);
        });

        console.log(`[EventLogger] UDP logging enabled: ${udpConfig.host}:${udpConfig.port}`);

        // Log session start via UDP
        const sessionStart = JSON.stringify({
          type: 'session_start',
          sessionId: sessionConfig.id,
          timestamp: sessionConfig.startTime,
          url: sessionConfig.url
        }) + '\n';

        const buffer = Buffer.from(sessionStart);
        this.udpClient.send(buffer, udpConfig.port, udpConfig.host, (err) => {
          if (err) {
            console.error('[EventLogger] Failed to send session_start via UDP:', err);
          }
        });
      }
    }
  }

  async logEvent(event: MonitoringEvent): Promise<void> {
    // Ignore events after logger is closed
    if (this.closed) {
      return Promise.resolve();
    }

    if (!validateEvent(event)) {
      console.warn('[EventLogger] Invalid event received:', event);
      return;
    }

    try {
      const serialized = serializeEvent(event);
      const eventLine = serialized + '\n';

      // Track promises for both file and UDP
      const promises: Promise<void>[] = [];

      // Write to file if configured
      if ((this.outputMode === 'file' || this.outputMode === 'both') && this.writeStream) {
        promises.push(new Promise((resolve, reject) => {
          this.writeStream!.write(eventLine, (error) => {
            if (error) {
              console.error('[EventLogger] Failed to write event to file:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        }));
      }

      // Send via UDP if configured
      if ((this.outputMode === 'udp' || this.outputMode === 'both') && this.udpClient && this.udpConfig) {
        promises.push(new Promise((resolve) => {
          const buffer = Buffer.from(eventLine);
          this.udpClient!.send(buffer, this.udpConfig!.port, this.udpConfig!.host, (err) => {
            if (err) {
              console.error('[EventLogger] Failed to send UDP packet:', err);
            }
            // Always resolve, UDP is fire-and-forget
            resolve();
          });
        }));
      }

      // Wait for all outputs to complete
      await Promise.all(promises);
      this.eventCount++;
    } catch (error) {
      console.error('[EventLogger] Failed to serialize event:', error);
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
    // If already closed, return early to prevent double-close
    if (this.closed) {
      return;
    }

    // Mark as closed to prevent new events from being logged
    this.closed = true;

    const sessionEnd = JSON.stringify({
      type: 'session_end',
      sessionId: this.sessionConfig.id,
      timestamp: Date.now(),
      totalEvents: this.eventCount
    }) + '\n';

    // Close file stream
    if (this.writeStream && !this.writeStream.destroyed && !this.writeStream.closed) {
      await new Promise<void>((resolve, reject) => {
        // Log session end to file
        this.writeStream!.write(sessionEnd);

        this.writeStream!.end((error?: Error | null) => {
          if (error) {
            console.error('[EventLogger] Error closing file stream:', error);
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    // Send session end via UDP and close UDP client
    if (this.udpClient && this.udpConfig) {
      await new Promise<void>((resolve) => {
        const buffer = Buffer.from(sessionEnd);
        this.udpClient!.send(buffer, this.udpConfig!.port, this.udpConfig!.host, (err) => {
          if (err) {
            console.error('[EventLogger] Failed to send session_end via UDP:', err);
          }

          // Close UDP socket
          this.udpClient!.close(() => {
            console.log('[EventLogger] UDP client closed');
            resolve();
          });
        });
      });
    }
  }
}
