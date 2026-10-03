# Fly Connectome Project Plan

## Project title

**From Sensory Input to Movement: Exploring Pathways in the Adult Fruit Fly Connectome**

## The idea in one minute

A connectome is a map of nerve cells and the connections between them. This project uses a real, publicly released fruit fly connectome to trace and describe possible routes from sensory neurons to movement-related neurons.

The goal is to make a large scientific dataset easier to explore and to produce a careful, reproducible analysis of candidate pathways. The project will not claim to explain what a fly thinks or prove that a pathway causes a behavior. The connectome records wiring, not moment-to-moment neural activity or behavior.

## The research question

**What are the shortest and strongest annotated routes from selected sensory neuron groups to selected motor neuron groups in the male fruit fly central nervous system, and how do those routes differ by sensory system or brain region?**

“Strongest” will mean the route with the largest synapse counts along its connections under a clearly stated path-scoring rule. It does not mean that the route is active, fast, or behaviorally important.

### Why this is a good first question

- It has a concrete input (sensory neurons) and output (motor neurons).
- It uses both graph analysis and the expert annotations attached to the connectome.
- It is narrow enough to finish, while leaving room to expand to vision, smell, hearing, or taste.
- It can produce a useful visual result: a reader can follow candidate routes through named cell groups and brain regions.

## What the data contains

The main data source is the **MaleCNS v1.0** adult male fruit fly brain and nerve cord connectome released by HHMI Janelia and collaborators, including Google Research. The release describes more than 166,000 neurons and 125 million synapses. A connectome edge links one neuron to another; the number of synapses can be used as an edge weight. Neurons also have annotations such as cell type or brain region, subject to the coverage and definitions of the dataset.

