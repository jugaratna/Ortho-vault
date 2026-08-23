"""Pydantic models for OrthoVault."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class MediaFile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    kind: str  # "image" | "pdf" | "doc" | "video" | "dicom" | "other"
    mime: str
    size: int = 0
    storage_path: str
    section: str  # "pre_op" | "post_op" | "video"
    uploaded_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ShareEntry(BaseModel):
    user_id: str
    scope: str = "read"  # "read" | "edit"
    email: str = ""
    name: str = ""
    shared_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Patient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    age: int
    sex: str
    mobile: str
    country_code: str = "+91"
    diagnosis: str = ""
    history: str = ""
    date_of_surgery: Optional[str] = None
    followup_days: Optional[int] = None
    operative_note: str = ""
    discharge_note: str = ""
    result: str = ""
    pre_op: List[MediaFile] = []
    post_op: List[MediaFile] = []
    videos: List[MediaFile] = []
    shared_with: List[ShareEntry] = []
    owner_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PatientUpsert(BaseModel):
    id: Optional[str] = None
    name: str
    age: int
    sex: str
    mobile: str
    country_code: str = "+91"
    diagnosis: str = ""
    history: str = ""
    date_of_surgery: Optional[str] = None
    followup_days: Optional[int] = None
    operative_note: str = ""
    discharge_note: str = ""
    result: str = ""
    pre_op: List[MediaFile] = []
    post_op: List[MediaFile] = []
    videos: List[MediaFile] = []
    shared_with: List[ShareEntry] = []


# ---- Auth ----
class SessionExchange(BaseModel):
    session_id: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str = ""
    picture: str = ""
    role: str = "editor"
    last_active: Optional[str] = None


class SessionOut(BaseModel):
    session_token: str
    user: UserOut


class InviteIn(BaseModel):
    email: str
    role: str = "editor"


class BulkInviteIn(BaseModel):
    emails: List[str]
    role: str = "editor"


class InviteOut(BaseModel):
    email: str
    role: str
    invited_at: Optional[str] = None
    emailed: Optional[bool] = None


class RoleUpdate(BaseModel):
    role: str


class DraftDischargeIn(BaseModel):
    name: str = ""
    age: int = 0
    sex: str = ""
    diagnosis: str = ""
    date_of_surgery: Optional[str] = None
    operative_note: str = ""
    result: str = ""


class ShareIn(BaseModel):
    user_id: str
    scope: str = "read"  # "read" | "edit"


class ColleagueOut(BaseModel):
    user_id: str
    email: str
    name: str = ""
    role: str = "editor"


class ActivityOut(BaseModel):
    id: str
    actor_id: str
    actor_name: str
    action: str
    entity_type: str
    entity_id: str
    entity_name: str
    meta: dict = {}
    at: str
