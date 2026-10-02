"""chaff's fact and quotation checks next to Ragas Faithfulness.

Faithfulness asks a model whether each claim is supported by the retrieved contexts. chaff checks, without a model,
that numbers, dates, names and quotations were not dropped or invented, and that each quotation is at its address.
The two disagree usefully: a paraphrase can be faithful and still change a figure.

pip install ragas openai; npm i -D chaffjs. Put examples/evals/python on PYTHONPATH for chaff_cli.
"""

import asyncio

from openai import AsyncOpenAI
from ragas.llms import llm_factory
from ragas.metrics.collections import Faithfulness

from chaff_cli import grade_with_chaff, reason_of


async def both(user_input: str, response: str, contexts: list[str]) -> dict:
    faithfulness = Faithfulness(llm=llm_factory("gpt-4o-mini", client=AsyncOpenAI()))
    judged = await faithfulness.ascore(user_input=user_input, response=response, retrieved_contexts=contexts)
    # The contexts joined are the reference: a fact the response states that none of them does is "added".
    checked = grade_with_chaff(response, reference="\n\n".join(contexts))
    return {"faithfulness": judged, "chaff_pass": checked["pass"], "chaff_reason": reason_of(checked)}


if __name__ == "__main__":
    print(
        asyncio.run(
            both(
                "When was the first Super Bowl?",
                "The first Super Bowl was held on January 15, 1967.",
                ["The first AFL–NFL World Championship Game was played on January 15, 1967."],
            )
        )
    )
