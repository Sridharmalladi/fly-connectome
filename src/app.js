import { buildAnnotations, findPath, getGraphSummary, guessColumn, normalizeEdges, parseCSV } from "./analysis.js";

const state = {
  edgeRows: [],
  annotationRows: [],
  edgeColumns: {},
  annotationColumns: {},
  results: null,
  demoManifest: null,
  activeDemo: null,
  activePath: null,
  pathStep: 0,
  playTimer: null,
};

const $ = (id) => document.getElementById(id);
const edgeInput = $("edges-file");
const annotationInput = $("neurons-file");
const mappingControls = $("mapping-controls");
const errorBox = $("analysis-error");
const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function setError(message = "") {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function clearResults() {
  state.results = null;
  state.activePath = null;
  stopPathPlayback();
  $("empty-state").hidden = false;
  $("results-content").hidden = true;
  $("download-results").disabled = true;
  $("path-progress").disabled = true;
  $("play-route").disabled = true;
  updateStatus(false, "AWAITING DATA");
}

function updateStatus(ready, text) {
  const status = $("analysis-status");
  status.classList.toggle("ready", ready);
  if (!state.activeDemo) status.removeAttribute("title");
  status.innerHTML = `<i></i> ${text}`;
}

function inferAndRenderMappings() {
  mappingControls.replaceChildren();
  if (!state.edgeRows.length) {
    mappingControls.innerHTML = "<p>Load a connection table to map its columns.</p>";
    return;
  }
  renderMappingGroup("Connection table", Object.keys(state.edgeRows[0]), [
    ["source", "Sending neuron ID"],
    ["target", "Receiving neuron ID"],
    ["weight", "Synapse count"],
  ], state.edgeColumns);
  if (state.annotationRows.length) {
    renderMappingGroup("Neuron annotations", Object.keys(state.annotationRows[0]), [
      ["id", "Neuron ID"],
      ["type", "Cell-type label"],
      ["region", "Brain region (optional)"],
    ], state.annotationColumns);
  }
  refreshGroupSelectors();
}

function renderMappingGroup(title, headers, roles, mapping) {
  const heading = document.createElement("h4");
  heading.textContent = title;
  mappingControls.append(heading);
  for (const [role, label] of roles) {
    const row = document.createElement("label");
    row.className = "mapping-row";
    const caption = document.createElement("span");
    caption.textContent = label;
    const select = document.createElement("select");
    select.dataset.role = role;
    select.dataset.table = title.startsWith("Connection") ? "edges" : "annotations";
    select.append(new Option("— not used —", ""));
    for (const header of headers) select.append(new Option(header, header));
    select.value = mapping[role] ?? "";
    if (role === "type" || role === "region") select.disabled = !mapping.id;
    select.addEventListener("change", () => {
      mapping[role] = select.value;
      if (select.dataset.table === "annotations" && role === "id") inferAndRenderMappings();
      else if (role === "type") refreshGroupSelectors();
      runAnalysis();
    });
    row.append(caption, select);
    mappingControls.append(row);
  }
}

function refreshGroupSelectors() {
  const annotations = buildAnnotations(state.annotationRows, state.annotationColumns);
  const typeCounts = new Map();
  for (const annotation of annotations.values()) {
    if (annotation.type) typeCounts.set(annotation.type, (typeCounts.get(annotation.type) ?? 0) + 1);
  }
  const groups = [...typeCounts].sort((a, b) => b[1] - a[1]);
  for (const [id, hint] of [["source-group", /sensory|visual|olfactory|gustatory|auditory|mechanosensory/i], ["target-group", /motor|motoneuron/i]]) {
    const select = $(id);
    const prior = select.value;
    select.replaceChildren(new Option(groups.length ? "Choose a cell type…" : "Load annotations to choose a type", ""));
    for (const [type, count] of groups) {
      const option = new Option(`${type} · ${count}`, type);
      select.append(option);
    }
    select.disabled = !groups.length;
    if (groups.some(([type]) => type === prior)) select.value = prior;
    else {
      const suggested = groups.find(([type]) => hint.test(type));
      if (suggested) select.value = suggested[0];
    }
  }
}

function getSelectedNodeIds(annotations, selectedType) {
  if (!selectedType) return [];
  return [...annotations].filter(([, annotation]) => annotation.type === selectedType).map(([id]) => id);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function labelFor(id, annotations) {
  const annotation = annotations.get(id);
  return annotation?.type || id;
}

function traceLabelFor(id, annotations) {
  const type = labelFor(id, annotations);
  return type === id ? id : `${type} · ${id}`;
}

function calculatePaths(edges, annotations) {
  const graphNodes = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const from = getSelectedNodeIds(annotations, $("source-group").value).filter((id) => graphNodes.has(id));
  const to = getSelectedNodeIds(annotations, $("target-group").value).filter((id) => graphNodes.has(id));
  if (!from.length || !to.length) return { from, to, shortest: null, weighted: null };
  return {
    from, to,
    shortest: findPath(edges, from, to, "shortest"),
    weighted: findPath(edges, from, to, "weighted"),
  };
}

function renderMetrics(summary, annotations, paths) {
  const matchedFrom = paths.from.length;
  const matchedTo = paths.to.length;
  const metrics = [
    ["NEURONS IN GRAPH", formatNumber(summary.nodes), "unique edge endpoints"],
    ["DIRECTED CONNECTIONS", formatNumber(summary.edges), "after duplicate aggregation"],
    ["ANNOTATION COVERAGE", `${(summary.annotationCoverage * 100).toFixed(1)}%`, `${formatNumber(summary.annotated)} of ${formatNumber(summary.nodes)} neurons`],
    ["SELECTED GROUPS", `${formatNumber(matchedFrom)} → ${formatNumber(matchedTo)}`, "annotated neurons in graph"],
  ];
  $("metrics-grid").replaceChildren(...metrics.map(([label, value, sub]) => {
    const item = document.createElement("div");
    item.className = "metric";
    item.innerHTML = `<span class="metric-label">${label}</span><span class="metric-value"></span><span class="metric-sub"></span>`;
    item.querySelector(".metric-value").textContent = value;
    item.querySelector(".metric-sub").textContent = sub;
    return item;
  }));
}

function pathDisplay(path, annotations) {
  if (!path) return "No directed route found at this threshold.";
  if (!path.edges.length) return "Selected source and target types include the same neuron.";
  const ids = [path.edges[0].source, ...path.edges.map((edge) => edge.target)];
  return ids.map((id) => traceLabelFor(id, annotations)).join(" → ");
}

function renderRouteCards(paths, annotations) {
  const cards = [
    ["Fewest connections", paths.shortest, "shortest"],
    ["Strength-weighted route", paths.weighted, "weighted"],
  ];
  $("route-results").replaceChildren(...cards.map(([title, path, mode]) => {
    const card = document.createElement("article");
    card.className = "route-card";
    const length = path ? path.edges.length : 0;
    const total = path ? path.edges.reduce((sum, edge) => sum + edge.weight, 0) : 0;
    const meta = path ? `${length} ${length === 1 ? "connection" : "connections"} · ${formatNumber(total)} ${total === 1 ? "synapse" : "synapses"} along route` : "";
    card.innerHTML = `<p class="route-card-title"></p><p class="${path ? "route-card-path" : "route-empty"}"></p>${path ? '<p class="route-card-meta"></p>' : ""}`;
    card.querySelector(".route-card-title").textContent = title;
    card.querySelector(path ? ".route-card-path" : ".route-empty").textContent = pathDisplay(path, annotations);
    if (path) card.querySelector(".route-card-meta").textContent = meta;
    card.dataset.mode = mode;
    return card;
  }));
}

function renderGraph(path, annotations) {
  const svg = $("network-svg");
  svg.replaceChildren();
  if (!path?.edges.length) {
    svg.setAttribute("viewBox", "0 0 600 188");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "300");
    text.setAttribute("y", "95");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "network-node-label");
    text.textContent = "Select two cell types with a directed path to visualize the route";
    svg.append(text);
    return;
  }
  const ids = [path.edges[0].source, ...path.edges.map((edge) => edge.target)];
  const width = Math.max(600, ids.length * 112);
  svg.setAttribute("viewBox", `0 0 ${width} 188`);
  const ns = "http://www.w3.org/2000/svg";
  const xAt = (index) => 48 + index * (width - 96) / Math.max(ids.length - 1, 1);
  const maxWeight = path.edges.reduce((max, edge) => Math.max(max, edge.weight), 0);
  path.edges.forEach((edge, index) => {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(xAt(index) + 7));
    line.setAttribute("y1", "79");
    line.setAttribute("x2", String(xAt(index + 1) - 7));
    line.setAttribute("y2", "79");
    line.setAttribute("class", `network-edge${index < state.pathStep ? " traversed" : ""}${index === state.pathStep ? " current-edge" : ""}`);
    line.setAttribute("stroke-width", String(1 + 2 * Math.sqrt(edge.weight / maxWeight)));
    line.setAttribute("aria-label", `${formatNumber(edge.weight)} ${edge.weight === 1 ? "synapse" : "synapses"}`);
    line.setAttribute("marker-end", "url(#arrowhead)");
    svg.append(line);
  });
  const defs = document.createElementNS(ns, "defs");
  defs.innerHTML = '<marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#82cdb2" /></marker>';
  svg.prepend(defs);
  ids.forEach((id, index) => {
    const group = document.createElementNS(ns, "g");
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", String(xAt(index)));
    circle.setAttribute("cy", "79");
    circle.setAttribute("r", index === 0 || index === ids.length - 1 ? "7" : "5");
    const endpointClass = index === 0 ? " endpoint source-node" : index === ids.length - 1 ? " endpoint target-node" : "";
    circle.setAttribute("class", `network-node${endpointClass}`);
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", String(xAt(index)));
    text.setAttribute("y", "108");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "network-node-label");
    text.textContent = labelFor(id, annotations).slice(0, 18);
    const region = annotations.get(id)?.region;
    if (region) {
      const regionText = document.createElementNS(ns, "text");
      regionText.setAttribute("x", String(xAt(index)));
      regionText.setAttribute("y", "125");
      regionText.setAttribute("text-anchor", "middle");
      regionText.setAttribute("class", "network-node-label");
      regionText.setAttribute("opacity", ".68");
      regionText.textContent = region.slice(0, 18);
      group.append(circle, text, regionText);
    } else group.append(circle, text);
    if (index === state.pathStep) {
      const traveler = document.createElementNS(ns, "circle");
      traveler.setAttribute("cx", String(xAt(index)));
      traveler.setAttribute("cy", "79");
      traveler.setAttribute("r", "13");
      traveler.setAttribute("class", "path-traveler");
      group.append(traveler);
    }
    svg.append(group);
  });
}

