/**
 * Download rows as a CSV file, for the boards' Export buttons.
 *
 * `columns` is [{ label, value(row) }]. Everything happens in the browser:
 * the rows are the ones already on screen, so nothing extra is read.
 */
export function downloadCsv(filename, columns, rows) {
  const cell = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    columns.map((column) => cell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => cell(column.value(row))).join(",")),
  ];
  const blob = new Blob([`${String.fromCharCode(0xfeff)}${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
