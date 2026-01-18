#!/usr/bin/env node
// UDP Event Receiver for Testing
// Usage: node test-udp-receiver.js [port]

const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const DEFAULT_PORT = 9999;
const port = process.argv[2] ? parseInt(process.argv[2], 10) : DEFAULT_PORT;

let eventCount = 0;
let sessionId = null;

server.on('error', (err) => {
  console.error(`UDP server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  try {
    const eventLine = msg.toString().trim();
    const event = JSON.parse(eventLine);

    eventCount++;

    // Track session
    if (event.type === 'session_start') {
      sessionId = event.sessionId;
      console.log(`\n=== SESSION START ===`);
      console.log(`Session ID: ${sessionId}`);
      console.log(`URL: ${event.url}`);
      console.log(`From: ${rinfo.address}:${rinfo.port}`);
      console.log(`=====================\n`);
    } else if (event.type === 'session_end') {
      console.log(`\n=== SESSION END ===`);
      console.log(`Total Events: ${event.totalEvents}`);
      console.log(`Received: ${eventCount - 1}`); // -1 for session_start
      console.log(`===================\n`);
    } else {
      // Print compact event summary
      const timestamp = new Date(event.timestamp).toISOString().split('T')[1].slice(0, -1);
      let summary = `[${timestamp}] ${event.type}`;

      // Add type-specific details
      if (event.type === 'network') {
        summary += ` ${event.method} ${event.url}`;
        if (event.status) {
          summary += ` (${event.status})`;
        }
      } else if (event.type === 'console') {
        summary += ` [${event.level}] ${event.message}`;
      } else if (event.type === 'storage') {
        summary += ` ${event.storageType}.${event.operation}(${event.key || ''})`;
      } else if (event.type === 'timer') {
        summary += ` ${event.timerType} ${event.operation}`;
      } else if (event.type === 'dom') {
        summary += ` ${event.eventType}`;
      } else if (event.method || event.operation) {
        summary += ` ${event.method || event.operation}`;
      }

      console.log(summary);
    }
  } catch (err) {
    console.error('Failed to parse event:', err.message);
    console.error('Raw data:', msg.toString());
  }
});

server.on('listening', () => {
  const address = server.address();
  console.log(`UDP receiver listening on ${address.address}:${address.port}`);
  console.log(`Waiting for events...\n`);
});

server.bind(port, '0.0.0.0');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n\nShutting down...`);
  console.log(`Total events received: ${eventCount}`);
  server.close();
  process.exit(0);
});
