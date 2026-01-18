// Simple test worker script
/* eslint-disable no-undef, strict */
self.addEventListener('message', function(e) {
  console.log('Worker received message:', e.data);

  // Echo the message back with modification
  const response = 'Worker processed: ' + JSON.stringify(e.data);
  self.postMessage(response);
});

// Send initial message
self.postMessage('Worker initialized');
