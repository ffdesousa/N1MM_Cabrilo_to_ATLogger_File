import { buildAtl, parseHeadersAndQso } from "./converter.js";

const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const textInput = $("textInput");
const dropzone = $("dropzone");
const form = $("settingsForm");
const output = $("output");
const status = $("status");
const downloadBtn = $("downloadBtn");
const copyBtn = $("copyBtn");

const state = {
  sourceText: "",
  fileName: "log.atl",
  lastOutput: "",
};

function readSettings() {
  return {
    callPrefix: $("callPrefix").value,
    category: $("category").value,
    name: $("name").value,
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

function renderOutput(text) {
  output.textContent = text;
  state.lastOutput = text;
  downloadBtn.disabled = !text;
  copyBtn.disabled = !text;
}

function ensureNameFallback(settings) {
  if (!String(settings.name || "").trim()) {
    settings.name = String(new Date().getFullYear());
    $("name").value = settings.name;
  }
}

function convertSource() {
  if (!state.sourceText.trim()) {
    throw new Error("Selecione um arquivo Cabrillo ou cole o texto da entrada.");
  }

  const parsed = parseHeadersAndQso(state.sourceText);
  const settings = readSettings();
  ensureNameFallback(settings);

  const result = buildAtl(parsed, settings);
  const sourceName = fileBaseName(state.fileName || settings.callPrefix || parsed.headers.CALLSIGN || "log");
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
    renderOutput(result.text);
    setStatus(`Convertido com sucesso: ${result.rowCount} linhas QSO geradas.`);
  } catch (error) {
    renderOutput("Erro ao converter o arquivo.");
    setStatus(error.message || String(error), true);
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
    setStatus(`Arquivo carregado: ${file.name}`);
  } catch (error) {
    setStatus(error.message || String(error), true);
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
    setStatus(`Arquivo carregado: ${file.name}`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

form.addEventListener("submit", handleConvert);
downloadBtn.addEventListener("click", downloadResult);
copyBtn.addEventListener("click", () => copyResult().catch((error) => setStatus(error.message || String(error), true)));

$("category").value = "HQD";
$("name").value = String(new Date().getFullYear());
renderOutput("Carregue um Cabrillo para gerar o arquivo ATLogger.");
