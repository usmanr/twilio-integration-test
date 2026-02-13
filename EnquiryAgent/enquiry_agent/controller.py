from __future__ import annotations

import json
import logging
import os
from urllib.request import urlopen, Request

from twilio.twiml.voice_response import VoiceResponse

from .services import db
from .ai_polisher import polish_transcript

logger = logging.getLogger(__name__)

VOICE = "Google.en-AU-Neural2-C"
LANGUAGE = "en-AU"

PROMPTS: dict[int, str] = {
    1: "Hi, thanks for calling ${tradie.name}. In a few words, please describe the work you want done.",
    2: "Thank you. To make sure we log your job with the correct details, please clearly state your full name, best contact number, and the property address.",
    3: "Right. Anything else you want me to note?",
}


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

    twiml = VoiceResponse()
    start = twiml.start()
    start.recording(
        track="both",
        trim="do-not-trim",
        channels="dual",
        recording_status_callback=f"{_base_url()}/webhooks/voice/va-recording-post",
        recording_status_callback_event="in-progress completed absent",
    )

    if not tradie:
        twiml.say("We could not connect your call. Please check the number.", voice=VOICE, language=LANGUAGE)
        res["content_type"] = "text/xml"
        res["body"] = str(twiml)
        return

    hints = ",".join([
        "electrician", "power point", "switchboard",
        "lighting", "rewire", "safety switch", tradie.name,
    ])

    await db.log_call(call_sid, from_number, to_number, "VA_RECEIVED")

    prompt1 = PROMPTS[1].replace("${tradie.name}", tradie.name or "the service")
    twiml.say(prompt1, voice=VOICE, language=LANGUAGE)

    twiml.gather(
        input="speech",
        action=f"{_base_url()}/webhooks/voice/va-transcription-available?step=job-details",
        action_on_empty_result=True,
        method="POST",
        language=LANGUAGE,
        speech_model="phone_call",
        enhanced=True,
        hints=hints,
        speech_timeout="3",
    )

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
    query = req.get("query", {})
    step = query.get("step", "")
    body = req["body"]
    call_sid = body.get("callsid", "")
    transcription_text = body.get("speechresult", "")
    to_number = body.get("to", "")

    twiml = VoiceResponse()

    if not transcription_text:
        logger.info("[VA WEBHOOK] Received empty transcription for %s. Ignoring.", call_sid)
        twiml.say("We did not receive a message. Goodbye.", voice=VOICE, language=LANGUAGE)
        twiml.hangup()
        res["content_type"] = "text/xml"
        res["body"] = str(twiml)
        return

    logger.info('[VA WEBHOOK] Step: %s, Received transcription for %s: "%s"', step, call_sid, transcription_text)

    if step == "job-details":
        await db.update_call_record(call_sid, {
            "steps": [{"name": "job-details", "text": transcription_text}],
        })
        gather = twiml.gather(
            input="speech",
            action=f"{_base_url()}/webhooks/voice/va-transcription-available?step=address-details",
            method="POST",
            language=LANGUAGE,
            speech_model="phone_call",
            enhanced=True,
            speech_timeout="3",
        )
        gather.say(PROMPTS[2], voice=VOICE, language=LANGUAGE)

    elif step == "address-details":
        await db.update_call_record(call_sid, {
            "steps": [{"name": "address-details", "text": transcription_text}],
        })
        gather = twiml.gather(
            input="speech",
            action=f"{_base_url()}/webhooks/voice/va-transcription-available?step=final-notes",
            method="POST",
            language=LANGUAGE,
            speech_model="phone_call",
            enhanced=True,
            speech_timeout="3",
        )
        gather.say(PROMPTS[3], voice=VOICE, language=LANGUAGE)

    elif step == "final-notes":
        await db.update_call_record(call_sid, {
            "steps": [{"name": "final-notes", "text": transcription_text}],
        })

        call_record = await db.get_call_record(call_sid)
        full_transcript = (
            " \n ".join(s["text"] for s in call_record.steps)
            if call_record and call_record.steps
            else transcription_text
        )

        await db.update_call_record(call_sid, {
            "transcript": full_transcript,
            "status": "VA_PROCESSED",
        })

        # Create the enquiry via API
        enquiries_api_url = os.environ.get("ENQUIRIES_API_URL", "")
        if enquiries_api_url and call_record:
            payload = json.dumps({
                "call_sid": call_record.call_sid,
                "from": call_record.from_number,
                "to": call_record.to_number,
                "status": call_record.status,
                "steps": call_record.steps,
                "transcript": full_transcript,
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
            except Exception:
                logger.exception("Failed to create enquiry")

        twiml.say("Thank you for the details. We will be in touch shortly. Goodbye.", voice=VOICE, language=LANGUAGE)
        twiml.hangup()

    else:
        twiml.say("An error occurred. Goodbye.", voice=VOICE, language=LANGUAGE)
        twiml.hangup()

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
