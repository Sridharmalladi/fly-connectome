# Fly Connectome Field Guide

**From sensation to movement: exploring candidate pathways in the adult fruit fly connectome.**

An open, browser-based data-science project for inspecting the public [Male CNS v1.0 connectome](https://male-cns.janelia.org/). Load real connection and neuron-annotation CSVs to check data coverage, compare two sensory-to-motor path definitions, inspect their supporting edges, and download a traceable route table.

[![Live site](https://img.shields.io/badge/Live%20site-Visit-9fbf72)](https://sridharmalladi.github.io/fly-connectome/)
[![Tests and deployment](https://github.com/Sridharmalladi/fly-connectome/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/Sridharmalladi/fly-connectome/actions/workflows/pages.yml)

> **No results are built in.** This repository contains no connectome data and no simulated observations. The explorer produces results only after you load source tables. Files are read in your browser and are not uploaded.

## Start here

1. Visit the [Male CNS data portal](https://male-cns.janelia.org/) and its [download and query guide](https://male-cns.janelia.org/download/). The project uses the **Male CNS v1.0** release.
2. In the [Male CNS NeuPrint explorer](https://neuprint.janelia.org/?dataset=male-cns%3Av1.0&qt=findneurons), inspect cell-type annotations first. Choose one labeled sensory type and one labeled motor type that are both present in the data. Do not infer either role from an unlabeled cell.
3. Export or query a **bounded, directed connection subgraph** containing the selected source neurons, the selected target neurons, and any intermediate neurons and edges needed to connect them. A table containing only direct sensory-to-motor edges cannot reveal a multi-step route. Use total connection weights, not a per-region edge export: summing repeated region rows would double-count a connection. Record how you selected the subgraph, the dataset version, date, filters, and any API query settings.
4. Obtain the matching neuron-annotation table for those neurons. Preserve body IDs; include cell-type labels and, if available, brain-region annotations.
5. Open the [live site](https://sridharmalladi.github.io/fly-connectome/) and load the connection CSV and annotation CSV. Check the column mapping and annotation coverage before interpreting a route. Raise the minimum-synapse threshold and repeat the analysis to see whether the routes change.

The portal documents programmatic access through [`neuprint-python`](https://connectome-neuprint.github.io/neuprint-python/docs/). NeuPrint account credentials may be required to download/query data. **Never put an API token in this repository or in a browser-uploaded file.** This site does not request or use a token.

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
└── tests/analysis.test.js       # CSV, data-cleaning, summary and path tests
```

## Scientific guardrails

A connectome is a static, reconstructed wiring diagram. It does not directly measure activity, timing, behavior, or causation. Synapse counts are structural measurements—not direct measures of influence. Labels can be incomplete or uncertain. A single mapped specimen is not a population study. These results describe **candidate structural routes**, not demonstrated functional circuits.

The first version intentionally prioritizes a transparent graph baseline over machine learning. Embeddings, classification and link prediction can wait until a particular scientific question and an appropriate validation design justify them.

## Primary sources

- [Male Fly Central Nervous System dataset and tools](https://male-cns.janelia.org/)
- [Male CNS data download and query guide](https://male-cns.janelia.org/download/)
- [Male CNS v1.0 in NeuPrint](https://neuprint.janelia.org/?dataset=male-cns%3Av1.0&qt=findneurons)
- [Google Research release overview](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/)
- [neuprint-python documentation](https://connectome-neuprint.github.io/neuprint-python/docs/)
- [FlyWire connectome access tutorials](https://github.com/seung-lab/FlyConnectome)
