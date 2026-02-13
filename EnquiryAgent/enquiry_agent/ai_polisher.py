from __future__ import annotations

import json
import logging
from typing import Optional

from strands import Agent
from strands.models.bedrock import BedrockModel

logger = logging.getLogger(__name__)

model = BedrockModel(
    model_id="us.anthropic.claude-haiku-4-5-20250826",
    region_name="us-east-1",
)

SYSTEM_PROMPT = """\
You are a data extraction assistant. You MUST respond with valid JSON matching this schema:
{
  "details": "<string: overall summary of the job>",
  "customerdetails": {
    "name": "<string or null: customer's full name>",
    "phone": "<string or null: contact number>",
    "address": "<string or null: job location or home address>",
    "email": "<string or null: email address>"
  }
}
Do not include any text outside the JSON object.\
"""

agent = Agent(model=model, system_prompt=SYSTEM_PROMPT)


async def polish_transcript(
    prompt1_initial: str,
    prompt2_customer_info: str,
    prompt3_follow_up: str,
) -> Optional[dict]:
    combined_prompt = f"""
    SOURCE 1 (Initial Request):
    "{prompt1_initial}"

    SOURCE 2 (Customer Details Section):
    "{prompt2_customer_info}"

    SOURCE 3 (Final Follow-up):
    "{prompt3_follow_up}"

    INSTRUCTIONS:
    - Extract 'details' (the job description) primarily from SOURCE 1 and SOURCE 3.
    - Extract 'customerdetails' (name, phone, address) primarily from SOURCE 2.
    - If a field is missing, use null. Do not hallucinate data.
    """

    try:
        result = agent(combined_prompt)
        return json.loads(str(result))
    except Exception:
        logger.exception("Bedrock extraction failed")
        return None
