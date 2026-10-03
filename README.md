# Fly Connectome Field Guide

**From sensation to movement: exploring candidate pathways in the adult fruit fly connectome.**

An open, browser-based data-science project for inspecting the public [Male CNS v1.0 connectome](https://male-cns.janelia.org/). Try one of three compact, source-verified sensory-to-motor slices immediately, or load your own connection and neuron-annotation CSVs to explore further.

[![Live site](https://img.shields.io/badge/Live%20site-Visit-9fbf72)](https://sridharmalladi.github.io/fly-connectome/)
[![Tests and deployment](https://github.com/Sridharmalladi/fly-connectome/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/Sridharmalladi/fly-connectome/actions/workflows/pages.yml)

> **The included starter data are real, not simulated.** They are three small paths queried from Male CNS v1.0 and are attributed with their source queries in [`data/demo-slices.json`](./data/demo-slices.json). Each sample is a single selected path—not the full connectome or a complete neighborhood. The explorer also accepts source CSV files, which remain in your browser. The hero neuron artwork is conceptual.

## Start here

1. On the [live explorer](https://sridharmalladi.github.io/fly-connectome/), choose **Trace this real path** on one of the three data cards to explore its source neurons and recorded connection weights. Adjust the minimum synapse threshold, use the path scrubber or Play button to walk neuron-by-neuron, and download the route table.
2. Open **How these slices were made** or **Inspect the exact NeuPrint query** to review provenance. The starter rows were queried on 2026-10-03 from the public read-only [Male CNS v1.0 dataset](https://male-cns.janelia.org/) through [Janelia NeuPrint](https://neuprint.janelia.org/?dataset=male-cns%3Av1.0&qt=findneurons). The exact slice and annotation queries are included with the data.
3. To run a broader analysis, visit the [Male CNS data portal](https://male-cns.janelia.org/) and its [download and query guide](https://male-cns.janelia.org/download/). In the [Male CNS NeuPrint explorer](https://neuprint.janelia.org/?dataset=male-cns%3Av1.0&qt=findneurons), inspect cell-type annotations first. Choose one labeled sensory type and one labeled motor type present in the data.
4. Export or query a **bounded, directed connection subgraph** containing the selected source neurons, target neurons, and the intermediate neurons and edges needed to connect them. A direct-edge-only table cannot reveal a multi-step route. Use total connection weights, not a per-region export, because summing repeated regional rows can double-count a connection. Record the dataset version, date, filters and query settings.
5. Obtain the matching neuron annotations. Preserve body IDs and include cell-type labels and (if available) brain regions. Load both CSV files in the explorer, verify the column mappings and annotation coverage, then vary the threshold to check route sensitivity.

The portal documents programmatic access through [`neuprint-python`](https://connectome-neuprint.github.io/neuprint-python/docs/). The included starter slices are already stored locally; no login is needed to try them. A NeuPrint account token may be needed for your own queries or downloads. **Never put an API token in this repository or in a browser-uploaded file.** The site does not request or use a token.

## CSV format

Column names are detected where possible; use **Review column mapping** if your export uses other names.

**Connection table** (one row per directed connection):

| Sending neuron | Receiving neuron | Synapse count |
| --- | --- | ---: |
| `bodyId_pre` | `bodyId_post` | `weight` |

**Neuron annotations** (one row per neuron):

| Neuron ID | Cell-type label | Brain region (optional) |
| --- | --- | --- |
| `bodyId` | `type`, or `instance` if that is the available cell label | `region` or `neuropil` |

These headers describe the expected shape, not sample observations. You can map other column names in the explorer. The neuron ID in the annotation table must match the corresponding ID in the connection table.

## What the analysis does

- Builds a directed graph: `bodyId_pre → bodyId_post`.
- Sums repeated rows for the same directed neuron pair before applying the selected minimum synapse threshold.
- Excludes rows with missing IDs or non-positive/non-numeric weights, and excludes self-connections. The explorer reports how many rows were handled this way in its internal normalization; these cleaning counts do not change the source file.
- Reports unique endpoint neurons, directed edges, synapse counts and the fraction of graph neurons with a cell-type or region annotation.
- Uses **breadth-first search** for a route with the fewest edges.
- Separately uses **Dijkstra's algorithm** with edge cost `1 / log(1 + synapse count)`. This favors higher-count edges while charging for every step. It is a declared structural ranking rule, not a measurement of neural signal strength.
- Searches from every neuron assigned to the selected source type to every neuron assigned to the selected target type.
- Shows the shortest route's edge IDs, labels, weights and target regions, and lets you export that route as CSV. If there is no shortest route, the weighted route is used for the graph/table display if one exists.

The two path measures answer different questions; neither is presented as a biological ground truth. Group comparisons depend on annotation coverage and the boundaries of the uploaded subgraph. A route absent from a filtered slice might still exist in the full connectome.

### Included real-data starter slices

[`data/demo-slices.json`](./data/demo-slices.json) contains three query-traceable Male CNS v1.0 paths: R1–R6 visual photoreceptor to pleural motor neuron (5 edges); ORN_DA1 olfactory sensory neuron to leg motor neuron (3 edges); and JO-unclear mechanosensory neuron to leg motor neuron (4 edges). These path-only slices make the explorer immediately usable while staying small enough to inspect.

Important: each example records **one** shortest path returned by a source-database query. It does not contain all neighboring neurons, alternative paths, or the complete connectome. Consequently, the strength-weighted path calculated on that minimal slice has no alternative route to rank against, and raising the edge threshold can break the route. To compare competing pathways, load a broader, documented connection subgraph.

## Run locally

Requires Node.js 20 or newer for tests. The website itself has no build step, server dependency or third-party JavaScript packages.

```sh
npm test
npx serve .
```

Or use any static-file server, for example `python -m http.server 8000`, then open `http://localhost:8000`. A server is needed because the application uses browser JavaScript modules.

## Publish on GitHub Pages

The included GitHub Actions workflow runs the tests and publishes the site when changes are pushed to `main`. In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. After a successful run, GitHub shows the public site URL under **Settings → Pages**.

## Project structure

```text
.
├── .github/workflows/pages.yml  # Tests and deploys the static site
├── PROJECT_PLAN.md              # Research question, study design and limitations
├── README.md                    # This guide
├── index.html                   # Accessible project site and interactive explorer
├── styles.css                   # Responsive visual design
├── src/
│   ├── analysis.js              # CSV parsing, graph summaries and path algorithms
│   └── app.js                   # Browser upload, controls, results and route export
├── data/
│   └── demo-slices.json         # Real Male CNS v1.0 paths, labels and exact source queries
└── tests/analysis.test.js       # CSV, graph logic and source-slice integrity tests
```

## Scientific guardrails

A connectome is a static, reconstructed wiring diagram. It does not directly measure activity, timing, behavior, or causation. Synapse counts are structural measurements—not direct measures of influence. Labels can be incomplete or uncertain. A single mapped specimen is not a population study. These results describe **candidate structural routes**, not demonstrated functional circuits.

The first version intentionally prioritizes a transparent graph baseline over machine learning. Embeddings, classification and link prediction can wait until a particular scientific question and an appropriate validation design justify them.

## Primary sources

- Berg, S. et al. “Sexual dimorphism in the complete *Drosophila* male central nervous system connectome.” *Cell* 189(18), 5504–5526.e15 (2026). [doi:10.1016/j.cell.2026.08.015](https://doi.org/10.1016/j.cell.2026.08.015)
- [Male Fly Central Nervous System dataset and tools](https://male-cns.janelia.org/)
- [Male CNS data download and query guide](https://male-cns.janelia.org/download/)
- [Male CNS v1.0 in NeuPrint](https://neuprint.janelia.org/?dataset=male-cns%3Av1.0&qt=findneurons)
- [Google Research release overview](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/)
- [neuprint-python documentation](https://connectome-neuprint.github.io/neuprint-python/docs/)
- [FlyWire connectome access tutorials](https://github.com/seung-lab/FlyConnectome)
