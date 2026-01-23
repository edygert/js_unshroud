import type { MonitoringEvent, BaseEvent } from '../schema/types.ts';

export interface TimelineEntry {
  timestamp: number;
  events: MonitoringEvent[];
  summary: string;
  duration?: number; // For sequence chains
  correlationId?: string;
}

export interface TimeRange {
  start?: number;
  end?: number;
}

export class TimelineFormatter {
  private readonly events: MonitoringEvent[];
  private readonly groupedEvents: Map<number, MonitoringEvent[]> = new Map();

  constructor(events: MonitoringEvent[]) {
    this.events = events.sort((a, b) => a.timestamp - b.timestamp);
    this.groupEventsByTime();
  }

  private groupEventsByTime(): void {
    const timeTolerance = 50; // Group events within 50ms as simultaneous

    for (const event of this.events) {
      let bucketFound = false;
      for (const [bucketTime, bucketEvents] of this.groupedEvents) {
        if (Math.abs(event.timestamp - bucketTime) <= timeTolerance) {
          bucketEvents.push(event);
          bucketFound = true;
          break;
        }
      }

      if (!bucketFound) {
        this.groupedEvents.set(event.timestamp, [event]);
      }
    }
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString();
  }

  private generateEventSummary(event: MonitoringEvent): string {
    switch (event.type) {
      case 'network': {
        const netEvent = event;
        return `${netEvent.method} ${netEvent.url}${netEvent.status ? ` (${netEvent.status})` : ''}`;
      }

      case 'storage': {
        const storageEvent = event;
        return `${storageEvent.storageType}.${storageEvent.operation}(${storageEvent.key ?? ''})`;
      }

      case 'console': {
        const consoleEvent = event;
        return `console.${consoleEvent.level}(${consoleEvent.message ? consoleEvent.message.slice(0, 50) : ''})`;
      }

      case 'error': {
        const errorEvent = event;
        return `Error: ${errorEvent.message}`;
      }

      case 'dom': {
        const domEvent = event;
        return `DOM: ${domEvent.eventType}`;
      }

      case 'timer': {
        const timerEvent = event;
        return `Timer: ${timerEvent.timerType}.${timerEvent.operation}`;
      }

      case 'websocket': {
        const wsEvent = event;
        return `WebSocket: ${wsEvent.event} ${wsEvent.url}`;
      }

      case 'fingerprinting': {
        const fpEvent = event;
        return `Fingerprinting: ${fpEvent.method}.${fpEvent.operation}`;
      }

      case 'headless_mitigation': {
        const hmEvent = event;
        return `Headless Mitigation: ${hmEvent.method}.${hmEvent.operation}`;
      }

      case 'performance_stats': {
        const psEvent = event;
        return `Performance Stats: ${psEvent.operation} (uptime: ${psEvent.uptime}ms)`;
      }

      case 'performance_warning': {
        const pwEvent = event;
        return `Performance Warning: ${pwEvent.method} - ${pwEvent.warning}`;
      }

      case 'service_worker': {
        const swEvent = event;
        return `Service Worker: ${swEvent.eventType}${swEvent.scriptUrl ? ` ${swEvent.scriptUrl}` : ''}${swEvent.cacheName ? ` ${swEvent.cacheName}` : ''}`;
      }

      case 'code_execution': {
        const codeEvent = event;
        return `Code Execution: ${codeEvent.method}(${codeEvent.code.slice(0, 50)}...)`;
      }

      case 'encoding': {
        const encEvent = event;
        return `Encoding: ${encEvent.method}.${encEvent.operation} -> ${encEvent.output.slice(0, 30)}...`;
      }

      case 'cryptojs': {
        const cryptoEvent = event;
        return `CryptoJS: ${cryptoEvent.method}.${cryptoEvent.operation} (${cryptoEvent.algorithm ?? cryptoEvent.encoding ?? 'unknown'})${cryptoEvent.key ? ` key=${cryptoEvent.key}` : ''}`;
      }

      case 'script_injection': {
        const siEvent = event;
        const scriptInfo = siEvent.scriptSrc ?? siEvent.scriptContent ?? siEvent.htmlContent ?? '';
        return `Script Injection: ${siEvent.method} (${scriptInfo.slice(0, 50)}...)`;
      }

      case 'event_handler': {
        const ehEvent = event;
        return `Event Handler: ${ehEvent.handlerName} on ${ehEvent.element} (${ehEvent.handlerCode.slice(0, 50)}...)`;
      }

      case 'blob': {
        const blobEvent = event;
        if (blobEvent.eventType === 'blob_create') {
          return `Blob Create: ${blobEvent.blobType} (${blobEvent.blobSize} bytes)`;
        } else if (blobEvent.eventType === 'blob_url_create') {
          return `Blob URL Create: ${blobEvent.blobUrl} (${blobEvent.blobType})`;
        } else {
          return `Blob URL Revoke: ${blobEvent.blobUrl}`;
        }
      }

      case 'url_execution': {
        const urlEvent = event;
        return `JavaScript URL: ${urlEvent.eventType} (${urlEvent.code.slice(0, 50)}...)`;
      }

      case 'worker': {
        const workerEvent = event;
        if (workerEvent.eventType === 'worker_create') {
          return `Worker Create: ${workerEvent.workerType} (${workerEvent.scriptURL})`;
        } else if (workerEvent.eventType === 'worker_postmessage') {
          return `Worker PostMessage: ${workerEvent.direction} (${workerEvent.message?.slice(0, 30) ?? ''}...)`;
        } else if (workerEvent.eventType === 'worker_message') {
          return `Worker Message: ${workerEvent.direction} (${workerEvent.message?.slice(0, 30) ?? ''}...)`;
        } else {
          return `Worker Error: ${workerEvent.error}`;
        }
      }

      case 'module': {
        const moduleEvent = event;
        if (moduleEvent.isInline) {
          return `Module Script Inject: inline (${moduleEvent.content?.slice(0, 50) ?? ''}...)`;
        } else {
          return `Module Script Inject: ${moduleEvent.src}`;
        }
      }

      case 'iframe': {
        const iframeEvent = event;
        if (iframeEvent.eventType === 'iframe_create') {
          return `Iframe Create: ${iframeEvent.src ?? 'inline srcdoc'} (${iframeEvent.scriptCount ?? 0} scripts)`;
        } else if (iframeEvent.eventType === 'iframe_srcdoc_set') {
          return `Iframe Srcdoc Set: ${iframeEvent.element} (${iframeEvent.scriptCount ?? 0} scripts)`;
        } else {
          return `Iframe Eval: ${iframeEvent.code?.slice(0, 50) ?? ''}...`;
        }
      }

      case 'clipboard': {
        const clipEvent = event;
        const suspiciousFlag = clipEvent.containsPowerShell || clipEvent.containsMSHTA ? ' [SUSPICIOUS]' : '';
        return `Clipboard: ${clipEvent.method}.${clipEvent.operation} (${clipEvent.dataLength} bytes)${suspiciousFlag}`;
      }

      case 'debugger': {
        const debugEvent = event;
        return `Debugger Statement: ${debugEvent.scriptUrl ?? 'inline'} line ${debugEvent.lineNumber ?? '?'}`;
      }

      case 'download': {
        const downloadEvent = event;
        if (downloadEvent.eventType === 'download_click') {
          return `Download Click: ${downloadEvent.filename ?? 'unnamed'} (${downloadEvent.blobSize ?? 0} bytes)`;
        } else if (downloadEvent.eventType === 'window_open_download') {
          return `Window Open Download: ${downloadEvent.url.slice(0, 50)}... (${downloadEvent.blobSize ?? 0} bytes)`;
        } else if (downloadEvent.eventType === 'download_attribute_set') {
          return `Download Attribute Set: ${downloadEvent.filename}`;
        } else {
          return `Download Href Set: ${downloadEvent.href?.slice(0, 50) ?? ''}...`;
        }
      }

      default:
        return `${(event as BaseEvent).type} event`;
    }
  }

