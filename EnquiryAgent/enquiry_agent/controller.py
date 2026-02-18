from __future__ import annotations

import json
import logging
import os

from twilio.twiml.voice_response import VoiceResponse

from .services import db
from .ai_polisher import polish_transcript
from .enquiries_agent import create_enquiry_agent

logger = logging.getLogger(__name__)

VOICE = "Google.en-AU-Neural2-C"
LANGUAGE = "en-AU"


def _base_url() -> str:
    return os.environ.get("BASE_URL", "")


# ---------------------------------------------------------------------------
# IVR flow
# ---------------------------------------------------------------------------

async def get_incoming_call_with_ivr_response(req: dict, res: dict) -> None:
    logger.info("IVR Incoming Call: %s", json.dumps(req["body"], indent=2))
    twiml = VoiceResponse()
    gather = twiml.gather(
        num_digits=1,
        action=f"{_base_url()}/webhooks/voice/ivr-selection",
        method="POST",
    )
    gather.say(
        "Thanks for calling Micro electrician, please press 1 if you want to auto log a call, press 2 if you wish to speak to us directly",
        voice=VOICE,
        language=LANGUAGE,
    )
    twiml.redirect(f"{_base_url()}/webhooks/voice/ivr-incoming")
    res["content_type"] = "text/xml"
    res["body"] = str(twiml)


async def handle_ivr_selection(req: dict, res: dict) -> None:
    logger.info("IVR Selection received: %s", json.dumps(req["body"], indent=2))
    body = req["body"]
    digits = body.get("digits", "0")
    to = body.get("to", "")
    twiml = VoiceResponse()

    if digits == "1":
        twiml.say(
            "record your message after the beep. when you are done, hangup",
            voice=VOICE,
            language=LANGUAGE,
        )
        twiml.record(
            action=f"{_base_url()}/webhooks/voice/completed",
            method="POST",
            transcribe=True,
            recording_status_callback=f"{_base_url()}/webhooks/voice/ivr-recording-completed",
            recording_status_callback_event="completed",
            recording_status_callback_method="POST",
            transcribe_callback=f"{_base_url()}/webhooks/voice/ivr-transcription-completed",
            play_beep=True,
        )
    elif digits == "2":
        twiml.dial().number(to)
    else:
        twiml.say("Sorry, that's not a valid choice.", voice=VOICE, language=LANGUAGE)
        twiml.redirect(f"{_base_url()}/webhooks/voice/ivr-incoming")

    res["content_type"] = "text/xml"
    res["body"] = str(twiml)


async def handle_ivr_recording_completed(req: dict, res: dict) -> None:
    logger.info("IVR Recording completed: %s", json.dumps(req["body"], indent=2))
    twiml = VoiceResponse()
    twiml.say("Thank you, your message has been saved. Goodbye.", voice=VOICE, language=LANGUAGE)
    twiml.hangup()
    res["content_type"] = "text/xml"
    res["body"] = str(twiml)


async def handle_ivr_transcription_completed(req: dict, res: dict) -> None:
    logger.info("IVR Transcription completed: %s", json.dumps(req["body"], indent=2))
    twiml = VoiceResponse()
    twiml.say("Thank you, transcription received. Goodbye.", voice=VOICE, language=LANGUAGE)
    twiml.hangup()
    res["content_type"] = "text/xml"
    res["body"] = str(twiml)


# ---------------------------------------------------------------------------
# VA flow
# ---------------------------------------------------------------------------

async def handle_va_incoming_call(req: dict, res: dict) -> None:
    logger.info("handleVaIncomingCall: %s", json.dumps(req["body"], indent=2))
    body = req["body"]
    from_number = body.get("from", "")
    to_number = body.get("to", "")
    call_sid = body.get("callsid", "")

    tradie = await db.get_tradie_by_virtual_number(to_number)
    tradie_name = tradie.name if tradie else ""

    twiml = VoiceResponse()
    start = twiml.start()
    start.recording(
        track="both",
        trim="do-not-trim",
        channels="dual",
        recording_status_callback=f"{_base_url()}/webhooks/voice/va-recording-post",
        recording_status_callback_event="in-progress completed absent",
    )

    await db.log_call(call_sid, from_number, to_number, "VA_RECEIVED")

    # Create agent (initialises S3 session) and generate the greeting
    agent, _ = create_enquiry_agent(call_sid, from_number, to_number, tradie_name)

    if tradie:
        result = agent("New incoming call. Greet the caller and ask what work they need done.")
    else:
        result = agent(
            "New incoming call, but the phone number they dialled is not assigned to any business. "
            "Politely let the caller know and ask them to check the number."
        )

    response_text = str(result)

    hints = ",".join([
        "electrician", "power point", "switchboard",
        "lighting", "rewire", "safety switch",
        *([] if not tradie_name else [tradie_name]),
    ])

    gather = twiml.gather(
        input="speech",
        action=f"{_base_url()}/webhooks/voice/va-transcription-available",
        action_on_empty_result=True,
        method="POST",
        language=LANGUAGE,
        speech_model="phone_call",
        enhanced=True,
        hints=hints,
        speech_timeout="3",
    )
    gather.say(response_text, voice=VOICE, language=LANGUAGE)

    res["content_type"] = "text/xml"
    res["body"] = str(twiml)


