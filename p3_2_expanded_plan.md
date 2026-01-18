# P3.2 EXPANDED: Behavioral Interaction Simulation

## Executive Summary

Based on 2025-2026 malware research, sophisticated JavaScript malware now gates execution behind complex user interaction patterns including:
- Form field interaction and submission
- Autofill triggers
- Checkout page detection
- Time-delayed behavior
- Anti-bot verification through realistic interaction patterns

This expanded plan addresses these advanced evasion techniques.

---

## Implementation Requirements

### Phase 1: Basic Interaction Simulation (Original Plan - 1 day)

**File**: `src/cli/runner.ts`

#### 1.1 Mouse Movement Simulation
```typescript
async function simulateMouseMovement(page: Page, viewport: { width: number, height: number }) {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  // Realistic bezier-like path with multiple steps
  await page.mouse.move(
    rand(0, viewport.width),
    rand(0, viewport.height),
    { steps: Math.floor(rand(10, 30)) }
  );
}
```

**Triggers**: Defeats basic mouse movement detection, defeats stationary cursor detection

#### 1.2 Scroll Simulation
```typescript
async function simulateScroll(page: Page) {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  // Random scroll distance (100-500px)
  await page.mouse.wheel(0, rand(100, 500));
  await new Promise(r => setTimeout(r, rand(500, 1500)));
}
```

**Triggers**: Defeats scroll event detection, triggers DOM mutation listeners

#### 1.3 Click Simulation
```typescript
async function simulateRandomClick(page: Page) {
  const elements = await page.$$('button, a, input[type="button"], input[type="submit"]');
  if (elements.length > 0) {
    const randomEl = elements[Math.floor(Math.random() * elements.length)];
    const box = await randomEl.boundingBox();
    if (box) {
      await page.mouse.click(
        box.x + rand(5, box.width - 5),
        box.y + rand(5, box.height - 5)
      );
    }
  }
}
```

**Triggers**: Defeats click event detection, triggers ClickFix-style attacks

#### 1.4 Keyboard Simulation
```typescript
async function simulateKeyboard(page: Page) {
  const keys = ['Tab', 'ArrowDown', 'ArrowUp', 'Enter'];
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  await page.keyboard.press(randomKey);
  await new Promise(r => setTimeout(r, rand(500, 1000)));
}
```

**Triggers**: Defeats keyboard event detection

---

### Phase 2: Form Interaction Simulation (NEW - 1 day)

**File**: `src/cli/runner.ts` (new functions)

#### 2.1 Form Field Detection and Typing
```typescript
async function simulateFormInteraction(page: Page) {
  // Detect all visible form fields
  const formFields = await page.$$('input:not([type="hidden"]), textarea, select');

  if (formFields.length === 0) return;

  // Interact with 30-50% of visible fields (realistic user behavior)
  const fieldsToFill = Math.floor(formFields.length * (Math.random() * 0.2 + 0.3));

  for (let i = 0; i < fieldsToFill; i++) {
    const field = formFields[Math.floor(Math.random() * formFields.length)];

    // Get field type
    const fieldInfo = await field.evaluate((el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => ({
      type: (el as HTMLInputElement).type || el.tagName.toLowerCase(),
      name: el.name || '',
      id: el.id || '',
      placeholder: (el as HTMLInputElement).placeholder || ''
    }));

    // Focus field (triggers focus listeners)
    await field.focus();
    await new Promise(r => setTimeout(r, rand(200, 500)));

    // Type realistic data based on field type
    const value = generateRealisticFieldValue(fieldInfo);

    // Type character by character (triggers keypress/input listeners)
    for (const char of value) {
      await page.keyboard.type(char);
      await new Promise(r => setTimeout(r, rand(50, 150))); // Realistic typing speed
    }

    // Occasional backspace (realistic typos)
    if (Math.random() < 0.1) {
      await page.keyboard.press('Backspace');
      await new Promise(r => setTimeout(r, rand(100, 300)));
    }

    // Blur field (triggers blur/change listeners)
    await page.keyboard.press('Tab');
    await new Promise(r => setTimeout(r, rand(300, 800)));
  }
}

function generateRealisticFieldValue(fieldInfo: any): string {
  const { type, name, id, placeholder } = fieldInfo;

  // Detect field purpose from name/id/placeholder
  const fieldLower = `${name} ${id} ${placeholder}`.toLowerCase();

  if (fieldLower.includes('email')) return 'test.user@example.com';
  if (fieldLower.includes('phone')) return '555-0123';
  if (fieldLower.includes('zip') || fieldLower.includes('postal')) return '12345';
  if (fieldLower.includes('card') || fieldLower.includes('credit')) return '4532123456789012';
  if (fieldLower.includes('cvv') || fieldLower.includes('cvc')) return '123';
  if (fieldLower.includes('name')) return 'John Doe';
  if (fieldLower.includes('address')) return '123 Main St';
  if (fieldLower.includes('city')) return 'New York';

  // Type-based defaults
  if (type === 'email') return 'test.user@example.com';
  if (type === 'tel') return '555-0123';
  if (type === 'number') return '42';
  if (type === 'date') return '2026-01-18';
  if (type === 'password') return 'TestPassword123!';
  if (type === 'search') return 'test query';

  // Generic text
  return 'test input';
}
```

