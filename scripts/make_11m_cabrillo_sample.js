import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const inputPath = path.join(repoRoot, "exemplos", "Cabrillo", "PX9D CQWPX SSB 2025.log.txt");
const outputPath = path.join(repoRoot, "exemplos", "Cabrillo", "3RDX106.txt");

const sampleCalls = [
  "205DA4",
  "1AT23",
  "3DA18",
  "1AT485",
  "31LR198",
  "14EK11",
  "1AT92",
  "26AT16",
  "233EK166",
  "233AT358",
  "1AT167",
  "13AT12",
  "93RC10",
  "1AT86",
  "31LR1",
  "67AT177",
  "47DX11",
  "26AT82",
  "109HA182",
  "3AT340",
  "14AT208",
  "108AT176",
  "1AT433",
  "30AT83",
  "1AT18",
  "14AT350",
  "14AT259",
  "14AT47",
  "1AT509",
  "14DA27",
  "109HA1220",
  "1WM9",
  "45AT105",
  "3AT21",
  "30AT198",
  "13SD114",
  "13AT285",
  "34AT/HQ",
  "14AT/HQ",
  "13OT/HQ",
  "165DA/HQ",
  "1DA/HQ",
  "165AT/HQ",
  "1GIR/HQ",
  "13AT/HQ",
  "31RC/HQ",
  "45SO/HQ",
  "14DA/HQ",
  "26AT/HQ",
  "30EK/HQ",
  "14OMEGA/HQ",
  "49SR/HQ",
  "30DA/HQ",
  "45AT/HQ",
  "1EK/HQ",
  "3AT/HQ",
  "31AT/HQ",
  "16AT/HQ",
  "30AT/HQ",
  "233EK/HQ",
  "1RIR/HQ",
  "13EK/HQ",
  "161AT/HQ",
  "91EK/HQ",
  "4AT/HQ",
  "15AT/HQ",
  "12AT/HQ",
  "91AT/HQ",
  "102EK/HQ",
  "3SKD/HQ",
  "29AT/HQ",
];

function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

function generateContactCall(index) {
  return sampleCalls[index % sampleCalls.length];
}

function transformQsoLine(line, index) {
  const tokens = line.replace(/^QSO:\s*/i, "").trim().split(/\s+/);
  if (tokens.length < 10) {
    return line;
  }

  tokens[4] = "3RDX106";
  tokens[7] = generateContactCall(index);
  return `QSO: ${tokens.join(" ")}`;
}

function main() {
  const input = normalizeLineEndings(fs.readFileSync(inputPath, "utf8"));
  const lines = input.split("\n");
  const output = [];
  let qsoIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^CALLSIGN:/i.test(line)) {
      output.push("CALLSIGN: 3RDX106");
      continue;
    }
    if (/^QSO:/i.test(line)) {
      output.push(transformQsoLine(line, qsoIndex));
      qsoIndex += 1;
      continue;
    }

    output.push(line);
  }

  fs.writeFileSync(outputPath, `${output.join("\r\n")}\r\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
  console.log(`Replaced ${qsoIndex} QSO contact calls.`);
}

main();