async def handle_va_recording_available(req: dict, res: dict) -> None:
    logger.info("handleVaRecordingAvailable: %s", json.dumps(req["body"], indent=2))
    body = req["body"]
    call_sid = body.get("callsid")
    recording_url = body.get("recordingurl", "")
    recording_status = body.get("recordingstatus", "")

    if call_sid:
        await db.add_recording(call_sid, recording_url, recording_status)
    else:
        logger.error("[VA Recording] CallSid not found in recording callback body.")

    res["status_code"] = 200
    res["body"] = ""


async def handle_va_transcription_available(req: dict, res: dict) -> None:
    logger.info("handleVaTranscriptionAvailable: %s", json.dumps(req["body"], indent=2))
    body = req["body"]
    call_sid = body.get("callsid", "")
    to_number = body.get("to", "")
    from_number = body.get("from", "")

    # SpeechResult is absent (not empty) when actionOnEmptyResult fires with no input
    speech_result = body.get("speechresult")
    has_speech = speech_result is not None

    logger.info(
        '[VA WEBHOOK] Transcription for %s: speech=%s "%s"',
        call_sid,
        has_speech,
        speech_result or "",
    )

    # Restore the agent from the S3 session and process this turn
    tradie = await db.get_tradie_by_virtual_number(to_number)
    tradie_name = tradie.name if tradie else ""

    agent, enquiry_flag = create_enquiry_agent(call_sid, from_number, to_number, tradie_name)

    if has_speech:
        result = agent(speech_result)
    else:
        result = agent("[The caller was silent and did not say anything]")

    response_text = str(result)
    twiml = VoiceResponse()

    if enquiry_flag["submitted"]:
        # Agent called submit_enquiry — conversation is complete
        twiml.say(response_text, voice=VOICE, language=LANGUAGE)
        twiml.hangup()
    else:
        # Continue gathering caller input
        gather = twiml.gather(
            input="speech",
            action=f"{_base_url()}/webhooks/voice/va-transcription-available",
            action_on_empty_result=True,
            method="POST",
            language=LANGUAGE,
            speech_model="phone_call",
            enhanced=True,
            speech_timeout="3",
        )
        gather.say(response_text, voice=VOICE, language=LANGUAGE)

    res["content_type"] = "text/xml"
    res["body"] = str(twiml)


# ---------------------------------------------------------------------------
# Debug / read endpoints
# ---------------------------------------------------------------------------

async def get_all_calls(req: dict, res: dict) -> None:
    calls = await db.get_all_calls()
    res["content_type"] = "application/json"
    res["body"] = json.dumps([
        {
            "callSid": c.call_sid,
            "from": c.from_number,
            "to": c.to_number,
            "status": c.status,
            "steps": c.steps,
            "transcript": c.transcript,
        }
        for c in calls
    ])


async def get_polished_description(req: dict, res: dict) -> None:
    all_calls = await db.get_all_calls()
    if not all_calls:
        res["content_type"] = "application/json"
        res["body"] = json.dumps({"error": "No calls found"})
        return

    response_parts: list[str] = []
    for call in all_calls:
        steps = call.steps or []
        ai_response = await polish_transcript(
            steps[0]["text"] if len(steps) > 0 else "",
            steps[1]["text"] if len(steps) > 1 else "",
            steps[2]["text"] if len(steps) > 2 else "",
        )
        if ai_response:
            response_parts.append(json.dumps(ai_response))

    res["content_type"] = "application/json"
    res["body"] = "\n".join(response_parts)
