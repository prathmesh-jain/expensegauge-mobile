// Turns text read from a bill, receipt or UPI payment screen into expense fields.
// Everything here is a suggestion: the user always checks the form before saving.

export type ParsedExpense = {
  kind: 'receipt' | 'upi' | 'unknown';
  // Rupees as a plain number string, e.g. "378.50"
  amount?: string;
  // How sure we are about the amount: "low" means it was a best guess
  amountConfidence?: 'high' | 'low';
  // Merchant or person paid
  details?: string;
  // yyyy-mm-dd
  date?: string;
  // Money received rather than paid (e.g. "Received from" on a UPI screen)
  incoming?: boolean;
};

// ---------- amounts ----------

// 1,234.50 · 1234.5 · 1,23,456 · 99
const NUMBER = /\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g;
const CURRENCY = /(?:₹|rs\.?|inr|`)\s*/i;

const toAmount = (raw: string): number | null => {
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 && value < 1e9 ? value : null;
};

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

// Numbers on a line that look like money: not phone numbers, GSTINs, times or quantities like "2 x"
const moneyOnLine = (line: string): number[] => {
  const cleaned = line
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ') // times
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, ' ') // dates
    .replace(/\b[0-9A-Z]{15}\b/g, ' '); // GSTIN
  const values: number[] = [];
  for (const match of cleaned.matchAll(NUMBER)) {
    const digits = match[0].replace(/[,.]/g, '');
    if (digits.length >= 9 && !match[0].includes('.')) continue; // phone / account / reference numbers
    const value = toAmount(match[0]);
    if (value !== null) values.push(value);
  }
  return values;
};

// ---------- dates ----------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const iso = (y: number, m: number, d: number) => {
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(year, m - 1, d);
  if (date.getFullYear() !== year || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  // Bills are from the past (allow a day for time zones) and not ancient
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  if (date > tomorrow || date < twoYearsAgo) return null;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

export const findDate = (text: string): string | undefined => {
  const patterns: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    // 2026-11-21
    [/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, (m) => iso(+m[1], +m[2], +m[3])],
    // 21/11/2026 · 21-11-26 · 21.11.2026 (Indian day-first)
    [/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g, (m) => iso(+m[3], +m[2], +m[1])],
    // 21 Nov 2026 · 21-Nov-26 · 21st November, 2026
    [/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{2,4})\b/g, (m) => {
      const month = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
      return month ? iso(+m[3], month, +m[1]) : null;
    }],
    // Nov 21, 2026
    [/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/g, (m) => {
      const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
      return month ? iso(+m[3], month, +m[2]) : null;
    }],
  ];
  for (const [pattern, toIso] of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = toIso(match);
      if (value) return value;
    }
  }
  // UPI screens often show only "21 Nov, 10:32 pm": assume this year (or last, if that's in the future)
  const short = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\b(?!\s+\d)/);
  if (short) {
    const month = MONTHS[short[2].slice(0, 3).toLowerCase()];
    if (month) {
      const year = new Date().getFullYear();
      return iso(year, month, +short[1]) ?? iso(year - 1, month, +short[1]) ?? undefined;
    }
  }
  return undefined;
};

// ---------- names ----------

const titleCase = (s: string) =>
  s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;

// "swiggy.instamart@icici" → "Swiggy Instamart"
const nameFromVpa = (vpa: string) => titleCase(vpa.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim().toUpperCase());

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9).]+$/g, '').trim();

// Lines at the top of a bill that aren't the shop's name
const NOT_MERCHANT = /gst|gstin|cin\b|fssai|invoice|bill\s*no|receipt|tax|phone|ph[\s.:]|tel|mob|mobile|www\.|https?:|@|date|time|cashier|table|token|order|kot|road|rd\b|street|st\.|nagar|near|floor|opp\b|sector|pin\b|welcome|thank|original|duplicate|copy/i;

const findMerchant = (lines: string[]) => {
  for (const line of lines.slice(0, 6)) {
    const candidate = clean(line);
    if (candidate.length < 3 || candidate.length > 40) continue;
    if (NOT_MERCHANT.test(candidate)) continue;
    const letters = (candidate.match(/[A-Za-z]/g) ?? []).length;
    if (letters < 3 || letters / candidate.length < 0.6) continue;
    return titleCase(candidate);
  }
  return undefined;
};

// ---------- UPI payment screens (GPay, PhonePe, Paytm, BHIM, bank apps) ----------

const UPI_SIGNAL = /\bupi\b|paid to|sent to|received from|payment successful|transaction successful|money sent|transferred|upi transaction id|upi ref/i;

const parseUpi = (lines: string[], text: string): ParsedExpense => {
  const incoming = /received from|money received|credited/i.test(text);

  // The big amount: a ₹ amount, or a line that is only a number
  let amount: number | null = null;
  for (const line of lines) {
    const marked = line.match(new RegExp(`${CURRENCY.source}(${NUMBER.source})`, 'i'));
    if (marked) { amount = toAmount(marked[1]); if (amount) break; }
  }
  if (!amount) {
    const bare = lines.find((l) => /^\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?$/.test(l) || /^\d+(?:\.\d{1,2})?$/.test(l));
    if (bare) amount = toAmount(bare);
  }

  // Who: the text after (or on the line after) "Paid to" / "To" / "Received from"
  let details: string | undefined;
  const label = /^(?:paid to|sent to|to|received from|from)\b[:\s]*(.*)$/i;
  for (let i = 0; i < lines.length && !details; i++) {
    const match = lines[i].match(label);
    if (!match) continue;
    const rest = clean(match[1]) || clean(lines[i + 1] ?? '');
    if (!rest) continue;
    details = rest.includes('@') ? nameFromVpa(rest) : titleCase(rest);
  }
  if (!details) {
    const vpa = text.match(/\b[\w.-]{2,}@[a-z]{2,}\b/i);
    if (vpa) details = nameFromVpa(vpa[0]);
  }

  return {
    kind: 'upi',
    amount: amount ? format(amount) : undefined,
    amountConfidence: amount ? 'high' : undefined,
    details: details?.slice(0, 60),
    date: findDate(text),
    incoming,
  };
};

// ---------- bills and receipts ----------

// Strongest first: a "grand total" beats a plain "total"
const TOTAL_LABELS: RegExp[] = [
  /grand\s*total/i,
  /net\s*(?:amount|payable|total|amt)/i,
  /(?:amount|amt|total)\s*(?:payable|due|to\s*pay)/i,
  /bill\s*(?:amount|amt|total)/i,
  /invoice\s*(?:amount|total)/i,
  /total\s*(?:amount|amt|rs|inr|₹)/i,
  /\btotal\b/i,
];
// Lines with "total" that aren't what was paid
const NOT_TOTAL = /sub\s*-?\s*total|total\s*(?:qty|quantity|items?|tax|gst|discount|savings?|saved)|tendered|change|cash\s*received|round\s*off|you\s*saved|mrp/i;

const parseReceipt = (lines: string[], text: string): ParsedExpense => {
  let amount: number | null = null;
  let confidence: 'high' | 'low' | undefined;

  for (const label of TOTAL_LABELS) {
    // The last matching line: totals come after subtotals and taxes
    for (let i = lines.length - 1; i >= 0 && amount === null; i--) {
      if (!label.test(lines[i]) || NOT_TOTAL.test(lines[i])) continue;
      const onLine = moneyOnLine(lines[i]);
      // OCR often puts the label and its value on separate lines
      const value = onLine.length ? onLine[onLine.length - 1] : moneyOnLine(lines[i + 1] ?? '')[0];
      if (value) amount = value;
    }
    if (amount !== null) {
      confidence = 'high';
      break;
    }
  }

  // No total line: the largest money-looking number that isn't cash tendered or change
  if (amount === null) {
    const candidates = lines
      .filter((l) => !/tendered|change|cash\s*received|phone|mob|gstin/i.test(l))
      .flatMap((l) => {
        const values = moneyOnLine(l);
        // Prefer numbers with a currency sign or paise, which are clearly money
        return CURRENCY.test(l) || /\.\d{2}\b/.test(l) ? values : [];
      });
    if (candidates.length) {
      amount = Math.max(...candidates);
      confidence = 'low';
    }
  }

  return {
    kind: 'receipt',
    amount: amount !== null ? format(amount) : undefined,
    amountConfidence: confidence,
    details: findMerchant(lines),
    date: findDate(text),
  };
};

export const parseExpenseText = (text: string): ParsedExpense => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { kind: 'unknown' };
  return UPI_SIGNAL.test(text) ? parseUpi(lines, text) : parseReceipt(lines, text);
};
