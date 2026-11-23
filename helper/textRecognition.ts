import { TextScanner, type TextLine } from '@/modules/text-scanner';
import type { TextRow } from '@/helper/expenseParser';

// On-device text recognition (Google ML Kit through Google Play services).
// Images never leave the phone. Android only for now.
export const canRecognizeText = TextScanner !== null;

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/**
 * Puts recognised lines back into the rows printed on the bill. ML Kit groups
 * text by column, so "Total :" on the left and "CHF 2245.50" on the right come
 * back as separate lines; here lines at the same height are joined again.
 */
export const rowsFromLines = (lines: TextLine[]): TextRow[] => {
  const items = lines.filter((l) => l.text.trim() && l.bottom > l.top);
  if (!items.length) return [];

  // Undo the photo's tilt, judged from lines long enough to show it
  const slope = median(items.filter((l) => l.right - l.left > 3 * (l.bottom - l.top)).map((l) => l.angle));
  const radians = (slope * Math.PI) / 180;
  const placed = items
    .map((l) => {
      const x = (l.left + l.right) / 2;
      const y = (l.top + l.bottom) / 2;
      return {
        text: l.text.trim(),
        height: l.bottom - l.top,
        x: x * Math.cos(radians) + y * Math.sin(radians),
        y: y * Math.cos(radians) - x * Math.sin(radians),
      };
    })
    .sort((a, b) => a.y - b.y);

  type Row = { y: number; height: number; items: typeof placed };
  const rows: Row[] = [];
  for (const item of placed) {
    // Same row when the centres are within about half a line of each other
    const row = rows.find((r) => Math.abs(r.y - item.y) < 0.55 * Math.min(r.height, item.height));
    if (row) {
      row.items.push(item);
      row.y = row.items.reduce((sum, i) => sum + i.y, 0) / row.items.length;
      row.height = median(row.items.map((i) => i.height));
    } else {
      rows.push({ y: item.y, height: item.height, items: [item] });
    }
  }

  return rows
    .sort((a, b) => a.y - b.y)
    .map((r) => ({
      text: r.items.sort((a, b) => a.x - b.x).map((i) => i.text).join('  '),
      height: r.height,
    }));
};

/** Reads the text in an image (a file:// or content:// uri), row by row. */
export const recognizeRows = async (uri: string): Promise<TextRow[]> => {
  if (!TextScanner) throw new Error('Scanning works in the Android app');
  const { lines } = await TextScanner.recognize(uri);
  return rowsFromLines(lines);
};
