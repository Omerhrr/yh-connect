export type DiffRow = {
  kind: "same" | "add" | "del";
  text: string;
  oldNo: number | null;
  newNo: number | null;
  /** Index of the change group this row belongs to (null for unchanged rows). */
  group: number | null;
};

export type DiffGroup = {
  id: number;
  rowIndex: number;
  added: number;
  removed: number;
  /** Line in the new document where the change sits. */
  newLine: number;
  preview: string;
};

/** Line-based LCS diff between two documents. */
export function diffLines(oldText: string, newText: string): { rows: DiffRow[]; groups: DiffGroup[] } {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length, m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const rows: DiffRow[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      rows.push({ kind: "same", text: a[i], oldNo: i + 1, newNo: j + 1, group: null });
      i++; j++;
    } else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      rows.push({ kind: "add", text: b[j], oldNo: null, newNo: j + 1, group: null });
      j++;
    } else {
      rows.push({ kind: "del", text: a[i], oldNo: i + 1, newNo: null, group: null });
      i++;
    }
  }

  const groups: DiffGroup[] = [];
  let current: DiffGroup | null = null;
  let lastNewNo = 1;
  rows.forEach((r, idx) => {
    if (r.newNo) lastNewNo = r.newNo;
    if (r.kind === "same") { current = null; return; }
    if (!current) {
      current = { id: groups.length, rowIndex: idx, added: 0, removed: 0, newLine: r.newNo ?? lastNewNo, preview: r.text.trim() };
      groups.push(current);
    }
    if (r.kind === "add") current.added++; else current.removed++;
    if (!current.preview && r.text.trim()) current.preview = r.text.trim();
    r.group = current.id;
  });
  return { rows, groups };
}
