const STORAGE_KEY = "distretti_xlsx_state_v1";

const DEFAULT_INPUTS = {
  J3: "sent mag 14 05:48:31 arrivo: 14,2026 20:40:10:257",
  J6: "oggi alle 20:50:43"
};

const rows = [
  { r: 2, cells: { I: { text: "Incollare qua:", cls: "mutedCell label" }, J: { text: "OFF BF/SMILE", cls: "redCell" } } },
  { r: 3, cells: { J: { input: "J3" } } },
  { r: 5, cells: { J: { text: "NOBILE MEGA", cls: "mutedCell label" } } },
  { r: 6, cells: { J: { input: "J6" } } },
  { r: 8, cells: {
    B: { text: "[b]Arrivo:  ", cls: "formulaCell" },
    C: { calc: "arrival1" }, D: { text: " - ", cls: "formulaCell" }, E: { calc: "arrival2" }, F: { text: "[/b] ", cls: "formulaCell" }, G: { output: 8 }
  } },
  { r: 9, travel: "07:21:11", label: "Arieti [unit]ram[/unit] ", output: 9 },
  { r: 10, travel: "05:23:32", label: "Spade [unit]sword[/unit] ", output: 10 },
  { r: 11, travel: "04:24:42", label: "Asce [unit]axe[/unit] ", output: 11 },
  { r: 12, travel: "02:41:46", label: "Oni [unit]heavy[/unit] ", output: 12 },
  { r: 13, travel: "02:27:04", label: "Ini [unit]light[/unit] ", output: 13 }
];

const columns = ["A","B","C","D","E","F","G","H","I","J"];

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULT_INPUTS, ...saved };
  }catch{
    return { ...DEFAULT_INPUTS };
  }
}

function saveState(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseTimeText(text){
  const s = String(text || "");
  if(s.trim().toLowerCase().startsWith("sent")){
    const comma = s.indexOf(",");
    if(comma >= 0){
      const afterComma = s.slice(comma + 1);
      const match = afterComma.match(/\b(\d{1,2}:\d{2}:\d{2})/);
      if(match) return match[1];
    }
  }
  const match = s.match(/\b(\d{1,2}:\d{2}:\d{2})\b/);
  return match ? match[1] : "";
}

function toSeconds(timeText){
  const match = String(timeText || "").match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if(!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function fromSeconds(seconds){
  if(seconds === null || Number.isNaN(seconds)) return "";
  const day = 24 * 3600;
  let s = ((Math.round(seconds) % day) + day) % day;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return [h,m,sec].map(x => String(x).padStart(2,"0")).join(":");
}

function minusTime(base, delta){
  const a = toSeconds(base);
  const b = toSeconds(delta);
  if(a === null || b === null) return "";
  return fromSeconds(a - b);
}

function compute(state){
  const arrival1 = parseTimeText(state.J3);
  const arrival2 = parseTimeText(state.J6);
  const result = { arrival1, arrival2, outputs: {} };
  result.outputs[8] = `[b]Arrivo:  ${arrival1} - ${arrival2}[/b] `;
  rows.filter(row => row.travel).forEach(row => {
    const c = minusTime(arrival1, row.travel);
    const e = minusTime(arrival2, row.travel);
    result.outputs[row.r] = `${row.label}${c} - ${e} `;
  });
  return result;
}

function cellClass(cell){
  const base = "cell";
  if(!cell) return base;
  if(cell.input) return `${base} inputCell`;
  if(cell.output) return `${base} outputCell`;
  if(cell.calc) return `${base} formulaCell`;
  return `${base} ${cell.cls || ""}`;
}

function buildRow(rowNum, state, calc){
  const rowSpec = rows.find(x => x.r === rowNum) || { r: rowNum, cells: {} };
  const cells = { ...(rowSpec.cells || {}) };
  if(rowSpec.travel){
    cells.A = { text: rowSpec.travel };
    cells.B = { text: rowSpec.label, cls: "formulaCell" };
    cells.C = { calc: "send1", travel: rowSpec.travel };
    cells.D = { text: " - ", cls: "formulaCell" };
    cells.E = { calc: "send2", travel: rowSpec.travel };
    cells.F = { text: " ", cls: "formulaCell" };
    cells.G = { output: rowSpec.r };
  }

  const html = columns.map(col => {
    const cell = cells[col];
    let content = "";
    if(cell?.input){
      content = `<input data-cell="${cell.input}" value="${escapeHtml(state[cell.input])}" />`;
    }else if(cell?.output){
      content = `<span class="outputVal">${escapeHtml(calc.outputs[cell.output])}</span>`;
    }else if(cell?.calc === "arrival1"){
      content = escapeHtml(calc.arrival1);
    }else if(cell?.calc === "arrival2"){
      content = escapeHtml(calc.arrival2);
    }else if(cell?.calc === "send1"){
      content = escapeHtml(minusTime(calc.arrival1, cell.travel));
    }else if(cell?.calc === "send2"){
      content = escapeHtml(minusTime(calc.arrival2, cell.travel));
    }else if(cell?.text){
      content = escapeHtml(cell.text);
    }
    return `<td class="${cellClass(cell)}" data-col="${col}">${content}</td>`;
  }).join("");

  return `<tr><th class="rowHead">${rowNum}</th>${html}</tr>`;
}

function render(){
  const state = loadState();
  const calc = compute(state);
  const body = document.getElementById("sheetBody");
  body.innerHTML = Array.from({ length: 13 }, (_, i) => buildRow(i + 1, state, calc)).join("");

  body.querySelectorAll("input[data-cell]").forEach(input => {
    input.addEventListener("input", event => {
      const next = loadState();
      next[event.target.dataset.cell] = event.target.value;
      saveState(next);
      renderOutputs(next);
      refreshCalculatedCells(next);
    });
  });

  renderOutputs(state);
}

function refreshCalculatedCells(state){
  const calc = compute(state);
  rows.forEach(row => {
    if(row.r === 8){
      setCell(row.r, "C", calc.arrival1);
      setCell(row.r, "E", calc.arrival2);
      setCell(row.r, "G", calc.outputs[8]);
    }
    if(row.travel){
      setCell(row.r, "C", minusTime(calc.arrival1, row.travel));
      setCell(row.r, "E", minusTime(calc.arrival2, row.travel));
      setCell(row.r, "G", calc.outputs[row.r]);
    }
  });
}

function setCell(r, col, value){
  const td = document.querySelector(`tr:nth-child(${r}) td[data-col="${col}"]`);
  if(td) td.textContent = value;
}

function renderOutputs(state){
  const calc = compute(state);
  document.getElementById("outText").value = [8,9,10,11,12,13].map(r => calc.outputs[r]).join("\n");
}

function copyOutputs(){
  const textarea = document.getElementById("outText");
  textarea.select();
  document.execCommand("copy");
}

function reset(){
  localStorage.removeItem(STORAGE_KEY);
  render();
}

document.getElementById("copyAll").addEventListener("click", copyOutputs);
document.getElementById("reset").addEventListener("click", reset);
render();
