import type { MonitoringEvent } from '../schema/types.ts';

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
  private events: MonitoringEvent[];
  private groupedEvents: Map<number, MonitoringEvent[]> = new Map();

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
        return `console.${consoleEvent.level}(${consoleEvent.message?.slice(0, 50) ?? ''})`;
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

      default:
        return `${event.type} event`;
    }
  }

  private combineEventSummaries(eventsAtTime: MonitoringEvent[]): string {
    if (eventsAtTime.length === 1) {
      return this.generateEventSummary(eventsAtTime[0]!);
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

    const start = filteredEvents.length > 0 ? filteredEvents[0]!.timestamp : 0;
    const end = filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1]!.timestamp : 0;

    return {
      totalEvents: filteredEvents.length,
      eventTypes,
      timeSpan: { start, end }
    };
  }
}
