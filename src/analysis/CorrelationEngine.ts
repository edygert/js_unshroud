import type { MonitoringEvent } from '../schema/types.ts';
import { QueryEngine, type QueryFilter } from './QueryEngine.ts';

export interface CorrelationChain {
  events: MonitoringEvent[];
  chainType: string;
  correlationId?: string;
  description: string;
  timeSpan: {
    start: number;
    end: number;
    duration: number;
  };
}

export interface CorrelationRule {
  name: string;
  patterns: {
    type: 'sequence' | 'group';
    events: string[]; // Event types in order (for sequence) or any order (for group)
    maxTimeGap?: number; // Max time between events in ms
    correlationField?: string; // Field to correlate by (e.g., 'correlationId', 'url')
  };
  description: string;
}

export class CorrelationEngine {
  private queryEngine: QueryEngine;
  private correlationRules: CorrelationRule[];

  constructor(queryEngine: QueryEngine) {
    this.queryEngine = queryEngine;
    this.correlationRules = this.buildDefaultRules();
  }

  private buildDefaultRules(): CorrelationRule[] {
    return [
      {
        name: 'storage-to-network',
        patterns: {
          type: 'sequence',
          events: ['storage', 'network'],
          maxTimeGap: 5000, // 5 seconds
          correlationField: 'sessionId' // Correlate by session since storage might not have direct correlation to network
        },
        description: 'Local storage writes followed by network requests'
      },
      {
        name: 'network-request-response',
        patterns: {
          type: 'group',
          events: ['network', 'network'],
          maxTimeGap: 10000, // 10 seconds for network round trip
          correlationField: 'correlationId'
        },
        description: 'Network request-response pairs'
      },
      {
        name: 'error-chains',
        patterns: {
          type: 'sequence',
          events: ['network', 'error'],
          maxTimeGap: 2000, // 2 seconds
          correlationField: 'correlationId'
        },
        description: 'Network failures followed by error events'
      },
      {
        name: 'timer-to-network',
        patterns: {
          type: 'sequence',
          events: ['timer', 'network'],
          maxTimeGap: 1000, // 1 second
          correlationField: 'sessionId'
        },
        description: 'Timer executions followed by network activity'
      }
    ];
  }

  async findCorrelations(inputPath: string, ruleName?: string): Promise<CorrelationChain[]> {
    const chains: CorrelationChain[] = [];

    if (ruleName) {
      const rule = this.correlationRules.find(r => r.name === ruleName);
      if (!rule) {
        throw new Error(`Correlation rule '${ruleName}' not found`);
      }
      const ruleChains = await this.applyRule(inputPath, rule);
      chains.push(...ruleChains);
    } else {
      // Apply all rules
      for (const rule of this.correlationRules) {
        const ruleChains = await this.applyRule(inputPath, rule);
        chains.push(...ruleChains);
      }
    }

    // Sort by start time
    chains.sort((a, b) => a.timeSpan.start - b.timeSpan.start);

    return chains;
  }

  private async applyRule(inputPath: string, rule: CorrelationRule): Promise<CorrelationChain[]> {
    const chains: CorrelationChain[] = [];
    const eventGroups = new Map<string, MonitoringEvent[]>();

    // Stream events and group by correlation field
    for await (const event of this.queryEngine.queryEventsStream(inputPath, {
      type: rule.patterns.events.join(',')
    } as QueryFilter)) {
      if (!rule.patterns.events.includes(event.type)) continue;

      const correlationKey = this.getCorrelationKey(event, rule.patterns.correlationField);
      if (!correlationKey) continue;

      if (!eventGroups.has(correlationKey)) {
        eventGroups.set(correlationKey, []);
      }
      eventGroups.get(correlationKey)!.push(event);
    }

    // Process each group to find correlations
    for (const [correlationKey, events] of eventGroups) {
      if (rule.patterns.type === 'sequence') {
        const eventChains = this.findSequences(events, rule);
        for (const chain of eventChains) {
          chains.push({
            ...chain,
            correlationId: correlationKey,
            chainType: rule.name
          });
        }
      } else if (rule.patterns.type === 'group') {
        const groupedChains = this.findGroups(events, rule);
        for (const chain of groupedChains) {
          chains.push({
            ...chain,
            correlationId: correlationKey,
            chainType: rule.name
          });
        }
      }
    }

    return chains;
  }