**Triggers**:
- Focus/blur event listeners (web skimmers)
- Keypress/input event listeners (real-time data capture)
- Change event listeners (form validation)
- Field-specific malware (checkout forms, login forms)

#### 2.2 Form Submission Simulation
```typescript
async function simulateFormSubmission(page: Page) {
  // Find all forms on page
  const forms = await page.$$('form');

  if (forms.length === 0) return;

  // Submit 1-2 forms (realistic user behavior)
  const formsToSubmit = Math.min(Math.floor(Math.random() * 2) + 1, forms.length);

  for (let i = 0; i < formsToSubmit; i++) {
    const form = forms[Math.floor(Math.random() * forms.length)];

    // Check if form has submit button
    const submitButton = await form.$('input[type="submit"], button[type="submit"], button:not([type])');

    if (submitButton) {
      // Wait before submitting (realistic user review time)
      await new Promise(r => setTimeout(r, rand(1000, 3000)));

      // Click submit button (triggers submit event, click listeners)
      await submitButton.click();

      // Wait for potential navigation/XHR
      await new Promise(r => setTimeout(r, rand(500, 1500)));
    } else {
      // No submit button, try programmatic submit
      await form.evaluate((f: HTMLFormElement) => {
        f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
    }
  }
}
```

**Triggers**:
- Form submit event listeners (credential harvesters)
- Submit button click listeners (web skimmers)
- Form validation scripts
- Payment processing malware

#### 2.3 Autofill Trigger Simulation
```typescript
async function simulateAutofillTrigger(page: Page) {
  // Detect hidden form fields (autofill exploits)
  const hiddenFields = await page.$$('input[type="hidden"]');

  // Detect password fields (trigger password manager)
  const passwordFields = await page.$$('input[type="password"]');

  if (passwordFields.length > 0) {
    // Focus password field (triggers autofill)
    const pwField = passwordFields[0];
    await pwField.focus();
    await new Promise(r => setTimeout(r, rand(300, 800)));

    // Type password (simulates autofill behavior)
    await pwField.type('TestPassword123!', { delay: 50 });

    // Find associated username field
    const usernameField = await page.$('input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="email"]');
    if (usernameField) {
      await usernameField.focus();
      await usernameField.type('test.user@example.com', { delay: 50 });
    }
  }

  // Trigger change events on hidden fields (simulates autofill population)
  for (const hidden of hiddenFields) {
    await hidden.evaluate((el: HTMLInputElement) => {
      el.value = 'autofill-simulated-value';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
}
```

**Triggers**:
- Hidden field autofill exploits
- Password manager detection
- Credential harvesting scripts

---

### Phase 3: Advanced Evasion Techniques (NEW - 0.5 days)

