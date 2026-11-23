// Turns text read from a bill, receipt or UPI payment screen into expense fields.
// Everything here is a suggestion: the user picks from the options and checks the form before saving.

export type ParsedExpense = {
  kind: 'receipt' | 'upi' | 'unknown';
  // A plain number string, e.g. "378.50"
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

// An amount found in the text, with the row it came from so the user can tell them apart
export type AmountOption = { value: string; row: string; isTotal: boolean };

// Everything a scan found, best guesses first, for the user to choose from
export type ScanAnalysis = {
  kind: ParsedExpense['kind'];
  amounts: AmountOption[];
  details: string[];
  date?: string;
  incoming?: boolean;
  // The text as read, row by row
  rows: string[];
};

// A row of text; height (text size in pixels) is known for scanned images
export type TextRow = { text: string; height?: number };

// ---------- amounts ----------

// 1,234.50 · 1234.5 · 1,23,456 · 99
const NUMBER = /\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g;
// ₹ is often read as a backtick
const CURRENCY = /(?:[₹$€£¥`]|\b(?:rs|inr|usd|eur|gbp|chf|aed|sgd|aud|cad|sar)\b\.?)/i;

const toAmount = (raw: string): number | null => {
  const value = Number(raw.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 && value < 1e9 ? value : null;
};

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

/** Fixes how OCR and foreign bills write numbers, so "2245. 50", "2'245.50" and "12,50" all read as money */
const normalizeNumbers = (line: string) =>
  line
    .replace(/(\d)\s*\.\s+(\d{2})(?![\d.,])/g, '$1.$2') // 2245. 50 → 2245.50
    .replace(/(\d)\s+\.(\d{2})(?![\d.,])/g, '$1.$2') // 2245 .50 → 2245.50
    .replace(/(\d)'(?=\d{3}\b)/g, '$1') // Swiss 2'245.50
    .replace(/(?<![\d,.])(\d{1,3}(?:\.\d{3})+),(\d{2})(?![\d,])/g, (_, whole: string, cents: string) => `${whole.replace(/\./g, '')}.${cents}`) // 1.234,50
    .replace(/(?<![\d,.])(\d+),(\d{2})(?![\d,])/g, '$1.$2'); // 12,50 (but not 1,23,456)

// Labels whose number is an id, not money: "Bill No 5874", "Rech. Nr. 5874", "Table 12"
const REFERENCE = /\b(?:no|nr|num|number|invoice|bill|rech(?:nung)?|receipt|table|tbl|token|kot|order|tel|ph|phone|mob(?:ile)?|gst(?:in)?|vat\s*(?:no|reg(?:istration)?)|cust(?:omer)?|card|a\/c|acc(?:ount|t)?|ref(?:erence)?|txn|transaction|id|pin|qty|quantity|covers?|pax|guests?|items?)\b\.?\s*[:#.]?\s*[\w/-]*\d[\w/-]*(?![\w/-]|[.,]\d)/gi;

// Numbers on a line that look like money: not phone numbers, ids, dates, times or percentages
const moneyOnLine = (line: string): number[] => {
  const cleaned = normalizeNumbers(line)
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ') // times
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, ' ') // dates
    .replace(/\b(?:19|20)\d{2}[/.-]\d{1,2}[/.-]\d{1,2}\b/g, ' ')
    .replace(/\b[0-9A-Z]{15}\b/g, ' ') // GSTIN
    .replace(/\d+(?:\.\d+)?\s*%/g, ' ') // tax rates
    .replace(REFERENCE, ' ');
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
    // 21/11/2026 · 21-11-26 · 21.11.2026 (day first)
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
const NOT_MERCHANT = /gst|gstin|cin\b|fssai|invoice|bill\s*no|receipt|tax|phone|ph[\s.:]|tel|mob|mobile|www\.|https?:|@|date|time|cashier|table|token|order|kot|road|rd\b|street|st\.|nagar|near|floor|opp\b|sector|pin\b|welcome|thank|original|duplicate|copy|total|amount/i;

// Likely shop names from the top of a bill: bigger text first, then top to bottom
const merchantOptions = (rows: TextRow[]) =>
  rows
    .slice(0, 8)
    .map((row, index) => ({ name: clean(row.text), index, height: row.height ?? 0 }))
    .filter(({ name }) => {
      if (name.length < 3 || name.length > 40 || NOT_MERCHANT.test(name)) return false;
      const letters = (name.match(/[A-Za-z]/g) ?? []).length;
      return letters >= 3 && letters / name.length >= 0.6;
    })
    .sort((a, b) => b.height - a.height || a.index - b.index)
    .map(({ name }) => titleCase(name));

// ---------- UPI payment screens (GPay, PhonePe, Paytm, BHIM, bank apps) ----------

const UPI_SIGNAL = /\bupi\b|paid to|sent to|received from|payment successful|transaction successful|money sent|transferred|upi transaction id|upi ref/i;

const parseUpi = (lines: string[], text: string): ParsedExpense => {
  const incoming = /received from|money received|credited/i.test(text);

  // The big amount: a ₹ amount, or a line that is only a number
  let amount: number | null = null;
  for (const line of lines) {
    const marked = normalizeNumbers(line).match(new RegExp(`${CURRENCY.source}\\s*(${NUMBER.source})`, 'i'));
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
  /grand\s*total|gesamt\w*|total\s*ttc/i,
  /net\s*(?:amount|payable|total|amt)/i,
  /(?:amount|amt|total)\s*(?:payable|due|to\s*pay|paid)/i,
  /bill\s*(?:amount|amt|total)/i,
  /invoice\s*(?:amount|total)/i,
  /total\s*(?:amount|amt|rs|inr|₹)/i,
  /\btotal\b|\bsumme\b|\bto\s*pay\b|\bbalance\s*due\b/i,
];
// Rows with "total" that aren't what was paid
const NOT_TOTAL = /sub\s*-?\s*total|total\s*(?:qty|quantity|items?|tax|gst|discount|savings?|saved)/i;
// Rows that are clearly not the bill amount
const NOT_PAID = /\b(?:tendered|change|cash\s*received|round\s*off|you\s*saved|savings|discount|mrp|tax|gst|vat|mwst|cgst|sgst|igst|service\s*charge|tip)\b/i;

type Scored = { value: number; row: string; isTotal: boolean; score: number };

/** Every money-looking number on the bill, scored by how likely it is to be the amount paid */
const receiptAmounts = (rows: string[]): Scored[] => {
  const found: Scored[] = [];
  let carriedLabel = -1; // a total label alone on its row: its value is often on the next row

  rows.forEach((row, index) => {
    const values = moneyOnLine(row);
    const labelRank = NOT_TOTAL.test(row) ? -1 : TOTAL_LABELS.findIndex((label) => label.test(row));
    if (!values.length) {
      carriedLabel = labelRank;
      return;
    }
    const rank = labelRank >= 0 ? labelRank : carriedLabel;
    carriedLabel = -1;

    const notPaid = rank < 0 && NOT_PAID.test(row);
    values.forEach((value, i) => {
      let score = 10;
      if (rank >= 0) score += 60 - rank * 3;
      if (/sub\s*-?\s*total/i.test(row)) score += 15;
      if (notPaid) score -= 25;
      if (CURRENCY.test(row)) score += 15;
      if (!Number.isInteger(value) || /\.\d{2}\b/.test(row)) score += 10;
      // Totals sit low on the bill, and the last number on a row is its value
      score += (index / Math.max(rows.length - 1, 1)) * 10;
      if (i === values.length - 1) score += 3;
      found.push({ value, row: row.trim(), isTotal: rank >= 0, score });
    });
  });

  if (!found.length) return [];
  // The largest clear amount is usually the total when nothing is labelled
  const largest = Math.max(...found.filter((f) => f.score > 20).map((f) => f.value), 0);
  for (const f of found) if (f.value === largest) f.score += 12;
  return found;
};

// One option per value, keeping its best row; a value that appears more than once is more likely
const rankAmounts = (found: Scored[]): AmountOption[] => {
  const byValue = new Map<number, Scored & { count: number }>();
  for (const f of found) {
    const seen = byValue.get(f.value);
    if (!seen) byValue.set(f.value, { ...f, count: 1 });
    else {
      seen.count += 1;
      if (f.score > seen.score) Object.assign(seen, { row: f.row, isTotal: f.isTotal, score: f.score });
    }
  }
  return [...byValue.values()]
    .map((f) => ({ ...f, score: f.score + Math.min(f.count - 1, 2) * 4 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ value, row, isTotal }) => ({ value: format(value), row, isTotal }));
};

const unique = (values: (string | undefined)[]) =>
  values.filter((v, i, all): v is string => !!v && all.findIndex((o) => o?.toLowerCase() === v.toLowerCase()) === i);

/** Everything a scan found, for the user to pick from */
export const analyzeText = (input: TextRow[]): ScanAnalysis => {
  const rows = input.map((r) => ({ ...r, text: r.text.trim() })).filter((r) => r.text);
  const lines = rows.map((r) => r.text);
  if (!lines.length) return { kind: 'unknown', amounts: [], details: [], rows: [] };
  const text = lines.join('\n');
  const amounts = rankAmounts(receiptAmounts(lines));

  if (UPI_SIGNAL.test(text)) {
    const upi = parseUpi(lines, text);
    const main = upi.amount ? [{ value: upi.amount, row: 'Amount paid', isTotal: true }] : [];
    return {
      kind: 'upi',
      amounts: [...main, ...amounts.filter((a) => a.value !== upi.amount)],
      details: unique([upi.details, ...merchantOptions(rows)]).slice(0, 4),
      date: upi.date,
      incoming: upi.incoming,
      rows: lines,
    };
  }

  return { kind: 'receipt', amounts, details: merchantOptions(rows).slice(0, 4), date: findDate(text), rows: lines };
};

/** The best guess from an analysis, as form fields */
export const bestGuess = (analysis: ScanAnalysis): ParsedExpense => {
  const top = analysis.amounts[0];
  return {
    kind: analysis.kind,
    amount: top?.value,
    amountConfidence: top ? (top.isTotal ? 'high' : 'low') : undefined,
    details: analysis.details[0],
    date: analysis.date,
    incoming: analysis.incoming,
  };
};

export const parseExpenseText = (text: string): ParsedExpense =>
  bestGuess(analyzeText(text.split(/\r?\n/).map((line) => ({ text: line }))));
