// Standard orthopedic clinical templates — one-tap insertion
export type TplIcon = 'document-text-outline' | 'medkit-outline' | 'body-outline' | 'construct-outline' | 'clipboard-outline' | 'bookmark-outline';

export type Template = {
  id: string;
  label: string;
  icon: TplIcon;
  body: string;
  builtin?: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

export const TEMPLATES: Template[] = [
  {
    id: 'operative-note',
    label: 'Operative Note',
    icon: 'clipboard-outline',
    builtin: true,
    body: `OPERATIVE NOTE

Pre-op Diagnosis:
- __

Post-op Diagnosis:
- __

Procedure Performed:
- (e.g. Right THA — Uncemented, Posterior Approach)

Surgeon: Dr. __
Assistant: __
Anaesthetist: __
Anaesthesia: General / Spinal / Regional

Position:
- Supine / Lateral / Prone / Beach chair

Prep & Drape:
- Standard sterile prep with __

Incision:
- Site & Length: __ cm

Findings:
- __

Steps of Procedure:
1.
2.
3.
4.

Implants Used:
- (Manufacturer / Size / Lot #)

Closure:
- Deep fascia: __
- Subcutaneous: __
- Skin: Staples / Subcuticular / Interrupted

Estimated Blood Loss: __ ml
Tourniquet Time: __ min (if used)
Fluoroscopy Time: __ sec (if used)

Specimens Sent: None / Histopathology / Culture
Drains: None / __ Fr suction × __

Complications: None / __

Post-op Instructions:
- Weight bearing: __
- Antibiotics: __
- Analgesia: __
- Follow-up: __ days

Signature: _______________
Date: ${today()}`,
  },
  {
    id: 'discharge',
    label: 'Discharge Summary',
    icon: 'document-text-outline',
    builtin: true,
    body: `DISCHARGE SUMMARY

Admission Date: __
Surgery Date: __
Discharge Date: ${today()}

Pre-op Diagnosis:
- __

Procedure Performed:
- __
- Implants: __

Hospital Course:
- Uneventful / __

Range of Motion at Discharge:
- Flexion: __°  Extension: __°

Function Scores:
- WOMAC / OKS / HHS / DASH: __

Wound Status:
- Dry / Clean / Suture removal date: __

Weight Bearing:
- Non / Partial / Full weight bearing

Physiotherapy Protocol:
- Start day: __
- Frequency: __
- Home exercises attached: Yes / No

Discharge Medications:
- Antibiotic: __ × __ days
- Analgesic: __ × __ days
- DVT prophylaxis: __ × __ days
- Other: __

Follow-up Plan:
- OPD review in __ days
- Suture removal at __ days
- X-ray review at __ weeks

Red-flag Signs Explained (Fever / Wound discharge / Sudden pain / DVT signs): Yes

Discharge Instructions Given: Yes

Signature: _______________`,
  },
  {
    id: 'trauma',
    label: 'Trauma Notes',
    icon: 'medkit-outline',
    builtin: true,
    body: `TRAUMA NOTES

Mechanism of Injury:
- (e.g. RTA / Fall / Sports)
- Date & Time of Injury: __

Primary Survey (ABCDE):
- Airway:
- Breathing:
- Circulation:
- Disability (GCS __/15):
- Exposure:

Site-Specific Examination:
- Limb / Region: __
- Deformity: Yes / No
- Neurovascular Status: Intact / Compromised
- Compartments: Soft / Tense
- Skin: Closed / Open (Gustilo-Anderson Grade __)

Associated Injuries:
- Head / Chest / Abdomen / Pelvis / Spine

Imaging:
- X-ray:
- CT:
- MRI:

Working Diagnosis:
- (Fracture pattern, AO/OTA classification)

Immediate Management:
- Splint / POP / Skin traction:
- Antibiotic prophylaxis:
- Tetanus toxoid:
- Analgesia:

Definitive Plan:
- Conservative / Surgical (ORIF / IMN / EXFIX)

Consent Discussed: Yes / No
Date: ${today()}`,
  },
  {
    id: 'arthroscopy',
    label: 'Arthroscopy Findings',
    icon: 'body-outline',
    builtin: true,
    body: `ARTHROSCOPY OPERATIVE FINDINGS

Joint:
- (Knee / Shoulder / Hip / Ankle)  Side: R / L

Approach & Portals:
- Anterolateral / Anteromedial / Posterolateral / __

Diagnostic Findings:
- Cartilage (ICRS Grade):
  - Medial Femoral Condyle:
  - Lateral Femoral Condyle:
  - Trochlea / Patella:
  - Tibial Plateau:
- Meniscus:
  - Medial: Intact / Tear (type: bucket-handle / radial / flap)
  - Lateral: Intact / Tear (type: __)
- Ligaments:
  - ACL: Intact / Partial / Complete tear
  - PCL: Intact / Injured
  - MCL / LCL: __
- Synovium: Normal / Inflamed / Villous
- Loose bodies: Present / Absent

Procedures Performed:
- Debridement / Meniscectomy (partial-total) / Meniscal repair
- ACL reconstruction (graft: BPTB / HS / Quad) / PCL reconstruction
- Microfracture / Chondroplasty
- Synovectomy / Loose body removal

Implants Used:
- Anchors: __
- Interference screws: __

Complications: None / __

Estimated Blood Loss: __ ml
Tourniquet Time: __ min

Post-op Plan:
- Weight bearing: __
- Brace: __
- Physiotherapy protocol: __

Date: ${today()}`,
  },
  {
    id: 'fracture',
    label: 'Fracture Reduction',
    icon: 'construct-outline',
    builtin: true,
    body: `FRACTURE REDUCTION NOTE

Fracture:
- Bone / Region: __
- Side: R / L
- Pattern: Transverse / Oblique / Spiral / Comminuted / Segmental
- Displacement: __ mm / Angulation: __°
- AO/OTA Classification: __
- Open / Closed (Gustilo-Anderson: __)

Anaesthesia:
- General / Spinal / Regional / Local

Reduction Method:
- Closed reduction / Open reduction
- Manoeuvres: Traction / Counter-traction / __

Fixation:
- Cast / Splint (POP)
- K-wire × __
- Plate & screws (__ hole __ mm)
- Intramedullary nail (__ mm × __ mm)
- External fixator

Fluoroscopy Assessment:
- Alignment: Anatomical / Acceptable
- Length restored: Yes / No
- Rotation: Neutral
- Joint congruity: __

Post-reduction Neurovascular Status:
- Intact / __

Post-op Instructions:
- Weight bearing: Non / Partial / Full
- Splint / POP: Duration __ weeks
- Elevation & Ice
- Follow-up X-ray at __ weeks

Complications during procedure: None / __

Signature: _______________
Date: ${today()}`,
  },
];
