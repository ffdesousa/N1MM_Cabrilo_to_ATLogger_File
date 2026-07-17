export function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

export function parseQsoLine(line) {
  const tokens = line.replace(/^QSO:\s*/i, "").trim().split(/\s+/);

  if (tokens.length < 10) {
    throw new Error(`Linha QSO incompleta: ${line}`);
  }

  return {
    frequency: tokens[0] || "",
    mode: tokens[1] || "",
    date: tokens[2] || "",
    time: tokens[3] || "",
    ownCall: tokens[4] || "",
    sentRst: tokens[5] || "",
    sentExchange: tokens[6] || "",
    contactCall: tokens[7] || "",
    rcvdRst: tokens[8] || "",
    rcvdExchange: tokens[9] || "",
    comment: tokens.slice(10).join(" ").trim(),
    raw: line,
  };
}

export function parseHeadersAndQso(text) {
  const lines = normalizeLineEndings(text).split("\n");
  const headers = {};
  const qsos = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) {
      continue;
    }

    if (/^X-QSO:/i.test(line)) {
      continue;
    }

    if (/^END-OF-LOG/i.test(line)) {
      break;
    }

    if (/^QSO:/i.test(line)) {
      qsos.push(parseQsoLine(line));
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toUpperCase();
      const value = line.slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }

  return { headers, qsos };
}

function pad2(value) {
  return String(value || "").padStart(2, "0");
}

export function formatDate(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return String(isoDate || "");
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatTime(hhmm) {
  const digits = String(hhmm || "").replace(/\D/g, "");
  if (digits.length < 4) {
    return String(hhmm || "");
  }
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:00`;
}

export function mapMode(mode) {
  const normalized = String(mode || "").toUpperCase();
  if (normalized === "PH" || normalized === "PHONE" || normalized === "SSB") {
    return "SSB";
  }
  if (normalized === "CW") {
    return "CW";
  }
  return normalized || "";
}

export function csvEscape(value) {
  const text = String(value ?? "");
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function parseCallParts(call) {
  const text = String(call || "").trim().toUpperCase();
  const match = text.match(/^(?<dxcc>\d+)?(?<group>[A-Z]+)(?<unit>\d+)?(?:\/(?<suffix>[A-Z0-9]+))?$/);
  if (!match || !match.groups) {
    return {
      call: text,
      dxcc: "",
      group: "",
      unit: "",
    };
  }

  return {
    call: text,
    dxcc: match.groups.dxcc || "",
    group: match.groups.group || "",
    unit: match.groups.unit || match.groups.suffix || "",
  };
}

export function deriveHeaderProg(category) {
  const normalized = String(category || "").trim().toUpperCase();
  if (normalized === "SOP") {
    return "3";
  }
  if (normalized === "HQ" || normalized === "HQD") {
    return "2";
  }
  return "1";
}

export function formatCreation(date = new Date()) {
  const parts = [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ];
  const time = [
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join(":");
  return `${parts.join("-")} ${time}`;
}

export function inferNameFromLog(parsed, fallback = "") {
  const fromHeader = String(parsed.headers.NAME || "").trim();
  if (fromHeader) {
    return fromHeader;
  }

  const firstQso = parsed.qsos[0];
  if (firstQso && /^\d{4}-\d{2}-\d{2}$/.test(firstQso.date)) {
    return firstQso.date.slice(0, 4);
  }

  return fallback;
}

export function buildAtl(parsed, settings = {}) {
  if (!parsed.qsos.length) {
    throw new Error("Nenhuma linha QSO foi encontrada no Cabrillo.");
  }

  const call = String(settings.callPrefix || parsed.headers.CALLSIGN || "").trim().toUpperCase();
  const headerCallParts = parseCallParts(call);
  const activity = "WW11";
  const category = String(settings.category || "").trim();
  const creation = String(settings.creation || formatCreation()).trim();
  const name = String(settings.name || inferNameFromLog(parsed, new Date().getFullYear())).trim();
  const band = String(settings.band || "11").trim();
  const headerProg = String(settings.prog || String(parsed.qsos.length + 1)).trim();
  const defaultOpname = String(settings.opname || "").trim();
  const defaultRcvd = String(settings.rcvd || "1").trim();
  const defaultRstx = String(settings.rstx || "59").trim();
  const defaultRsrx = String(settings.rsrx || "59").trim();
  const headerDxcc = String(settings.dxcc || headerCallParts.dxcc).trim();

  const lines = [
    "# Software: ATLogger",
    "# Version: 1.0",
    `# Call: ${call}`,
    `# Activity: ${activity}`,
    `# Category: ${category}`,
    `# Creation: ${creation}`,
    `# Name: ${name}`,
    `# Prog: ${headerProg}`,
    "callsign,band,mode,rstx,rsrx,date,time,dxcc,group,unit,opname,prog,rcvd",
  ];

  parsed.qsos.forEach((qso, index) => {
    const seqProg = String(index + 1);
    const mode = String(qso.mode || "").toUpperCase();
    const rstx = qso.sentRst || (mode === "CW" ? "599" : defaultRstx);
    const rsrx = qso.rcvdRst || (mode === "CW" ? "599" : defaultRsrx);
    const opname = String(qso.comment || defaultOpname).trim();
    const contactCall = String(qso.contactCall || "").trim().toUpperCase();
    const contactCallParts = parseCallParts(contactCall);
    const row = [
      contactCall,
      band,
      mapMode(qso.mode),
      rstx,
      rsrx,
      formatDate(qso.date),
      formatTime(qso.time),
      contactCallParts.dxcc || headerDxcc,
      contactCallParts.group,
      contactCallParts.unit,
      opname,
      seqProg,
      qso.rcvdExchange || defaultRcvd,
    ].map(csvEscape);

    lines.push(row.join(","));
  });

  return {
    text: `${lines.join("\r\n")}\r\n`,
    rowCount: parsed.qsos.length,
    headers: parsed.headers,
    firstCall: call,
  };
}