#### 3.1 Checkout Page Detection
```typescript
async function detectAndSimulateCheckoutBehavior(page: Page) {
  const url = page.url();

  // Check if URL contains checkout keywords
  const isCheckoutPage = /checkout|payment|cart|onepage|billing/i.test(url);

  if (isCheckoutPage) {
    console.log('[JS Unshroud] Detected checkout page, simulating payment form interaction');

    // More aggressive form interaction on checkout pages
    await simulateFormInteraction(page); // Fill fields

    // Wait longer (users review purchase)
    await new Promise(r => setTimeout(r, rand(3000, 6000)));

    // Simulate card number field interaction
    const cardFields = await page.$$('input[name*="card"], input[placeholder*="card"], input[autocomplete="cc-number"]');
    for (const cardField of cardFields) {
      await cardField.focus();
      await cardField.type('4532123456789012', { delay: rand(80, 150) });
      await new Promise(r => setTimeout(r, rand(300, 600)));
    }

    // Simulate CVV field
    const cvvFields = await page.$$('input[name*="cvv"], input[name*="cvc"], input[autocomplete="cc-csc"]');
    for (const cvvField of cvvFields) {
      await cvvField.focus();
      await cvvField.type('123', { delay: rand(80, 150) });
      await new Promise(r => setTimeout(r, rand(300, 600)));
    }

    // Try to submit (triggers web skimmers)
    await simulateFormSubmission(page);
  }
}
```

**Triggers**:
- Magecart/web skimmers (activate only on checkout pages)
- Payment form listeners
- Card validation scripts

#### 3.2 Time-Delayed Interaction
```typescript
async function simulateTimeDelayedBehavior(page: Page, durationMs: number) {
  const startTime = Date.now();

  // Phase 1: Initial 30s - Minimal interaction (defeats 1-minute delay malware)
  console.log('[JS Unshroud] Phase 1: Minimal interaction (0-30s)');
  while (Date.now() - startTime < 30000 && Date.now() < startTime + durationMs) {
    await simulateMouseMovement(page, page.viewportSize() || { width: 1280, height: 720 });
    await new Promise(r => setTimeout(r, rand(2000, 4000)));
  }

  // Phase 2: 30s-60s - Moderate interaction (reading page)
  console.log('[JS Unshroud] Phase 2: Moderate interaction (30-60s)');
  while (Date.now() - startTime < 60000 && Date.now() < startTime + durationMs) {
    await simulateMouseMovement(page, page.viewportSize() || { width: 1280, height: 720 });
    if (Math.random() < 0.3) await simulateScroll(page);
    await new Promise(r => setTimeout(r, rand(1500, 3000)));
  }

  // Phase 3: 60s+ - Full interaction (form filling, clicking, submitting)
  console.log('[JS Unshroud] Phase 3: Full interaction (60s+)');
  let lastFormInteraction = Date.now();

  while (Date.now() < startTime + durationMs) {
    // Mouse movement
    await simulateMouseMovement(page, page.viewportSize() || { width: 1280, height: 720 });

    // Scroll
    if (Math.random() < 0.4) await simulateScroll(page);

    // Click
    if (Math.random() < 0.2) await simulateRandomClick(page);

    // Keyboard
    if (Math.random() < 0.15) await simulateKeyboard(page);

    // Form interaction every 10-20 seconds
    if (Date.now() - lastFormInteraction > rand(10000, 20000)) {
      await simulateFormInteraction(page);
      await simulateAutofillTrigger(page);
      lastFormInteraction = Date.now();
    }

    // Checkout detection
    await detectAndSimulateCheckoutBehavior(page);

    await new Promise(r => setTimeout(r, rand(1000, 2000)));
  }
}
```

**Triggers**:
- Time-bomb malware (waits 60s before activating)
- Analysis environment detection (expects continuous interaction)

