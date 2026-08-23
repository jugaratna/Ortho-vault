"""AI routes: audio transcription (Whisper) + LLM-drafted discharge note."""
import io
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText
from emergentintegrations.llm.chat import LlmChat, UserMessage

from config import EMERGENT_KEY, logger
from deps import current_user
from models import DraftDischargeIn

router = APIRouter()


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), user=Depends(current_user)):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio must be 25 MiB or smaller")

    original = file.filename or "recording.m4a"
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else "m4a"
    if ext not in {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"}:
        ext = "m4a"

    stt = OpenAISpeechToText(api_key=EMERGENT_KEY)
    buf = io.BytesIO(data)
    buf.name = f"voice.{ext}"
    try:
        result = await stt.transcribe(file=buf, model="whisper-1", response_format="text")
        text = str(result).strip() if not hasattr(result, "text") else str(result.text).strip()
    except Exception as e:
        logger.warning(f"Transcription failed: {e}")
        raise HTTPException(status_code=502, detail="Transcription failed")

    return {"text": text}


@router.post("/ai/draft-discharge")
async def draft_discharge(payload: DraftDischargeIn, user=Depends(current_user)):
    if not EMERGENT_KEY:
        raise HTTPException(status_code=500, detail="LLM key missing")
    if not (payload.operative_note.strip() or payload.result.strip()):
        raise HTTPException(status_code=400, detail="Need an operative note or result to draft from")

    system = (
        "You are a senior orthopedic surgeon writing a concise, structured DISCHARGE SUMMARY "
        "for a hospital record. Use clear clinical headings in ALL CAPS on their own line. "
        "Return plain text only (no markdown). Keep it factual — do not invent details not in the input. "
        "If a field cannot be inferred, write '__' as a placeholder for the surgeon to fill in. "
        "Include sections: Admission/Surgery/Discharge dates, Pre-op Diagnosis, Procedure Performed & Implants, "
        "Hospital Course, ROM at Discharge, Wound Status, Weight Bearing, Physiotherapy Protocol, "
        "Discharge Medications (antibiotic, analgesic, DVT prophylaxis), Follow-up Plan, Red-flag Signs Advised, "
        "and a Signature line."
    )

    context = (
        f"PATIENT: {payload.name}, {payload.age}y {payload.sex}\n"
        f"DIAGNOSIS: {payload.diagnosis or '—'}\n"
        f"DATE OF SURGERY: {payload.date_of_surgery or '—'}\n\n"
        f"OPERATIVE NOTE:\n{payload.operative_note or '(not recorded)'}\n\n"
        f"OUTCOME / RESULT:\n{payload.result or '(not recorded)'}\n\n"
        f"Draft the discharge summary now."
    )

    try:
        chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"discharge-{uuid.uuid4()}", system_message=system)
        chat = chat.with_model("openai", "gpt-4o-mini")
        draft = await chat.send_message(UserMessage(text=context))
    except Exception as e:
        logger.warning(f"Discharge draft failed: {e}")
        raise HTTPException(status_code=502, detail="AI draft failed")

    return {"draft": (draft or "").strip()}