  private combineEventSummaries(eventsAtTime: MonitoringEvent[]): string {
    if (eventsAtTime.length === 1) {
      const firstEvent = eventsAtTime[0];
      if (!firstEvent) return ''; // Should never happen but handles the type check
      return this.generateEventSummary(firstEvent);
    }

    const summaries = eventsAtTime.map(e => this.generateEventSummary(e));
    const typeCounts = eventsAtTime.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const counts = Object.entries(typeCounts)
      .map(([type, count]) => `${count}x ${type}`)
      .join(', ');

    return `${counts}: ${summaries.slice(0, 2).join(', ')}${summaries.length > 2 ? ` +${summaries.length - 2} more` : ''}`;
  }

  formatTimeline(range?: TimeRange, maxEntries?: number): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    let filteredEvents = this.events;
    if (range?.start || range?.end) {
      filteredEvents = this.events.filter(e =>
        (!range.start || e.timestamp >= range.start) &&
        (!range.end || e.timestamp <= range.end)
      );
    }

    for (const [timestamp, eventsAtTime] of this.groupedEvents) {
      const matchesFilter = filteredEvents.some(e => e.timestamp === timestamp);
      if (matchesFilter && eventsAtTime.length > 0) {
        entries.push({
          timestamp,
          events: eventsAtTime,
          summary: this.combineEventSummaries(eventsAtTime)
        });
      }
    }

