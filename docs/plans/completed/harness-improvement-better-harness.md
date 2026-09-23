# Harness Improvement: Better Harness Pi integration

Date: 2026-09-22

## Status

Completed

## Representative Job

Review this workspace's AI coding workflow and make Better Harness usable for
future Pi/Oh My Pi sessions without changing application policy. Worker: Pi/OMP.
Workspace: standalone directory with no Git root. Authority: the user's explicit
request and the installed Better Harness/Pi documentation. Stop if the change
would require inventing application commands, credentials, or product policy.

## Baseline

Better Harness `0.7.0-alpha2` installed as a project-local Pi package, but its
first automated review session exceeded its deadline before producing a report
or changes. Before the integration change, the workspace had only the generic
Harness shim in `AGENTS.md`; it did not identify the Better Harness entrypoint,
report output root, or fresh-session activation requirement. The evidence bundle
observed seven OMP sessions, zero accepted task episodes, zero edits, zero
checks, zero result signals, and twelve failed tool events. Project-harness
history was unavailable because the workspace has no Git root.

## Earliest Gap

Context and capability discovery: the package was installed, but durable project
guidance did not route an agent to the host-specific `/better-harness` workflow
or state its evidence boundary.

## Correct Owner

The consumer repository owns its project-level `AGENTS.md`, workflow map, and
ignore rules. Better Harness owns its package skill and CLI; those are not copied
into the project.

## Intervention

Add a short Better Harness route to `AGENTS.md`, map the project package in
`docs/README.md`, document the read-only review route and evidence limits in
`docs/WORKFLOW.md`, and ignore generated Pi package caches and Better Harness
reports. A fresh agent should discover the invocation, output location, and
activation boundary from repository guidance without guessing. Evidence that
would weaken this is a fresh session failing to discover or load the package.
Maintenance owner: the repository owner keeps only project-specific routing here.
Remove the additions if Better Harness is no longer installed for Pi.

## Native Validation

Run Better Harness plugin status/verification, agent lint, a read-only evidence
bundle, and a fresh Pi/OMP session that discovers the new route. Confirm no
application files or product policy changed.

## Fresh Rerun

A fresh OMP session in the same workspace retrieved the project-local package
and `/better-harness` Skill route. It stopped before evidence collection by
request, created no report, and made no mutation. This proves discovery and
non-mutation of the route, not successful durable report rendering.

## Decision

Keep

## Result

Kept the minimal routing intervention. Native checks passed: agent-lint found
zero findings and Better Harness verified package identity and Skill route;
verification remains partial because runtime activation is host-session scoped.
The OMP evidence bundle found 10 eligible sessions, 0 edits, 0 checks, and 12
failed tool events; project-history evidence remains unavailable because this
workspace has no Git root. A later task should run the full report route in a
fresh session if durable findings are needed.