#### 3.3 Honeypot Field Avoidance
```typescript
async function avoidHoneypotFields(page: Page) {
  // Identify likely honeypot fields (hidden, off-screen, zero-opacity)
  const honeypots = await page.$$eval('input, textarea', (elements) => {
    return elements
      .map((el, idx) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        const isHidden =
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity) < 0.1 ||
          rect.width < 1 ||
          rect.height < 1 ||
          rect.top < -100 || // Off-screen top
          rect.left < -100; // Off-screen left

        return { idx, isHidden };
      })
      .filter(item => item.isHidden)
      .map(item => item.idx);
  });

  console.log(`[JS Unshroud] Detected ${honeypots.length} potential honeypot fields, avoiding interaction`);

  // Store honeypot indices to skip during form interaction
  return honeypots;
}
```

**Triggers**:
- Anti-bot detection (honeypot fields detect automated tools)

---

## Configuration Changes

Add to `InstrumentationConfig` in `src/schema/types.ts`:

```typescript
export interface InstrumentationConfig {
  // ... existing fields ...

  // Behavioral simulation (P3.2)
  enableBehaviorSimulation?: boolean;  // Default: true when enableHeadlessMitigation is true
  behaviorSimulationIntensity?: 'low' | 'medium' | 'high';  // Default: 'medium'
  // low: minimal interaction (mouse only, no forms)
  // medium: realistic interaction (mouse, scroll, click, basic forms)
  // high: aggressive interaction (all features, multiple form submissions)

  enableFormInteraction?: boolean; // Default: true when enableBehaviorSimulation is true
  enableCheckoutSimulation?: boolean; // Default: true (detect and simulate checkout behavior)
  enableTimeDelayedBehavior?: boolean; // Default: true (phased interaction over time)
}
```

---

## Testing Strategy

### Test Fixtures

#### 1. `tests/fixtures/interaction-gate-test.html`
Tests basic interaction requirements (mouse, scroll, click).

#### 2. `tests/fixtures/form-submission-gate-test.html` (NEW)
```html
<!DOCTYPE html>
<html>
<head><title>Form Submission Gate Test</title></head>
<body>
  <form id="testForm">
    <input type="text" name="username" placeholder="Username" />
    <input type="email" name="email" placeholder="Email" />
    <input type="password" name="password" placeholder="Password" />
    <button type="submit">Submit</button>
  </form>
  <div id="result">Waiting for form submission...</div>
  <script>
    let formSubmitted = false;
    let fieldsTyped = 0;

    // Track field interaction
    document.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        if (input.value.length > 0) fieldsTyped++;
      });
    });

    // Track form submission
    document.getElementById('testForm').addEventListener('submit', (e) => {
      e.preventDefault();
      formSubmitted = true;
    });

    setTimeout(() => {
      const passed = formSubmitted && fieldsTyped >= 2;
      document.getElementById('result').textContent = passed
        ? 'FORM_INTERACTION_DETECTED'
        : `FAILED: submitted=${formSubmitted}, fieldsTyped=${fieldsTyped}`;

      if (passed) {
        console.log('MALICIOUS_CODE_EXECUTED');
      }
    }, 8000);
  </script>
</body>
</html>
```

#### 3. `tests/fixtures/checkout-skimmer-test.html` (NEW)
```html
<!DOCTYPE html>
<html>
<head><title>Checkout Skimmer Test</title></head>
<body>
  <form id="checkoutForm">
    <input type="text" name="cardnumber" placeholder="Card Number" autocomplete="cc-number" />
    <input type="text" name="cvv" placeholder="CVV" autocomplete="cc-csc" />
    <button type="submit">Pay Now</button>
  </form>
  <div id="result">Waiting for payment...</div>
  <script>
    let cardEntered = false;
    let cvvEntered = false;
    let submitted = false;

    // Simulate Magecart-style skimmer
    const isCheckoutPage = /checkout|payment|cart/.test(window.location.href);

    if (!isCheckoutPage) {
      console.log('NOT_CHECKOUT_PAGE');
    } else {
      document.querySelector('input[name="cardnumber"]').addEventListener('input', (e) => {
        if (e.target.value.length > 10) cardEntered = true;
      });

      document.querySelector('input[name="cvv"]').addEventListener('input', (e) => {
        if (e.target.value.length >= 3) cvvEntered = true;
      });

      document.getElementById('checkoutForm').addEventListener('submit', (e) => {
        e.preventDefault();
        submitted = true;
      });

      setTimeout(() => {
        const passed = cardEntered && cvvEntered && submitted;
        document.getElementById('result').textContent = passed
          ? 'CARD_DATA_CAPTURED'
          : `FAILED: card=${cardEntered}, cvv=${cvvEntered}, submitted=${submitted}`;

        if (passed) {
          console.log('SKIMMER_ACTIVATED');
        }
      }, 10000);
    }
  </script>
</body>
</html>
```