function renderPathStep(path, annotations) {
  const slider = $("path-progress");
  const playButton = $("play-route");
  if (!path?.edges.length) {
    stopPathPlayback();
    state.pathStep = 0;
    slider.max = "0";
    slider.value = "0";
    slider.disabled = true;
    playButton.disabled = true;
    $("path-step-count").textContent = "Choose a route above";
    $("path-stage").textContent = "Each stop reveals a real cell type, neuron ID and dominant annotated ROI.";
    return;
  }
  state.pathStep = Math.min(state.pathStep, path.edges.length);
  slider.max = String(path.edges.length);
  slider.value = String(state.pathStep);
  slider.disabled = false;
  playButton.disabled = false;
  const nodeId = state.pathStep === 0 ? path.edges[0].source : path.edges[state.pathStep - 1].target;
  const annotation = annotations.get(nodeId);
  const role = state.pathStep === 0 ? "SENSORY INPUT" : state.pathStep === path.edges.length ? "MOTOR OUTPUT" : "INTERMEDIATE NEURON";
  const region = annotation?.region ? ` · ${annotation.region}` : "";
  $("path-step-count").textContent = `${state.pathStep} / ${path.edges.length} connections`;
  $("path-stage").textContent = `${role} · ${traceLabelFor(nodeId, annotations)}${region}`;
}