  private findSequences(events: MonitoringEvent[], rule: CorrelationRule): Omit<CorrelationChain, 'chainType' | 'correlationId'>[] {
    const chains: Omit<CorrelationChain, 'chainType' | 'correlationId'>[] = [];
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    let currentChain: MonitoringEvent[] = [];
    let lastTimestamp = 0;

    for (const event of sortedEvents) {
      const expectedTypeIndex = currentChain.length;
      const expectedType = rule.patterns.events[expectedTypeIndex];

      if (event.type === expectedType) {
        if (currentChain.length === 0 ||
            (rule.patterns.maxTimeGap && event.timestamp - lastTimestamp <= rule.patterns.maxTimeGap)) {
          currentChain.push(event);
          lastTimestamp = event.timestamp;

          // Check if chain is complete
          if (currentChain.length === rule.patterns.events.length) {
            const startEvent = currentChain[0]!;
            const endEvent = currentChain[currentChain.length - 1]!;
            chains.push({
              events: [...currentChain],
              description: rule.description,
              timeSpan: {
                start: startEvent.timestamp,
                end: endEvent.timestamp,
                duration: endEvent.timestamp - startEvent.timestamp
              }
            });
            currentChain = [];
            lastTimestamp = 0;
          }
        } else {
          // Time gap too large, start new chain
          currentChain = [event];
          lastTimestamp = event.timestamp;
        }
      } else if (expectedTypeIndex === 0 && event.type === rule.patterns.events[0]) {
        // Start new chain
        currentChain = [event];
        lastTimestamp = event.timestamp;
      }
    }

    return chains;
  }

  private findGroups(events: MonitoringEvent[], rule: CorrelationRule): Omit<CorrelationChain, 'chainType' | 'correlationId'>[] {
    const chains: Omit<CorrelationChain, 'chainType' | 'correlationId'>[] = [];
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    let currentGroup: MonitoringEvent[] = [];
    let lastTimestamp = 0;

    for (const event of sortedEvents) {
      if (currentGroup.length === 0 || rule.patterns.events.includes(event.type)) {
        if (currentGroup.length === 0 ||
            (rule.patterns.maxTimeGap && event.timestamp - lastTimestamp <= rule.patterns.maxTimeGap)) {
          currentGroup.push(event);
          lastTimestamp = event.timestamp;
        } else {
          // Time gap too large or wrong type, process current group
          if (currentGroup.length >= 2) { // Need at least 2 events for a meaningful group
            const startEvent = currentGroup[0];
            const endEvent = currentGroup[currentGroup.length - 1];
            if (startEvent && endEvent) {
              chains.push({
                events: [...currentGroup],
                description: rule.description,
                timeSpan: {
                  start: startEvent.timestamp,
                  end: endEvent.timestamp,
                  duration: endEvent.timestamp - startEvent.timestamp
                }
              });
            }
          }
          currentGroup = rule.patterns.events.includes(event.type) ? [event] : [];
          lastTimestamp = event.timestamp;
        }
      }
    }

    // Process final group
    if (currentGroup.length >= 2) {
      const startEvent = currentGroup[0];
      const endEvent = currentGroup[currentGroup.length - 1];
      if (startEvent && endEvent) {
        chains.push({
          events: [...currentGroup],
          description: rule.description,
          timeSpan: {
            start: startEvent.timestamp,
            end: endEvent.timestamp,
            duration: endEvent.timestamp - startEvent.timestamp
          }
        });
      }
    }

    return chains;
  }

  private getCorrelationKey(event: MonitoringEvent, correlationField?: string): string {
    if (!correlationField) return event.sessionId;

    if (correlationField === 'sessionId') return event.sessionId;
    if (correlationField === 'correlationId') return event.correlationId ?? event.sessionId;
    if (correlationField === 'url' && event.type === 'network') {
      return event.url ?? event.sessionId;
    }

    return event.sessionId; // Fallback
  }
}
