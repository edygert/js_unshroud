import type { MonitoringEvent } from './types.ts';
import { randomUUID } from 'node:crypto';

// Type-safe event types derived from MonitoringEvent union
const EVENT_TYPES = [
  'console',
  'network',
  'storage',
  'websocket',
  'timer',
  'error',
  'dom',
  'fingerprinting',
  'headless_mitigation',
  'performance_warning',
  'service_worker',
  'code_execution',
  'encoding',
  'cryptojs',
  'script_injection',
  'event_handler',
  'blob',
  'url_execution',
  'worker',
  'module',
  'iframe',
  'clipboard',
  'debugger',
  'page_snapshot',
  'download'
] as const satisfies readonly MonitoringEvent['type'][];

function isValidEventType(type: string): type is MonitoringEvent['type'] {
  return EVENT_TYPES.includes(type as MonitoringEvent['type']);
}

// Event IDs are v4 UUIDs (122 bits of randomness) — wide enough to be collision-free at
// the documented 10k–100k+ events/session scale where they double as artifact filenames.
// The previous 32-bit MD5 prefix collided by the birthday bound well within that range.
export function generateEventId(): string {
  return randomUUID();
}

export function createEvent<T extends MonitoringEvent>(
  sessionId: string,
  frameId: string | undefined,
  event: Omit<T, 'id' | 'timestamp' | 'sessionId' | 'frameId'>
): T {
  return {
    id: generateEventId(),
    timestamp: Date.now(),
    sessionId,
    frameId,
    ...event
  } as T;
}

export function validateEvent(event: unknown): event is MonitoringEvent {
  if (!event || typeof event !== 'object') return false;
  const obj = event as Record<string, unknown>;
  if (typeof obj['id'] !== 'string') return false;
  if (typeof obj['timestamp'] !== 'number') return false;
  if (typeof obj['sessionId'] !== 'string') return false;
  if (typeof obj['type'] !== 'string') return false;

  if (!isValidEventType(obj['type'])) return false;

  return true;
}

type SerializableValue = string | number | boolean | null | SerializableValue[] | { [key: string]: SerializableValue };

export function serializeEvent(event: MonitoringEvent): string {
  try {
    return JSON.stringify(event);
  } catch {
    // Handle circular references and other serialization errors
    // Note: This is expected for events with circular references like DOM objects
    const sanitizedEvent = { ...event } as Record<string, unknown>;

    // Helper function to sanitize values
    const sanitizeValue = (value: unknown): SerializableValue => {
      try {
        JSON.stringify(value);
        return value as SerializableValue;
      } catch {
        return '<unserializable>';
      }
    };

    // Handle problematic properties that might exist on different event types
    if (sanitizedEvent['args'] && Array.isArray(sanitizedEvent['args'])) {
      sanitizedEvent['args'] = sanitizedEvent['args'].map(sanitizeValue);
    }

    // Also handle requestPayload and responsePayload if they exist
    ['requestPayload', 'responsePayload', 'data', 'details', 'error'].forEach(prop => {
      if (sanitizedEvent[prop] !== undefined) {
        sanitizedEvent[prop] = sanitizeValue(sanitizedEvent[prop]);
      }
    });

    try {
      return JSON.stringify({
        ...sanitizedEvent,
        serializationError: 'Event contained unserializable data'
      });
    } catch {
      // If even the sanitized version fails, return minimal representation
      return JSON.stringify({
        id: event.id,
        type: event.type,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        serializationError: 'Event could not be serialized'
      });
    }
  }
}