function stopPathPlayback() {
  if (state.playTimer !== null) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
  const button = $("play-route");
  if (button) {
    button.textContent = "▶";
    button.setAttribute("aria-label", "Play path animation");
    button.setAttribute("aria-pressed", "false");
  }
}

function togglePathPlayback() {
  if (!state.activePath?.edges.length) return;
  if (state.playTimer !== null) {
    stopPathPlayback();
    return;
  }
  const button = $("play-route");
  button.textContent = "Ⅱ";
  button.setAttribute("aria-label", "Pause path animation");
  button.setAttribute("aria-pressed", "true");
  state.playTimer = setInterval(() => {
    if (state.pathStep >= state.activePath.edges.length) {
      state.pathStep = 0;
    } else {
      state.pathStep += 1;
    }
    renderPathStep(state.activePath, state.results.annotations);
    renderGraph(state.activePath, state.results.annotations);
    if (state.pathStep === state.activePath.edges.length) stopPathPlayback();
  }, 850);
}

function renderRouteTable(path, annotations) {
  const body = $("route-table-body");
  body.replaceChildren();
  if (!path?.edges.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.textContent = "Select cell types with a directed route to inspect its supporting connections.";
    return;
  }
  path.edges.forEach((edge, index) => {
    const row = body.insertRow();
    const values = [
      String(index + 1),
      traceLabelFor(edge.source, annotations),
      traceLabelFor(edge.target, annotations),
      formatNumber(edge.weight),
      annotations.get(edge.target)?.region || "—",
    ];
    for (const value of values) {
      const cell = row.insertCell();
      cell.textContent = value;
      if (value.length > 25) cell.title = value;
    }
  });
}

