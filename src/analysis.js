const DEFAULT_COLUMNS = {
  source: ["bodyId_pre", "pre", "source", "presynaptic", "source_id"],
  target: ["bodyId_post", "post", "target", "postsynaptic", "target_id"],
  weight: ["weight", "synapses", "synapse_count", "count"],
  id: ["bodyid", "body_id", "id", "root_id", "segmentid"],
  type: ["type", "cell_type", "celltype", "instance", "group", "name"],
  region: ["region", "neuropil", "brain_region"],
};

export function parseCSV(text) {
  const input = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("This CSV has an unclosed quoted value.");
  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one data row.");

  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error("Every CSV column needs a header.");
  if (new Set(headers).size !== headers.length) throw new Error("CSV column names must be unique.");
  return rows.slice(1).map((values, index) => {
    if (values.length > headers.length) {
      throw new Error(`Row ${index + 2} has more values than the header.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
  });
}

export function guessColumn(headers, role) {
  const candidates = DEFAULT_COLUMNS[role] ?? [];
  const normalized = headers.map((header) => [header, header.toLowerCase().replace(/[^a-z0-9]/g, "")]);
  for (const candidate of candidates) {
    const match = normalized.find(([, key]) => key === candidate.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (match) return match[0];
  }
  return "";
}

export function normalizeEdges(rows, columns, minimumWeight = 1) {
  for (const role of ["source", "target", "weight"]) {
    if (!columns[role] || !Object.hasOwn(rows[0] ?? {}, columns[role])) {
      throw new Error(`Choose a valid ${role} column in the column mapping.`);
    }
  }
  const combined = new Map();
  let invalidRows = 0;
  let selfConnections = 0;
  let duplicateRows = 0;

  for (const row of rows) {
    const source = String(row[columns.source] ?? "").trim();
    const target = String(row[columns.target] ?? "").trim();
    const weight = Number(String(row[columns.weight] ?? "").replaceAll(",", ""));
    if (!source || !target || !Number.isFinite(weight) || weight <= 0) {
      invalidRows += 1;
      continue;
    }
    if (source === target) {
      selfConnections += 1;
      continue;
    }
    const key = JSON.stringify([source, target]);
    const existing = combined.get(key);
    if (existing) {
      existing.weight += weight;
      duplicateRows += 1;
    } else {
      combined.set(key, { source, target, weight });
    }
  }
  const aggregated = [...combined.values()];
  return {
    edges: aggregated.filter((edge) => edge.weight >= minimumWeight),
    totalRows: rows.length,
    invalidRows,
    selfConnections,
    duplicateRows,
    belowThreshold: aggregated.filter((edge) => edge.weight < minimumWeight).length,
  };
}

export function buildAnnotations(rows, columns) {
  if (!rows.length || !columns.id || !Object.hasOwn(rows[0], columns.id)) return new Map();
  const annotations = new Map();
  for (const row of rows) {
    const id = String(row[columns.id] ?? "").trim();
    if (!id) continue;
    const type = columns.type ? String(row[columns.type] ?? "").trim() : "";
    const region = columns.region ? String(row[columns.region] ?? "").trim() : "";
    const current = annotations.get(id);
    if (current) {
      if (!current.type && type) current.type = type;
      if (!current.region && region) current.region = region;
    } else {
      annotations.set(id, { id, type, region });
    }
  }
  return annotations;
}

export function getGraphSummary(edges, annotations) {
  const nodes = new Set();
  const inDegree = new Map();
  const outDegree = new Map();
  const typeCounts = new Map();
  let totalSynapses = 0;
  for (const { source, target, weight } of edges) {
    nodes.add(source);
    nodes.add(target);
    outDegree.set(source, (outDegree.get(source) ?? 0) + 1);
    inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    totalSynapses += weight;
  }
  let annotated = 0;
  for (const id of nodes) {
    const annotation = annotations.get(id);
    if (annotation?.type || annotation?.region) annotated += 1;
    if (annotation?.type) typeCounts.set(annotation.type, (typeCounts.get(annotation.type) ?? 0) + 1);
  }
  const topTypes = [...typeCounts].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return {
    nodes: nodes.size,
    edges: edges.length,
    totalSynapses,
    meanSynapses: edges.length ? totalSynapses / edges.length : 0,
    annotated,
    annotationCoverage: nodes.size ? annotated / nodes.size : 0,
    typeCounts,
    topTypes,
    maxInDegree: [...inDegree.values()].reduce((max, degree) => Math.max(max, degree), 0),
    maxOutDegree: [...outDegree.values()].reduce((max, degree) => Math.max(max, degree), 0),
  };
}

class MinHeap {
  items = [];

  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].cost <= item.cost) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child = right < this.items.length && this.items[right].cost < this.items[left].cost ? right : left;
        if (this.items[child].cost >= last.cost) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }

  get size() { return this.items.length; }
}

function reconstructPath(target, previous) {
  const edges = [];
  let current = target;
  while (previous.has(current)) {
    const step = previous.get(current);
    edges.push(step.edge);
    current = step.node;
  }
  edges.reverse();
  return edges;
}

export function findPath(edges, sourceIds, targetIds, mode = "shortest") {
  const sources = new Set(sourceIds);
  const targets = new Set(targetIds);
  if (!sources.size || !targets.size || !edges.length) return null;
  for (const source of sources) if (targets.has(source)) return { edges: [], cost: 0 };
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source).push(edge);
  }

  if (mode === "shortest") {
    const queue = [...sources];
    const previous = new Map();
    const visited = new Set(sources);
    let reached = "";
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const node = queue[cursor];
      for (const edge of adjacency.get(node) ?? []) {
        if (visited.has(edge.target)) continue;
        visited.add(edge.target);
        previous.set(edge.target, { node, edge });
        if (targets.has(edge.target)) {
          reached = edge.target;
          break;
        }
        queue.push(edge.target);
      }
      if (reached) break;
    }
    return reached ? { edges: reconstructPath(reached, previous), cost: 0 } : null;
  }

  const distances = new Map();
  const previous = new Map();
  const heap = new MinHeap();
  for (const source of sources) {
    distances.set(source, 0);
    heap.push({ node: source, cost: 0 });
  }
  let reached = "";
  while (heap.size) {
    const { node, cost } = heap.pop();
    if (cost !== distances.get(node)) continue;
    if (targets.has(node)) {
      reached = node;
      break;
    }
    for (const edge of adjacency.get(node) ?? []) {
      const edgeCost = 1 / Math.log1p(edge.weight);
      const nextCost = cost + edgeCost;
      if (nextCost >= (distances.get(edge.target) ?? Infinity)) continue;
      distances.set(edge.target, nextCost);
      previous.set(edge.target, { node, edge });
      heap.push({ node: edge.target, cost: nextCost });
    }
  }
  return reached ? { edges: reconstructPath(reached, previous), cost: distances.get(reached) } : null;
}
