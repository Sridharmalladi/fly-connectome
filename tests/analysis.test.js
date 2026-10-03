import test from "node:test";
import assert from "node:assert/strict";
import { buildAnnotations, findPath, getGraphSummary, guessColumn, normalizeEdges, parseCSV } from "../src/analysis.js";

test("parses quoted CSV fields, escaped quotes, BOM and CRLF", () => {
  assert.deepEqual(parseCSV('\uFEFFid,label\r\n1,"cell, ""A"""\r\n2,cell B\r\n'), [
    { id: "1", label: 'cell, "A"' },
    { id: "2", label: "cell B" },
  ]);
});

test("rejects malformed CSV and duplicate headers", () => {
  assert.throws(() => parseCSV("id,label\n1,\"unfinished"), /unclosed quoted/);
  assert.throws(() => parseCSV("id,id\n1,2"), /unique/);
});

test("guesses NeuPrint edge columns without assuming a fixed order", () => {
  assert.equal(guessColumn(["bodyId_post", "weight", "bodyId_pre"], "source"), "bodyId_pre");
  assert.equal(guessColumn(["bodyId_post", "weight", "bodyId_pre"], "target"), "bodyId_post");
  assert.equal(guessColumn(["bodyId_post", "weight", "bodyId_pre"], "weight"), "weight");
});

test("sums duplicate directed pairs, excludes invalid/self edges, then applies threshold", () => {
  const rows = [
    { pre: "A", post: "B", weight: "3" },
    { pre: "A", post: "B", weight: "4" },
    { pre: "B", post: "B", weight: "99" },
    { pre: "B", post: "C", weight: "" },
    { pre: "C", post: "D", weight: "2" },
  ];
  const result = normalizeEdges(rows, { source: "pre", target: "post", weight: "weight" }, 3);
  assert.deepEqual(result.edges, [{ source: "A", target: "B", weight: 7 }]);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.selfConnections, 1);
  assert.equal(result.invalidRows, 1);
  assert.equal(result.belowThreshold, 1);
});

test("computes graph size and annotation coverage over edge endpoints", () => {
  const edges = [{ source: "A", target: "B", weight: 5 }, { source: "B", target: "C", weight: 3 }];
  const annotations = buildAnnotations([
    { id: "A", type: "sensory", region: "eye" },
    { id: "C", type: "motor", region: "cord" },
  ], { id: "id", type: "type", region: "region" });
  const summary = getGraphSummary(edges, annotations);
  assert.equal(summary.nodes, 3);
  assert.equal(summary.edges, 2);
  assert.equal(summary.totalSynapses, 8);
  assert.equal(summary.annotated, 2);
  assert.equal(summary.annotationCoverage, 2 / 3);
});

test("shortest path minimizes hop count and respects edge direction", () => {
  const edges = [
    { source: "A", target: "B", weight: 2 },
    { source: "B", target: "D", weight: 2 },
    { source: "A", target: "C", weight: 2 },
    { source: "C", target: "E", weight: 2 },
    { source: "E", target: "D", weight: 2 },
  ];
  assert.deepEqual(findPath(edges, ["A"], ["D"], "shortest").edges.map((edge) => edge.target), ["B", "D"]);
  assert.equal(findPath(edges, ["D"], ["A"], "shortest"), null);
});

test("weighted path can prefer stronger edges over a shorter weak route", () => {
  const edges = [
    { source: "A", target: "D", weight: 1 },
    { source: "A", target: "B", weight: 30 },
    { source: "B", target: "D", weight: 30 },
  ];
  assert.equal(findPath(edges, ["A"], ["D"], "shortest").edges.length, 1);
  assert.deepEqual(findPath(edges, ["A"], ["D"], "weighted").edges.map((edge) => edge.target), ["B", "D"]);
});

test("supports multiple source and target neurons and a zero-edge match", () => {
  const edges = [{ source: "source-2", target: "target-1", weight: 8 }];
  assert.deepEqual(findPath(edges, ["source-1", "source-2"], ["target-1"], "shortest").edges, edges);
  assert.deepEqual(findPath(edges, ["same"], ["same"], "shortest"), { edges: [], cost: 0 });
});
