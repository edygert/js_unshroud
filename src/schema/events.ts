import type { MonitoringEvent } from './types.ts';
import { createHash } from 'node:crypto';

export function generateEventId(sessionId: string, timestamp: number, type: string): string {
  const hash = createHash('md5');
  hash.update(`${sessionId}${timestamp}${type}${Math.random()}`);
  return hash.digest('hex').substring(0, 8);
}

export function createEvent<T extends MonitoringEvent>(
  sessionId: string,
  frameId: string | undefined,
  event: Omit<T, 'id' | 'timestamp' | 'sessionId' | 'frameId'>
): T {
  return {
    id: generateEventId(sessionId, Date.now(), event.type),
    timestamp: Date.now(),
    sessionId,
    frameId,
    ...event
  } as T;
}

export function validateEvent(event: unknown): event is MonitoringEvent {
  if (!event || typeof event !== 'object') return false;
  const obj = event as Record<string, unknown>;
  if (!obj.id || typeof obj.id !== 'string') return false;
  if (!obj.timestamp || typeof obj.timestamp !== 'number') return false;
  if (!obj.sessionId || typeof obj.sessionId !== 'string') return false;
  if (!obj.type || typeof obj.type !== 'string') return false;

  const validTypes = ['console', 'network', 'storage', 'websocket', 'timer', 'error', 'dom'];
  if (!validTypes.includes(obj.type)) return false;

  return true;
}

type SerializableValue = string | number | boolean | null | SerializableValue[] | { [key: string]: SerializableValue };

export function serializeEvent(event: MonitoringEvent): string {
  try {
    return JSON.stringify(event);
  } catch (error) {
    // Handle circular references and other serialization errors
    console.error('Failed to serialize event:', error);
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
    if (sanitizedEvent.args && Array.isArray(sanitizedEvent.args)) {
      sanitizedEvent.args = sanitizedEvent.args.map(sanitizeValue);
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