The primary discovery interface is the [Male Fly Central Nervous System dataset page](https://male-cns.janelia.org/). Google’s release page links to the paper, dataset and visualization tools: [Google Research overview](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/). The earlier female connectome can be explored through [FlyWire Codex](https://codex.flywire.ai/).

Before analysis, record the exact dataset version, download date, license, source URLs, file checksums where available, and the annotation version. The project should preserve the original downloaded files unchanged and write transformed tables separately.

## What we will deliver

1. **A reproducible data notebook or pipeline** that loads the released connectome tables and documents every filter and transformation.
2. **A compact analysis table** of selected sensory-to-motor candidate routes, showing neuron or cell-type labels, edge synapse counts, path length, and source annotations.
3. **A visual explorer or report** showing the routes and their brain-region transitions.
4. **A validation and limitations report** that checks whether results depend on thresholds, missing annotations, or the chosen path score.
5. **A clear research summary** that separates observed wiring patterns from biological interpretation.

No simulated or synthetic rows will be added to the analysis dataset. Small examples in documentation, if ever needed, must be labelled as illustrative and kept out of analysis results.

## Analysis plan in plain language

### 1. Learn the data before choosing the final targets

Inspect the dataset guide, paper, data dictionary and available tables. Identify how neurons, synapses, cell types, brain regions and sensory or motor labels are represented. Check whether the released male dataset has the needed motor annotations and whether the chosen sensory groups are well represented.

Start with one sensory system that has usable labels and a traceable route to motor neurons. Do not assume every sensory neuron or motor target is annotated completely.

### 2. Build a clean directed graph

Treat each neuron as a node. Treat each directed synaptic connection as an edge from the sending neuron to the receiving neuron. Store synapse count as an edge weight, along with any available brain-region and cell-type annotations.

Keep the raw connection table intact. Make an analysis view with documented rules for duplicate rows, self-connections, missing labels, and any minimum synapse threshold. The threshold is an analysis choice, not a property of nature, so results must be checked at more than one reasonable threshold.

### 3. Describe coverage and basic structure

Before searching for paths, report:

- Number of neurons and connections in the downloaded subset.
- Percentage of neurons with cell-type and brain-region annotations.
- Counts by broad cell group and region.
- Distribution of synapse counts per connection.
- Number of selected sensory and motor neurons included.

This tells the reader what the analysis can and cannot see.

### 4. Find candidate paths

Use graph search to identify short routes from selected sensory neurons to selected motor neurons. Then rank or summarize those routes using a declared rule, such as:

- Fewest connections (shortest path), or
- A cost based on connection strength, for example assigning stronger edges a lower traversal cost using a documented transformation of synapse counts.

Do not quietly mix “fewest steps” and “strongest connection”; they are different questions. Start with shortest paths and a separate strength summary. Explore alternative path rules as a sensitivity analysis.

### 5. Compare groups carefully

Compare route length, edge weights, intermediate cell types and region transitions across sensory groups or regions only where annotations and counts support the comparison. Report group sizes. Avoid presenting a sparse or poorly annotated group as equivalent to a well-covered one.

### 6. Validate the analysis

- Trace a sample of reported routes back to the source connection rows.
- Confirm edge direction and neuron identifiers against the data documentation.
- Re-run with different minimum-edge thresholds and path-ranking rules.
- Check whether the main finding survives removal of weak or uncertainly annotated edges.
- Compare against known circuit examples from the primary scientific literature, while keeping the new analysis distinct from published claims.

## Methods and why they fit

### Core methods

- **Descriptive statistics:** summarize nodes, edges, annotations and synapse counts before making a model.
- **Directed graph analysis:** the connections have a direction, so direction matters when tracing a signal route.
- **Shortest-path algorithms:** find routes with the fewest edges or lowest defined cost.
- **Community or cell-group summaries:** optionally identify clusters of densely connected neurons, then see which groups occur along candidate routes.
- **Sensitivity analysis:** repeat the analysis under reasonable threshold and scoring choices to see which conclusions are stable.

### Optional machine learning

Machine learning is not required for the first result. Add it only to answer a specific question.

- **Node embeddings or graph representation learning:** turn each neuron’s connection pattern into a compact numeric representation. Similar representations may reveal neurons with similar wiring. Compare these groupings with expert cell-type labels.
- **Cell-type classification:** if there are reliable known labels, predict cell type from connectivity features and test on held-out neurons or held-out cell groups. This asks whether wiring contains enough information to recover the labels; it does not prove the predicted biology is correct.
- **Link prediction:** estimate which neuron pairs are likely to connect based on the rest of the graph. This is a secondary technical exercise, not the main scientific goal. Because this connectome is extensively reconstructed, a random edge split could leak near-duplicate structure. Use careful splits and avoid presenting prediction accuracy as discovery without independent validation.

A simpler baseline is often the stronger choice for this project: it is easier to explain, audit and connect to the biological question.

## Important limitations

- **A wiring diagram is static.** It does not directly measure neural activity, timing, learning or behavior.
- **Connection weight is not a direct measure of influence.** Synapse count is a structural measure; it does not by itself establish signal strength or causal importance.
- **One connectome is not a population study.** A single mapped individual cannot establish how much wiring varies across flies.
- **Annotations may be incomplete or uncertain.** Missing labels must not be treated as proof that a neuron has no role.
- **A path is a candidate route, not necessarily a functioning circuit.** It may require other data, such as neural activity, physiology or behavioral experiments, to support a functional interpretation.
- **Sex comparisons need care.** Comparing male and female datasets can be interesting, but versions, coverage, annotation conventions and specimen differences can confound the comparison. Do not describe a difference as a sex effect without checking these issues and finding adequate biological replication.

## Evaluation: what counts as a successful project?

This project succeeds if another person can reproduce the data selection and route analysis, inspect the supporting edges, understand the path-scoring rule, and see which findings are robust to reasonable analysis choices.

Useful evaluation measures include:

- Annotation coverage and route coverage.
- Stability of top candidate routes across thresholds and scoring rules.
- Manual traceability of reported paths to the original edge table.
- Agreement or disagreement with published circuit examples, described with citations.
- Runtime and memory use on the chosen data subset, with the subset selection documented.

There is no business lift metric here. The evidence is scientific and structural, not a company outcome.

## Build sequence and current implementation

### Phase 1 — Dataset reconnaissance

Read the dataset documentation and primary paper. Confirm download method, terms, file sizes, schema, annotation availability, and whether the data can be analyzed on the available machine. Pick one well-annotated sensory group and a motor target group. The live explorer deliberately leaves these choices to the analyst; it does not assume that a particular label is available or suitable.

**Decision gate:** if suitable sensory-to-motor labels are not available in the released tables, revise the question before coding. Do not invent labels.

### Phase 2 — Small, real-data slice

Query or export only the tables needed for the selected cell groups and their nearby connections. Verify identifiers, direction and annotations. A route through intermediate neurons requires the slice to include those intermediate nodes and their supporting edges; a direct source-to-target edge query alone cannot identify a multi-step path. The slice must contain only source data, not generated examples. Record the dataset release, date, query, filters and file checksums where available.

### Phase 3 — Baseline graph analysis

The browser-based explorer now includes three small, source-derived shortest-path slices from the public Male CNS v1.0 dataset (visual, olfactory and mechanosensory) and records each exact NeuPrint query in `data/demo-slices.json`. Users can immediately inspect these real neuron IDs and edge counts, play or scrub through a path, and download its route table. These starter slices are individual example paths, not full neighborhoods, the full connectome, or fabricated data. The explorer also accepts uploaded CSVs, reports graph and annotation coverage, computes shortest and strength-weighted routes, sums repeated directed pairs, excludes invalid/self rows, and supports threshold sensitivity analysis.

### Phase 4 — Robustness and interpretation

Vary edge thresholds and scoring rules. Trace key paths back to source rows. Read relevant papers and annotate where the analysis agrees, adds detail, or remains uncertain. The explorer provides threshold variation and separate hop-count and strength-weighted routes; documenting a final scientific result still requires recording the source query and comparing the results across reasonable input slices.

### Phase 5 — Present the result

The project now includes a [live public visual field guide](https://sridharmalladi.github.io/fly-connectome/), interactive real-data pathway demonstrations, a movable path navigator, plain-language methods and limitations, primary data links, tests, and a GitHub Pages workflow. State the dataset version and limits prominently in any future result. Only then decide whether graph ML adds value.

## Repository layout

```text
fly-connectome/
  README.md                 # Data workflow, methods and local/publishing guide
  PROJECT_PLAN.md           # Research question, design and scientific guardrails
  index.html / styles.css    # Accessible, responsive project and explorer
  data/demo-slices.json      # Three source-verified real paths and query provenance
  src/analysis.js            # CSV handling, graph metrics and path algorithms
  src/app.js                 # In-browser data controls and route visualization
  tests/analysis.test.js     # Core analysis and input validation tests
  .github/workflows/pages.yml # Test and deploy through GitHub Actions
```

Do not commit large downloaded data files or private API tokens. Keep source data unchanged outside the repository and document retrieval instructions, version identifiers, queries, filters and checksums so another person can obtain and interpret the same source data.

## Interview explanation

> “I used a publicly released, expert-annotated fruit fly connectome to study candidate routes from sensory neurons to motor neurons. I treated the data as a directed graph, first checked annotation coverage, then traced and ranked paths using explicit rules. I tested whether the routes changed when I varied edge thresholds and scoring. I describe these as structural candidate pathways: the connectome alone cannot show neural activity or prove what causes behavior.”

Be ready to explain:

- Why the question is useful and narrow enough to answer.
- Why edges are directed and how synapse count is used.
- Why path selection is not the same as proving function.
- Which results were stable and which depended on assumptions.
- What additional data or experiment would be needed to establish a functional role.

## Source links

- [Google Research: Mapping the complete male fruit fly brain](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/)
- [Male Fly Central Nervous System dataset and tools](https://male-cns.janelia.org/)
- [FlyWire Codex connectome explorer](https://codex.flywire.ai/)
- [FlyWire connectome data access tutorials](https://github.com/seung-lab/FlyConnectome)