function runAnalysis() {
  if (!state.edgeRows.length) return;
  setError();
  try {
    const threshold = Math.max(1, Number($("threshold").value) || 1);
    const normalized = normalizeEdges(state.edgeRows, state.edgeColumns, threshold);
    const annotations = buildAnnotations(state.annotationRows, state.annotationColumns);
    const summary = getGraphSummary(normalized.edges, annotations);
    const paths = calculatePaths(normalized.edges, annotations);
    state.results = { normalized, annotations, summary, paths };
    renderMetrics(summary, annotations, paths);
    $("data-quality-note").textContent =
      `${formatNumber(normalized.duplicateRows)} repeated rows summed · ${formatNumber(normalized.invalidRows)} invalid rows excluded · ` +
      `${formatNumber(normalized.selfConnections)} self-connections excluded · ${formatNumber(normalized.belowThreshold)} aggregated connections below threshold`;
    renderRouteCards(paths, annotations);
    const path = paths.shortest ?? paths.weighted;
    stopPathPlayback();
    state.pathStep = 0;
    state.activePath = path;
    renderGraph(path, annotations);
    renderPathStep(path, annotations);
    renderRouteTable(path, annotations);
    $("empty-state").hidden = true;
    $("results-content").hidden = false;
    $("download-results").disabled = !path?.edges.length;
    updateStatus(true, state.activeDemo ? "REAL MALE CNS v1.0 SLICE" : `${formatNumber(summary.edges)} CONNECTIONS`);
    if (state.activeDemo) {
      const retainedRows = normalized.edges.length;
      $("data-quality-note").textContent =
        `Source-verified ${state.activeDemo.modality.toLowerCase()} slice · ${retainedRows} of ${state.activeDemo.weights.length} source-path edges meet this threshold · ` +
        `this teaching slice is not a full network neighborhood`;
    }
    if (!normalized.edges.length) {
      setError("No source connections meet this synapse threshold. Lower the threshold to bring real edges back into the graph.");
      updateStatus(false, "NO EDGES AT THIS THRESHOLD");
    } else if (!paths.from.length || !paths.to.length) {
      setError("Load neuron annotations and select source and target cell types to trace candidate routes. Descriptive graph statistics are available without annotations.");
    } else if (!paths.shortest && !paths.weighted) {
      setError("No directed route connects the selected groups at this threshold. Try lowering the threshold or choosing a different group.");
    }
  } catch (error) {
    state.results = null;
    state.activePath = null;
    state.pathStep = 0;
    stopPathPlayback();
    $("results-content").hidden = true;
    $("empty-state").hidden = false;
    $("download-results").disabled = true;
    renderPathStep(null, new Map());
    setError(error.message);
    updateStatus(false, "CHECK COLUMN MAPPING");
  }
}