    // Apply max entries limit
    if (maxEntries && entries.length > maxEntries) {
      entries.splice(maxEntries);
    }

    return entries;
  }

  formatAsText(range?: TimeRange, maxEntries?: number): string {
    const entries = this.formatTimeline(range, maxEntries);

    if (entries.length === 0) {
      return 'No events found in the specified time range.';
    }

    const lines: string[] = [];
    lines.push(`Timeline (${entries.length} entries)`);
    lines.push('='.repeat(50));

    for (const entry of entries) {
      const timeStr = this.formatTimestamp(entry.timestamp);
      const eventCount = entry.events.length;
      const countSuffix = eventCount > 1 ? ` (${eventCount} events)` : '';

      lines.push(`${timeStr}${countSuffix}`);
      lines.push(`  ${entry.summary}`);

      if (entry.events.length > 1) {
        for (const event of entry.events) {
          lines.push(`    - ${this.generateEventSummary(event)}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  formatAsJSON(range?: TimeRange, maxEntries?: number): string {
    const entries = this.formatTimeline(range, maxEntries);
    return JSON.stringify({
      timeline: entries,
      totalEntries: entries.length,
      timeRange: range ? {
        start: range.start ? this.formatTimestamp(range.start) : undefined,
        end: range.end ? this.formatTimestamp(range.end) : undefined
      } : undefined
    }, null, 2);
  }

  getStats(range?: TimeRange): {
    totalEvents: number;
    eventTypes: Record<string, number>;
    timeSpan: { start: number; end: number };
  } {
    let filteredEvents = this.events;
    if (range?.start || range?.end) {
      filteredEvents = this.events.filter(e =>
        (!range.start || e.timestamp >= range.start) &&
        (!range.end || e.timestamp <= range.end)
      );
    }

    const eventTypes = filteredEvents.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const firstEvent = filteredEvents[0];
    const lastEvent = filteredEvents[filteredEvents.length - 1];
    const start = firstEvent ? firstEvent.timestamp : 0;
    const end = lastEvent ? lastEvent.timestamp : 0;

    return {
      totalEvents: filteredEvents.length,
      eventTypes,
      timeSpan: { start, end }
    };
  }
}
