// Standard orthopedic clinical templates — one-tap insertion
export type Template = {
  id: string;
  label: string;
  icon: 'document-text-outline' | 'medkit-outline' | 'body-outline' | 'construct-outline';
  body: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export const TEMPLATES: Template[] = [
  {
    id: 'discharge',
    label: 'Discharge Summary',
    icon: 'document-text-outline',
    body: `POST-OP OUTCOME SUMMARY

Procedure:
- (e.g. Total Knee Arthroplasty, Left)

Findings:
- Intra-op findings & implant details

Range of Motion (ROM):
- Flexion: __°  Extension: __°

Function Scores:
- WOMAC / OKS / HHS: __

Post-op Protocol:
- Weight bearing: (e.g. Full/Partial/Non)
- Physiotherapy: (start day, frequency)
- Ice / Compression: (schedule)

Medications:
- Antibiotic: __
- Analgesic: __
- Anticoagulant (DVT prophylaxis): __

Wound Status:
- Dry / Clean / Suture removal date

Follow-up Plan:
- OPD review in __ days
- Suture removal at __ days
- X-ray review at __ weeks

Discharge Instructions Given: Yes / No

Signature: _______________
Date: ${today()}`,
  },
  {
    id: 'trauma',
    label: 'Trauma Notes',
    icon: 'medkit-outline',
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

// Legacy default export kept for backward compatibility
export const DISCHARGE_TEMPLATE = TEMPLATES[0].body;
