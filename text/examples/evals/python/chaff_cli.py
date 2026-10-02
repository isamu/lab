"""Grade one output with the chaff CLI and return its result line (the shape of `chaff grade --out`).

Python harnesses call chaff through its command line: no Python package, no network, no API key.
Needs Node.js 24+ and `npm i -D chaffjs` (or `npx` fetches it once).
"""

import json
import os
import shlex
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Optional

# chaff grade's exit codes: 0 every output passed, 1 one failed, 2 the input or chaff.yaml could not be read.
UNREADABLE = 2
GRADED = (0, 1)

# How to run chaff: `npx chaffjs` by default, or e.g. CHAFF_BIN="node node_modules/chaffjs/bin/chaff.js".
CHAFF = shlex.split(os.environ.get("CHAFF_BIN", "npx chaffjs"))


def grade_with_chaff(
    output: str,
    reference: Optional[str] = None,
    sources: Optional[dict[str, str]] = None,
    citations: Optional[list[dict[str, str]]] = None,
    cwd: Optional[str] = None,
) -> dict[str, Any]:
    """The result of one output. `cwd` is where chaff.yaml (and its grade: rubric) is read from."""
    item: dict[str, Any] = {"id": "output", "output": output}
    if reference is not None:
        item["reference"] = reference
    if sources is not None:
        item["sources"] = sources
    if citations is not None:
        item["citations"] = citations
    with tempfile.TemporaryDirectory() as scratch:
        items = Path(scratch) / "items.jsonl"
        results = Path(scratch) / "results.jsonl"
        items.write_text(json.dumps(item) + "\n", encoding="utf-8")
        run = subprocess.run(
            [*CHAFF, "grade", str(items), "--out", str(results), "--json"],
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
        )
        if run.returncode == UNREADABLE:
            raise ValueError(f"chaff could not grade the input: {run.stderr.strip()}")
        # Node exits 1 on its own errors too, so a missing results file means chaff never ran.
        if run.returncode not in GRADED or not results.exists():
            raise RuntimeError(f"chaff did not run (exit {run.returncode}): {run.stderr.strip() or run.stdout.strip()}")
        lines = results.read_text(encoding="utf-8").splitlines()
        if len(lines) != 1:
            raise RuntimeError(f"chaff wrote {len(lines)} result lines for one output")
        return json.loads(lines[0])


def reason_of(result: dict[str, Any]) -> str:
    """Why it passed or failed, as chaffjs/grade's toScorer() writes it."""
    rules: dict[str, int] = {}
    for finding in result["findings"]:
        rules[finding["rule"]] = rules.get(finding["rule"], 0) + 1
    verdict = "passed" if result["pass"] else "failed: " + "; ".join(result["failedBecause"])
    found = ", ".join(f"{rule} ×{count}" for rule, count in sorted(rules.items()))
    parts = [verdict, f"{len(result['findings'])} {'finding' if len(result['findings']) == 1 else 'findings'}: {found}" if found else "no findings"]
    if "score" in result:
        parts.append(f"penalty {result['score']['penalty']}")
    return " — ".join(parts)
