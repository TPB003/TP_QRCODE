export interface VCardContact {
  firstName?: string; lastName?: string; organization?: string; title?: string;
  phone?: string; email?: string; website?: string; address?: string; note?: string;
}

function escapeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
}
function unescapeValue(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

export function toVCard(contact: VCardContact): string {
  const first = contact.firstName ?? "";
  const last = contact.lastName ?? "";
  const lines = [
    "BEGIN:VCARD", "VERSION:3.0", `N:${escapeValue(last)};${escapeValue(first)};;;`,
    `FN:${escapeValue([first, last].filter(Boolean).join(" ") || contact.organization || "Contact")}`,
  ];
  if (contact.organization) lines.push(`ORG:${escapeValue(contact.organization)}`);
  if (contact.title) lines.push(`TITLE:${escapeValue(contact.title)}`);
  if (contact.phone) lines.push(`TEL;TYPE=CELL:${escapeValue(contact.phone)}`);
  if (contact.email) lines.push(`EMAIL:${escapeValue(contact.email)}`);
  if (contact.website) lines.push(`URL:${escapeValue(contact.website)}`);
  if (contact.address) lines.push(`ADR;TYPE=HOME:;;${escapeValue(contact.address)};;;;`);
  if (contact.note) lines.push(`NOTE:${escapeValue(contact.note)}`);
  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}

export function parseVCard(input: string): VCardContact {
  const normalized = input.replace(/\r\n[ \t]/g, "").replace(/\r?\n/g, "\n");
  const fields = new Map<string, string>();
  for (const raw of normalized.split("\n")) {
    const index = raw.indexOf(":");
    if (index < 0) continue;
    const key = raw.slice(0, index).split(";")[0].toUpperCase();
    if (!fields.has(key)) fields.set(key, unescapeValue(raw.slice(index + 1)));
  }
  const n = (fields.get("N") ?? "").split(";");
  const fn = fields.get("FN") ?? "";
  const names = fn.trim().split(/\s+/);
  return {
    firstName: unescapeValue(n[1] || names.slice(0, -1).join(" ") || fn),
    lastName: unescapeValue(n[0] || names.slice(-1)[0] || ""),
    organization: fields.get("ORG") ?? "",
    title: fields.get("TITLE") ?? "",
    phone: fields.get("TEL") ?? "",
    email: fields.get("EMAIL") ?? "",
    website: fields.get("URL") ?? "",
    address: (fields.get("ADR") ?? "").split(";")[2] ?? "",
    note: fields.get("NOTE") ?? "",
  };
}