async function readCSV(file) {
  return parseCSV(await file.text());
}

function clearDemoSelection() {
  state.activeDemo = null;
  $("active-dataset").hidden = true;
  $("active-query").hidden = true;
  $("analysis-status").removeAttribute("title");
  document.querySelectorAll(".sample-card").forEach((card) => card.classList.remove("selected"));
  document.querySelectorAll("[data-load-slice]").forEach((button) => button.setAttribute("aria-pressed", "false"));
}

function renderDemoCards(manifest) {
  for (const slice of manifest.slices) {
    const card = document.querySelector(`[data-sample-card="${CSS.escape(slice.id)}"]`);
    if (!card) continue;
    card.querySelector("[data-demo-hops]").textContent = `${slice.hops} connections`;
    card.querySelector("[data-demo-synapses]").textContent = `${formatNumber(slice.totalSynapses)} synapses`;
  }
}

function csvDownload(filename, rows) {
  const text = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadDemoSlice(sliceId, scrollToResults = false) {
  const buttons = [...document.querySelectorAll("[data-load-slice]")];
  buttons.forEach((button) => { button.disabled = true; });
  updateStatus(false, "LOADING REAL DATA SLICE");
  setError();
  try {
    if (!state.demoManifest) {
      const response = await fetch("./data/demo-slices.json");
      if (!response.ok) throw new Error(`The bundled source-data file returned HTTP ${response.status}.`);
      state.demoManifest = await response.json();
      renderDemoCards(state.demoManifest);
    }
    const slice = state.demoManifest.slices.find((entry) => entry.id === sliceId);
    if (!slice) throw new Error("That real-data slice was not found in the source manifest.");
    stopPathPlayback();
    edgeInput.value = "";
    annotationInput.value = "";
    state.activeDemo = slice;
    state.edgeRows = slice.weights.map((weight, index) => ({
      bodyId_pre: String(slice.nodes[index].id),
      bodyId_post: String(slice.nodes[index + 1].id),
      weight: String(weight),
    }));
    state.annotationRows = slice.nodes.map((node) => ({
      bodyId: String(node.id),
      type: node.type,
      region: node.brainRegion,
    }));
    state.edgeColumns = { source: "bodyId_pre", target: "bodyId_post", weight: "weight" };
    state.annotationColumns = { id: "bodyId", type: "type", region: "region" };
    $("edges-filename").textContent = `${slice.nodes.length - 1} source edges · Male CNS v1.0`;
    $("neurons-filename").textContent = `${slice.nodes.length} source annotations · Male CNS v1.0`;
    $("threshold").value = "1";
    inferAndRenderMappings();
    $("source-group").value = slice.sourceType;
    $("target-group").value = slice.targetType;
    document.querySelectorAll(".sample-card").forEach((card) => {
      card.classList.toggle("selected", card.dataset.sampleCard === slice.id);
    });
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.loadSlice === slice.id));
    });
    $("active-dataset-title").textContent = `${slice.modality} · ${slice.title}`;
    $("active-dataset-note").textContent =
      `Official source data · ${slice.hops} directed connections · sensory neuron ${slice.sourceId}`;
    $("active-dataset").hidden = false;
    $("source-query").textContent =
      `PATH QUERY\n${slice.query}\n\nANNOTATION QUERY\n${slice.annotationQuery}`;
    $("active-query").hidden = false;
    runAnalysis();
    $("analysis-status").setAttribute("title", "Real connection and neuron rows queried from the official public Male CNS v1.0 NeuPrint database.");
    if (scrollToResults) {
      $("results-area").scrollIntoView({ behavior: "instant", block: "start" });
    }
  } catch (error) {
    state.results = null;
    state.activePath = null;
    stopPathPlayback();
    $("results-content").hidden = true;
    $("empty-state").hidden = false;
    $("path-progress").disabled = true;
    $("play-route").disabled = true;
    setError(`Could not load the real-data slice. ${error.message}`);
    updateStatus(false, "SOURCE SLICE UNAVAILABLE");
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

edgeInput.addEventListener("change", async () => {
  const file = edgeInput.files?.[0];
  if (!file) return;
  if (state.activeDemo) {
    clearDemoSelection();
    state.annotationRows = [];
    state.annotationColumns = {};
    annotationInput.value = "";
    $("neurons-filename").textContent = "Choose an annotations CSV";
  }
  $("edges-filename").textContent = file.name;
  updateStatus(false, "READING CONNECTIONS");
  try {
    state.edgeRows = await readCSV(file);
    const headers = Object.keys(state.edgeRows[0]);
    state.edgeColumns = Object.fromEntries(["source", "target", "weight"].map((role) => [role, guessColumn(headers, role)]));
    inferAndRenderMappings();
    runAnalysis();
  } catch (error) {
    state.edgeRows = [];
    state.edgeColumns = {};
    inferAndRenderMappings();
    clearResults();
    setError(error.message);
    updateStatus(false, "COULD NOT READ CSV");
  }
});

annotationInput.addEventListener("change", async () => {
  const file = annotationInput.files?.[0];
  if (!file) return;
  if (state.activeDemo) {
    clearDemoSelection();
    state.edgeRows = [];
    state.edgeColumns = {};
    edgeInput.value = "";
    $("edges-filename").textContent = "Choose a CSV file";
    clearResults();
  }
  $("neurons-filename").textContent = file.name;
  try {
    state.annotationRows = await readCSV(file);
    const headers = Object.keys(state.annotationRows[0]);
    state.annotationColumns = Object.fromEntries(["id", "type", "region"].map((role) => [role, guessColumn(headers, role)]));
    if (!state.annotationColumns.type) {
      state.annotationColumns.type = headers.find((header) => header !== state.annotationColumns.id) ?? "";
    }
    inferAndRenderMappings();
    runAnalysis();
  } catch (error) {
    state.annotationRows = [];
    state.annotationColumns = {};
    inferAndRenderMappings();
    runAnalysis();
    setError(error.message);
    updateStatus(false, "COULD NOT READ CSV");
  }
});

$("source-group").addEventListener("change", runAnalysis);
$("target-group").addEventListener("change", runAnalysis);
$("threshold").addEventListener("change", runAnalysis);
$("path-progress").addEventListener("input", () => {
  if (!state.activePath || !state.results) return;
  stopPathPlayback();
  state.pathStep = Number($("path-progress").value);
  renderGraph(state.activePath, state.results.annotations);
  renderPathStep(state.activePath, state.results.annotations);
});
$("play-route").addEventListener("click", togglePathPlayback);
document.querySelectorAll("[data-load-slice]").forEach((button) => {
  button.addEventListener("click", () => loadDemoSlice(button.dataset.loadSlice, true));
});
$("download-results").addEventListener("click", () => {
  const path = state.results?.paths.shortest ?? state.results?.paths.weighted;
  if (!path?.edges.length) return;
  const annotations = state.results.annotations;
  const rows = [["step", "source_id", "source_type", "target_id", "target_type", "synapse_count", "target_region"]];
  path.edges.forEach((edge, index) => rows.push([
    String(index + 1),
    edge.source,
    labelFor(edge.source, annotations),
    edge.target,
    labelFor(edge.target, annotations),
    String(edge.weight),
    annotations.get(edge.target)?.region ?? "",
  ]));
  csvDownload("candidate-connectome-route.csv", rows);
});

document.querySelectorAll(".nav-source").forEach((link) => {
  link.href = "https://github.com/Sridharmalladi/fly-connectome";
});

loadDemoSlice("visual");
