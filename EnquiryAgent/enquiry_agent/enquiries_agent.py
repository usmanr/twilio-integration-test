"""Strands Agent for handling the VA enquiry conversation flow.

The agent drives the multi-turn phone conversation, collecting job details,
customer information, and final notes. Conversation state is persisted in
S3 between Lambda invocations via S3SessionManager.
"""

from __future__ import annotations

import json
import logging
import os
from urllib.request import Request, urlopen

from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from strands.session.s3_session_manager import S3SessionManager

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a friendly and professional phone receptionist for a tradie business. \
Your job is to collect enquiry details from callers over the phone.

Follow this conversation flow:
1. Greet the caller warmly using the business name provided below.
2. Ask what work they need done — listen for a description of the job.
3. Ask for their full name, best contact number, and the property address.
4. Ask if there's anything else they'd like to note.
5. Once you have ALL the required information (job description, name, phone, address), \
call the submit_enquiry tool to save the enquiry, then thank them and say goodbye.

Rules:
- Keep responses concise and conversational — this is a phone call, not a text chat.
- Use Australian English.
- Do not make up or assume any information. Only use what the caller actually says.
- You MUST call submit_enquiry before ending the conversation.
- After calling submit_enquiry, say a brief goodbye and nothing else.
- Messages wrapped in square brackets like [The caller was silent] are system \
annotations about what happened, not words the caller said. Respond naturally \
(e.g. gently prompt them to speak, or repeat your last question).
- If no business name is provided, the dialled number is unassigned. Politely let \
the caller know and offer to help them check the number.\
"""


def create_enquiry_agent(
    call_sid: str,
    from_number: str,
    to_number: str,
    tradie_name: str,
) -> tuple[Agent, dict[str, bool]]:
    """Create a Strands Agent backed by S3 session persistence.

    Returns a tuple of (agent, enquiry_flag) where enquiry_flag is a mutable
    dict ``{"submitted": bool}`` that flips to True when the agent's
    ``submit_enquiry`` tool fires successfully.
    """
    model = BedrockModel(
        model_id="global.anthropic.claude-haiku-4-5-20251001-v1:0",
        region_name=os.environ.get("AWS_REGION", "ap-southeast-2"),
        temperature=0.3,
    )

    session_manager = S3SessionManager(
        session_id=call_sid,
        bucket=os.environ.get("AGENT_SESSION_BUCKET", ""),
        prefix="calls/",
    )

    if tradie_name:
        system_prompt = SYSTEM_PROMPT + f"\n\nBusiness name: {tradie_name}"
    else:
        system_prompt = SYSTEM_PROMPT + "\n\nBusiness name: (none — this number is unassigned)"

    # Mutable flag so the controller can tell whether the tool was invoked
    enquiry_flag: dict[str, bool] = {"submitted": False}

    @tool
    def submit_enquiry(
        job_description: str,
        customer_name: str,
        customer_phone: str,
        customer_address: str,
        additional_notes: str = "",
    ) -> str:
        """Submit the completed enquiry with all collected information.

        Args:
            job_description: Description of the work the customer needs done.
            customer_name: Customer's full name.
            customer_phone: Customer's best contact phone number.
            customer_address: Property address where the work is needed.
            additional_notes: Any additional notes or requests from the customer.
        """
        enquiries_api_url = os.environ.get("ENQUIRIES_API_URL", "")
        if not enquiries_api_url:
            logger.error("ENQUIRIES_API_URL not configured")
            return "Error: API URL not configured"

        payload = json.dumps({
            "callSid": call_sid,
            "from": from_number,
            "to": to_number,
            "status": "VA_PROCESSED",
            "details": job_description,
            "customerdetails": {
                "name": customer_name,
                "phone": customer_phone,
                "address": customer_address,
            },
            "additional_notes": additional_notes,
        }).encode("utf-8")

        api_req = Request(
            f"{enquiries_api_url}/enquiries",
            data=payload,
            headers={
                "x-api-key": os.environ.get("ENQUIRIES_API_KEY", ""),
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            urlopen(api_req)
            enquiry_flag["submitted"] = True
            return "Enquiry submitted successfully."
        except Exception:
            logger.exception("Failed to submit enquiry")
            return "There was an error submitting the enquiry."

    agent = Agent(
        model=model,
        system_prompt=system_prompt,
        tools=[submit_enquiry],
        session_manager=session_manager,
        callback_handler=None,
    )

    return agent, enquiry_flag
