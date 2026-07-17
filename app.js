import {
  buildAtl,
  formatValidationIssues,
  parseHeadersAndQso,
  validateRequiredSettings,
} from "./converter.js";

const $ = (id) => document.getElementById(id);
const fileInput = $("fileInput");
const textInput = $("textInput");
const dropzone = $("dropzone");
const form = $("settingsForm");
const output = $("output");
const status = $("status");
const pageAlert = $("pageAlert");
const pageAlertText = $("pageAlertText");
const downloadBtn = $("downloadBtn");
const copyBtn = $("copyBtn");
const ALERT_TIMEOUT_MS = 6000;

const state = {
  sourceText: "",
  fileName: "log.atl",
  lastOutput: "",
};

let alertTimerId = null;

function readSettings() {
  return {
    callPrefix: $("callPrefix").value.trim(),
    category: $("category").value.trim(),
    name: $("name").value.trim(),
  };
}

function fileBaseName(name) {
  return String(name || "log")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "_");
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function showAlert(message) {
  if (alertTimerId) {
    window.clearTimeout(alertTimerId);
    alertTimerId = null;
  }
  pageAlertText.textContent = message;
  pageAlert.hidden = false;
  alertTimerId = window.setTimeout(() => {
    clearAlert();
  }, ALERT_TIMEOUT_MS);
}

function clearAlert() {
  if (alertTimerId) {
    window.clearTimeout(alertTimerId);
    alertTimerId = null;
  }
  pageAlertText.textContent = "";
  pageAlert.hidden = true;
}

function renderOutput(text, isError = false) {
  output.textContent = text;
  state.lastOutput = isError ? "" : text;
  downloadBtn.disabled = isError || !text;
  copyBtn.disabled = isError || !text;
}

function formatConversionError(error) {
  if (error && Array.isArray(error.issues) && error.issues.length) {
    const missingFormField = (issue) => {
      const field = String(issue?.field || "").trim().toUpperCase();
      const message = String(issue?.message || "").trim().toUpperCase();
      return !issue?.lineNumber && ["CALL", "CATEGORY", "NAME DO LOG"].includes(field) && /^(INFORME|SELECIONE)/.test(message);
    };
    return {
      summary:
        error.issues.every(missingFormField)
          ? "Preencha Call, Category e Name do log."
          : "Cabrillo inválido. Veja os detalhes no resultado.",
      details: formatValidationIssues(error.issues),
    };
  }

  const message = error.message || String(error);
  return {
    summary: message,
    details: `Conversão bloqueada. ${message}`,
  };
}

function convertSource() {
  const settings = readSettings();
  const normalizedSettings = validateRequiredSettings(settings);

  if (!state.sourceText.trim()) {
    throw new Error("Selecione um arquivo Cabrillo ou cole o texto da entrada.");
  }

  const parsed = parseHeadersAndQso(state.sourceText);
  const result = buildAtl(parsed, normalizedSettings);
  const sourceName = fileBaseName(state.fileName || normalizedSettings.callPrefix || "log");
  state.fileName = `${sourceName}.atl`;
  return result;
}

async function copyResult() {
  if (!state.lastOutput) {
    return;
  }
  await navigator.clipboard.writeText(state.lastOutput);
  setStatus("Resultado copiado para a area de transferencia.");
}

function downloadResult() {
  if (!state.lastOutput) {
    return;
  }

  const blob = new Blob([state.lastOutput], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = state.fileName || "log.atl";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function handleConvert(event) {
  event.preventDefault();
  try {
    const result = convertSource();
    clearAlert();
    renderOutput(result.text);
    setStatus(`Convertido com sucesso: ${result.rowCount} linhas QSO geradas.`);
  } catch (error) {
    const { summary, details } = formatConversionError(error);
    showAlert(summary);
    setStatus(summary, true);
    renderOutput(details, true);
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler o arquivo."));
    reader.readAsText(file);
  });
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    return;
  }
  try {
    state.fileName = `${fileBaseName(file.name)}.atl`;
    state.sourceText = await readFile(file);
    textInput.value = "";
    clearAlert();
    setStatus(`Arquivo carregado: ${file.name}.`);
  } catch (error) {
    const message = error.message || String(error);
    setStatus(message, true);
    renderOutput("Arquivo inválido. Corrija o Cabrillo e tente novamente.", true);
  }
});

textInput.addEventListener("input", () => {
  if (textInput.value.trim()) {
    state.sourceText = textInput.value;
    state.fileName = "log.atl";
    fileInput.value = "";
    setStatus("Texto Cabrillo carregado.");
  }
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dropzone--active");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dropzone--active");
});

dropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropzone.classList.remove("dropzone--active");
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if (!file) {
    return;
  }
  try {
    state.fileName = `${fileBaseName(file.name)}.atl`;
    state.sourceText = await readFile(file);
    fileInput.value = "";
    textInput.value = "";
    clearAlert();
    setStatus(`Arquivo carregado: ${file.name}.`);
  } catch (error) {
    const message = error.message || String(error);
    setStatus(message, true);
    renderOutput("Arquivo inválido. Corrija o Cabrillo e tente novamente.", true);
  }
});

form.addEventListener("submit", handleConvert);
downloadBtn.addEventListener("click", downloadResult);
copyBtn.addEventListener("click", () => copyResult().catch((error) => setStatus(error.message || String(error), true)));

clearAlert();
renderOutput("Carregue um Cabrillo para gerar o arquivo ATLogger.");
