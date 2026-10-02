"""An Inspect AI scorer that grades the model's answer with chaff.

pip install inspect-ai; npm i -D chaffjs. Put examples/evals/python on PYTHONPATH for chaff_cli.
The sample's target is taken as the reference whose facts the answer must keep; leave it empty to skip that check.
"""

from inspect_ai.scorer import CORRECT, INCORRECT, Score, Target, accuracy, scorer, stderr
from inspect_ai.solver import TaskState

from chaff_cli import grade_with_chaff, reason_of


@scorer(metrics=[accuracy(), stderr()])
def chaff(cwd: str | None = None):
    async def score(state: TaskState, target: Target) -> Score:
        reference = target.text or None
        result = grade_with_chaff(state.output.completion, reference=reference, cwd=cwd)
        return Score(
            value=CORRECT if result["pass"] else INCORRECT,
            answer=state.output.completion,
            explanation=reason_of(result),
            metadata=result,
        )

    return score