#### 4. `tests/fixtures/time-delay-test.html` (NEW)
```html
<!DOCTYPE html>
<html>
<head><title>Time Delay Test</title></head>
<body>
  <div id="result">Waiting 60 seconds...</div>
  <script>
    let interactions = 0;

    document.addEventListener('mousemove', () => interactions++);
    document.addEventListener('scroll', () => interactions++);
    document.addEventListener('click', () => interactions++);

    // Malware activates only after 60 seconds + 5 interactions
    setTimeout(() => {
      const passed = interactions >= 5;
      document.getElementById('result').textContent = passed
        ? 'TIME_DELAY_BYPASS_SUCCESS'
        : `FAILED: interactions=${interactions}`;

      if (passed) {
        console.log('TIME_DELAYED_MALWARE_EXECUTED');
      }
    }, 60000);
  </script>
</body>
</html>
```

---

## Expected Outcomes

### Before P3.2 Expanded
- **Basic interaction detection**: ❌ FAILED (no mouse/scroll/click)
- **Form interaction detection**: ❌ FAILED (no field typing)
- **Form submission detection**: ❌ FAILED (no submit events)
- **Checkout skimmer activation**: ❌ FAILED (no payment field interaction)
- **Time-delayed malware**: ❌ FAILED (insufficient interaction over time)
- **Autofill exploits**: ❌ FAILED (no password field interaction)

### After P3.2 Expanded
- **Basic interaction detection**: ✅ PASSED (mouse, scroll, click, keyboard)
- **Form interaction detection**: ✅ PASSED (field focus, typing, blur)
- **Form submission detection**: ✅ PASSED (submit events triggered)
- **Checkout skimmer activation**: ✅ PASSED (card fields populated and submitted)
- **Time-delayed malware**: ✅ PASSED (continuous interaction for 60+ seconds)
- **Autofill exploits**: ✅ PASSED (password fields and hidden fields populated)

### Headless Evasion Coverage
- **Before P3.1**: ~75%
- **After P3.1**: ~95%
- **After P3.2 Expanded**: ~98-100% (near-perfect evasion)

---

## Implementation Timeline

### Day 1: Basic Interaction (Original)
- ✅ Mouse movement simulation
- ✅ Scroll simulation
- ✅ Click simulation
- ✅ Keyboard simulation
- ✅ Basic integration tests

### Day 2: Form Interaction (NEW)
- ⏳ Form field detection and typing simulation
- ⏳ Realistic value generation based on field type
- ⏳ Form submission simulation
- ⏳ Autofill trigger simulation
- ⏳ Form interaction tests

### Day 3: Advanced Evasion (NEW)
- ⏳ Checkout page detection and simulation
- ⏳ Time-delayed behavior (phased interaction)
- ⏳ Honeypot field avoidance
- ⏳ Advanced evasion tests
- ⏳ Documentation updates

**Total Effort**: 3 days (expanded from 1-2 days)

---

## References

1. ClickFix attacks - Top attack vector 2025: https://www.knowbe4.com/hubfs/Phishing-Threat-Trends-2025_Report.pdf
2. JavaScript malware evasion techniques: https://arxiv.org/html/2405.13175v1
3. Form autofill credential harvesting: https://binarydefense.com/resources/blog/analysis-of-a-javascript-based-phishing-campaign-targeting-microsoft-365-credentials
4. Magecart web skimmers: https://www.malwarebytes.com/blog/news/2026/01/online-shoppers-at-risk-as-magecart-skimming-hits-major-payment-networks
5. User interaction detection patterns: https://arxiv.org/html/2505.21406v1

