export function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

const REQUIRED_CONTEST = "DXSerial";
const ALLOWED_CATEGORIES = new Set(["SOP", "HQ", "HQD"]);

function normalizeCallText(call) {
  return String(call || "").trim().toUpperCase();
}

export function parseQsoLine(line, lineNumber = 0) {
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
    lineNumber,
    raw: line,
  };
}

export function parseHeadersAndQso(text) {
  const lines = normalizeLineEndings(text).split("\n");
  const headers = {};
  const qsos = [];

  for (const [lineIndex, rawLine] of lines.entries()) {
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
      qsos.push(parseQsoLine(line, lineIndex + 1));
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

export function validateContestHeader(headers) {
  const contest = String(headers?.CONTEST || "").trim();
  if (contest.toUpperCase() !== REQUIRED_CONTEST.toUpperCase()) {
    throw new Error(
      `O Cabrillo precisa conter CONTEST: ${REQUIRED_CONTEST}. Valor encontrado: ${contest || "vazio"}.`,
    );
  }
  return contest;
}

function issueKey(issue) {
  const field = String(issue?.field || "").trim().toUpperCase();
  const value = normalizeCallText(issue?.value || "");
  const lineNumber = Number(issue?.lineNumber || 0);
  return `${field}:${value}:${lineNumber}`;
}

function displayIssueValue(value) {
  const text = String(value ?? "").trim();
  return text || "(vazio)";
}

function displayIssueField(field) {
  const text = String(field || "").trim();
  if (!text) {
    return "Cabrillo";
  }
  if (text.toUpperCase() === "CONTEST") {
    return "Contest";
  }
  return text;
}

function createValidationError(issues) {
  const error = new Error(summarizeValidationIssues(issues));
  error.name = "ValidationError";
  error.issues = issues;
  return error;
}

export function summarizeValidationIssues(issues = []) {
  const total = Array.isArray(issues) ? issues.length : 0;
  if (total === 0) {
    return "Nenhum problema encontrado no Cabrillo.";
  }
  if (total === 1) {
    return "Foi encontrado 1 problema no Cabrillo.";
  }
  return `Foram encontrados ${total} problemas no Cabrillo.`;
}

export function formatValidationIssues(issues = [], maxItems = 12) {
  const total = Array.isArray(issues) ? issues.length : 0;
  if (total === 0) {
    return "Nenhum problema encontrado no Cabrillo.";
  }

  const lines = [
    summarizeValidationIssues(issues),
    "",
  ];

  issues.slice(0, maxItems).forEach((issue) => {
    if (!issue) {
      return;
    }

    const field = displayIssueField(issue.field || issue.context);

    if (!issue.lineNumber && issue.message) {
      lines.push(`- ${field}: ${issue.message}`);
      return;
    }

    if (String(issue.field || "").trim().toUpperCase() === "CONTEST") {
      lines.push(`- ${field}: ${displayIssueValue(issue.value)}`);
      return;
    }

    const location = issue.lineNumber ? `linha ${issue.lineNumber}` : "";
    const prefix = location ? `${location} | ` : "";
    lines.push(`- ${prefix}${field}: ${displayIssueValue(issue.value)}`);
    if (issue.lineText) {
      lines.push(`  ${issue.lineText}`);
    }
  });

  if (total > maxItems) {
    lines.push(`- ... e mais ${total - maxItems}`);
  }

  return lines.join("\n");
}

export function isValid11mCallsign(call) {
  const normalized = normalizeCallText(call);
  if (!normalized) {
    return false;
  }

  const parts = parseCallParts(normalized);
  if (!parts.dxcc || !parts.group) {
    return false;
  }

  if (normalized.endsWith("/HQ")) {
    return true;
  }

  if (parts.unit) {
    return true;
  }

  return parts.group.length >= 4;
}

export function validate11mCallsign(call, context = "indicativo") {
  const normalized = normalizeCallText(call);
  if (!normalized) {
    throw new Error(
      `Indicativo ausente em ${context}. Use o padrão 11m, como 1AT23, 205DA4, 165/1AT35, 161/233EK115, 14DELTAFOX ou 14AT/HQ.`,
    );
  }

  if (!isValid11mCallsign(normalized)) {
    throw new Error(
      `Indicativo inválido em ${context}: ${normalized}. Use formatos 11m como 1AT23, 205DA4, 165/1AT35, 161/233EK115, 14DELTAFOX ou 14AT/HQ.`,
    );
  }

  return normalized;
}

export function validateRequiredSettings(settings = {}) {
  const issues = [];
  const callPrefix = String(settings.callPrefix || "").trim();
  const category = String(settings.category || "").trim().toUpperCase();
  const name = String(settings.name || "").trim();

  if (!callPrefix) {
    issues.push({
      field: "Call",
      value: "",
      message: "Informe o Call do formulário.",
    });
  } else {
    try {
      validate11mCallsign(callPrefix, "Call");
    } catch (error) {
      issues.push({
        field: "Call",
        value: callPrefix,
        message: error.message || String(error),
      });
    }
  }

  if (!category) {
    issues.push({
      field: "Category",
      value: "",
      message: "Selecione a categoria do log.",
    });
  } else if (!ALLOWED_CATEGORIES.has(category)) {
    issues.push({
      field: "Category",
      value: category,
      message: "Selecione uma categoria válida: SOP, HQ ou HQD.",
    });
  }

  if (!name) {
    issues.push({
      field: "Name do log",
      value: "",
      message: "Informe o nome do log.",
    });
  }

  if (issues.length) {
    throw createValidationError(issues);
  }

  return {
    callPrefix: callPrefix.toUpperCase(),
    category,
    name,
  };
}

export function validate11mLog(parsed, settings = {}) {
  const issues = [];
  const seen = new Set();

  const pushIssue = (issue) => {
    const key = issueKey(issue);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    issues.push(issue);
  };

  const contest = String(parsed?.headers?.CONTEST || "").trim();
  if (contest.toUpperCase() !== REQUIRED_CONTEST.toUpperCase()) {
    pushIssue({
      field: "CONTEST",
      value: contest,
      context: "header",
    });
  }

  const effectiveCall = normalizeCallText(settings.callPrefix || "");
  try {
    validate11mCallsign(effectiveCall, "CALLSIGN");
    } catch (error) {
      pushIssue({
        field: "Call",
        value: effectiveCall,
        context: "CALLSIGN",
        message: error.message || String(error),
      });
  }

  parsed.qsos.forEach((qso, index) => {
    const lineNumber = Number(qso?.lineNumber || index + 1);
    if (String(qso?.ownCall || "").trim()) {
      try {
        validate11mCallsign(qso.ownCall, `QSO ${lineNumber} / ownCall`);
      } catch (error) {
        pushIssue({
          field: "Indicativo da estação",
          value: qso.ownCall,
          lineNumber,
          context: "QSO ownCall",
          lineText: qso.raw,
          message: error.message || String(error),
        });
      }
    }

    try {
      validate11mCallsign(qso.contactCall, `QSO ${lineNumber} / contactCall`);
    } catch (error) {
      pushIssue({
        field: "Indicativo recebido",
        value: qso.contactCall,
        lineNumber,
        context: "QSO contactCall",
        lineText: qso.raw,
        message: error.message || String(error),
      });
    }
  });

  if (issues.length) {
    throw createValidationError(issues);
  }

  return effectiveCall.toUpperCase();
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
  const text = normalizeCallText(call);
  if (!text) {
    return {
      call: text,
      dxcc: "",
      group: "",
      unit: "",
    };
  }

  let working = text;
  let suffix = "";
  if (working.endsWith("/HQ")) {
    suffix = "HQ";
    working = working.slice(0, -3);
  }

  let dxcc = "";
  const slashIndex = working.indexOf("/");
  if (slashIndex > 0) {
    dxcc = working.slice(0, slashIndex);
    working = working.slice(slashIndex + 1);
  }

  const match = working.match(/^(?<prefix>\d{1,3})(?<group>[A-Z]{2,})(?<serial>\d{0,4})(?<tail>[A-Z]{0,4})$/);
  if (!match || !match.groups) {
    return {
      call: text,
      dxcc,
      group: "",
      unit: suffix,
    };
  }

  const group = match.groups.group || "";
  const serial = match.groups.serial || "";
  const tail = match.groups.tail || "";
  const hasUnit = Boolean(serial || tail);
  const isLongGroup = group.length >= 4;

  if (!suffix && !hasUnit && !isLongGroup) {
    return {
      call: text,
      dxcc,
      group: "",
      unit: "",
    };
  }

  return {
    call: text,
    dxcc: dxcc || match.groups.prefix || "",
    group,
    unit: suffix || `${serial}${tail}`,
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

function inferNextSentExchange(qsos) {
  const lastSentExchange = [...(qsos || [])]
    .reverse()
    .map((qso) => String(qso?.sentExchange || "").trim())
    .find((exchange) => /^\d+$/.test(exchange));

  if (lastSentExchange) {
    return String(Number(lastSentExchange) + 1);
  }

  return String((qsos || []).length + 1);
}

export function buildAtl(parsed, settings = {}) {
  if (!parsed.qsos.length) {
    throw new Error("Nenhuma linha QSO foi encontrada no Cabrillo.");
  }

  const normalizedSettings = validateRequiredSettings(settings);
  validate11mLog(parsed, normalizedSettings);

  const call = normalizedSettings.callPrefix;
  const headerCallParts = parseCallParts(call);
  const activity = "WW11";
  const category = normalizedSettings.category;
  const creation = String(settings.creation || formatCreation()).trim();
  const name = normalizedSettings.name;
  const band = String(settings.band || "11").trim();
  const headerProg = String(settings.prog || inferNextSentExchange(parsed.qsos)).trim();
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
    // Preserve the sent exchange from Cabrillo. In ATLogger this is the
    // station's sent progression, not the row index after conversion.
    const sentProg = String(qso.sentExchange || "").trim();
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
      sentProg,
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
