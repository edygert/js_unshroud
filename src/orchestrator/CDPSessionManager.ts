import type { CDPSession, Page } from 'playwright-core';
import type { NetworkEvent, ConsoleEvent, ErrorEvent } from '../schema/types.ts';
import type { Protocol } from 'devtools-protocol';
import type { EventLogger } from './EventLogger.ts';
import { createEvent } from '../schema/events.ts';

export class CDPSessionManager {
  private cdpSession: CDPSession | null = null;
  private readonly eventLogger: EventLogger;
  private readonly sessionId: string;
  private readonly frameIds: Map<string, string> = new Map();
  private pendingLogEvents: Promise<void>[] = [];
  private readonly networkCorrelationMap: Map<string, string> = new Map(); // requestId -> correlationId
  private readonly networkRequestMap: Map<string, { method: string; url: string }> = new Map(); // requestId -> request details

  constructor(_page: Page, eventLogger: EventLogger, sessionId: string) {
    this.eventLogger = eventLogger;
    this.sessionId = sessionId;
  }

  async initialize(page: Page): Promise<void> {
    // Create CDP session after page is ready
    this.cdpSession = await page.context().newCDPSession(page);

    // Enable required CDP domains
    await this.cdpSession.send('Network.enable', {});
    await this.cdpSession.send('Runtime.enable', {});
    await this.cdpSession.send('Console.enable', {});
    await this.cdpSession.send('Page.enable', {});

    // Set up event listeners
    this.setupNetworkListeners();
    this.setupConsoleListeners();
    this.setupRuntimeListeners();
    this.setupPageListeners();
  }

  private setupNetworkListeners(): void {
    if (!this.cdpSession) return;

    // Network.requestWillBeSent
    this.cdpSession.on('Network.requestWillBeSent', (params: Protocol.Network.RequestWillBeSentEvent) => {
      // Generate correlation ID for this request and store request details
      const correlationId = `req_${params.requestId}`;
      this.networkCorrelationMap.set(params.requestId, correlationId);
      this.networkRequestMap.set(params.requestId, {
        method: params.request.method,
        url: params.request.url
      });

      const promise = this.eventLogger.logEvent(createEvent<NetworkEvent>(
        this.sessionId,
        params.frameId,
        {
          ...(correlationId ? { correlationId } : {}),
          type: 'network',
          method: params.request.method,
          url: params.request.url,
          requestHeaders: params.request.headers as Record<string, string>,
          requestPayload: params.request.postData
        }
      ));
      this.queueLogEvent(promise);
    });

    // Network.responseReceived
    this.cdpSession.on('Network.responseReceived', (params: Protocol.Network.ResponseReceivedEvent) => {
      const correlationId = this.networkCorrelationMap.get(params.requestId);
      const requestInfo = this.networkRequestMap.get(params.requestId);

      const promise = this.eventLogger.logEvent(createEvent<NetworkEvent>(
        this.sessionId,
        params.frameId,
        {
          ...(correlationId ? { correlationId } : {}),
          type: 'network',
          method: requestInfo?.method ?? 'GET',
          url: params.response.url,
          status: params.response.status,
          statusText: params.response.statusText,
          responseHeaders: params.response.headers as Record<string, string>
        }
      ));
      this.queueLogEvent(promise);
    });

    // Network.loadingFinished - cleanup successful requests
    this.cdpSession.on('Network.loadingFinished', (params: Protocol.Network.LoadingFinishedEvent) => {
      // Clean up correlation maps for completed requests
      this.networkCorrelationMap.delete(params.requestId);
      this.networkRequestMap.delete(params.requestId);
    });

    // Network.loadingFailed
    this.cdpSession.on('Network.loadingFailed', (params: Protocol.Network.LoadingFailedEvent) => {
      const correlationId = this.networkCorrelationMap.get(params.requestId);
      const requestInfo = this.networkRequestMap.get(params.requestId);

       
      const promise = this.eventLogger.logEvent(createEvent<NetworkEvent>(
        this.sessionId,
        undefined,
        {
          ...(correlationId ? { correlationId } : {}),
          type: 'network',
          method: requestInfo?.method ?? 'GET',
          url: requestInfo?.url ?? params.requestId,
          error: params.errorText
        }
      ));
      this.queueLogEvent(promise);

      // Clean up correlation maps
      this.networkCorrelationMap.delete(params.requestId);
      this.networkRequestMap.delete(params.requestId);
    });
  }

  private setupConsoleListeners(): void {
    if (!this.cdpSession) return;

    // Console.messageAdded
    this.cdpSession.on('Console.messageAdded', (params: Protocol.Console.MessageAddedEvent) => {
      const promise = this.eventLogger.logEvent(createEvent<ConsoleEvent>(
        this.sessionId,
        undefined,
        {
          type: 'console',
          level: params.message.level as 'log' | 'warn' | 'error' | 'info' | 'debug',
          message: params.message.text,
          args: [] // CDP doesn't provide structured args in the same way
        }
      ));
      this.queueLogEvent(promise);
    });
  }

  private setupRuntimeListeners(): void {
    if (!this.cdpSession) return;

    // Runtime.exceptionThrown
    this.cdpSession.on('Runtime.exceptionThrown', (params: Protocol.Runtime.ExceptionThrownEvent) => {
      const promise = this.eventLogger.logEvent(createEvent<ErrorEvent>(
        this.sessionId,
        params.exceptionDetails.executionContextId?.toString(),
        {
          type: 'error',
          message: params.exceptionDetails.exception?.description ?? 'Runtime exception',
          ...(params.exceptionDetails.url && { filename: params.exceptionDetails.url }),
          lineno: params.exceptionDetails.lineNumber,
          colno: params.exceptionDetails.columnNumber,
          ...(params.exceptionDetails.stackTrace?.callFrames && {
            stack: params.exceptionDetails.stackTrace.callFrames.map(frame =>
              `${frame.functionName} at ${frame.url}:${frame.lineNumber}:${frame.columnNumber}`
            ).join('\n')
          })
        }
      ));
      this.queueLogEvent(promise);
    });
  }

  private setupPageListeners(): void {
    if (!this.cdpSession) return;

    // Page.frameAttached
    this.cdpSession.on('Page.frameAttached', (params: Protocol.Page.FrameAttachedEvent) => {
      this.frameIds.set(params.frameId, params.parentFrameId || 'main');
    });

    // Page.frameNavigated
    this.cdpSession.on('Page.frameNavigated', (params: Protocol.Page.FrameNavigatedEvent) => {
      this.frameIds.set(params.frame.id, params.frame.url || (params.frame.name ?? 'unknown'));
    });
  }

  private queueLogEvent(promise: Promise<void>): void {
    this.pendingLogEvents.push(promise);
    
    // Clean up completed promises periodically
    if (this.pendingLogEvents.length > 100) {
      this.pendingLogEvents = this.pendingLogEvents.slice(-50);
    }
  }

  async flushPendingEvents(): Promise<void> {
    if (this.pendingLogEvents.length > 0) {
      await Promise.allSettled(this.pendingLogEvents);
      this.pendingLogEvents = [];
    }
  }

  async disconnect(): Promise<void> {
    // Flush any pending event logs before disconnecting
    await this.flushPendingEvents();
    
    // CDP cleanup is now handled automatically by browser.close()
    // Manual disconnect operations are unreliable and often hang
    if (this.cdpSession) {
      this.cdpSession = null;
    }
  }
}
