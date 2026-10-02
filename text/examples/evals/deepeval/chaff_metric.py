"""A DeepEval metric that grades with chaff: deterministic, next to G-Eval or Faithfulness.

pip install deepeval; npm i -D chaffjs. Put examples/evals/python on PYTHONPATH for chaff_cli.
"""

from deepeval.metrics import BaseMetric
from deepeval.test_case import LLMTestCase

from chaff_cli import grade_with_chaff, reason_of


class ChaffMetric(BaseMetric):
    """1 when chaff passes the output, 0 when it fails. `expected_output` is the reference whose facts must be kept."""

    def __init__(self, threshold: float = 1.0, cwd: str | None = None):
        self.threshold = threshold
        self.cwd = cwd
        self.error = None

    def measure(self, test_case: LLMTestCase) -> float:
        try:
            result = grade_with_chaff(test_case.actual_output, reference=test_case.expected_output, cwd=self.cwd)
            self.score = 1.0 if result["pass"] else 0.0
            self.reason = reason_of(result)
            self.success = self.score >= self.threshold
            return self.score
        except Exception as e:
            self.error = str(e)
            raise

    async def a_measure(self, test_case: LLMTestCase) -> float:
        return self.measure(test_case)

    def is_successful(self) -> bool:
        if self.error is not None:
            self.success = False
        else:
            try:
                self.success = self.score >= self.threshold
            except TypeError:
                self.success = False
        return self.success

    @property
    def __name__(self):
        return "chaff"


# With pytest:
#
# from deepeval import assert_test
#
# def test_summary_keeps_facts():
#     test_case = LLMTestCase(input="Summarize the report", actual_output=summary, expected_output=report)
#     assert_test(test_case, [ChaffMetric()])
