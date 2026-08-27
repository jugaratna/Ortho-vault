export type TplTarget = 'result' | 'operative_note' | 'discharge_note';

export type Template = {
  id: string;
  label: string;
  body: string;
  target?: TplTarget;
  builtin?: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

export const TEMPLATES: Template[] = [
  {
    id: 'operative-note',
    target: 'operative_note',
    label: 'Standard Operative Note',
    builtin: true,
    body: `OPERATIVE NOTE

Pre-op Diagnosis:
- __

Post-op Diagnosis:
- __

Procedure Performed:
- (e.g. Right Total Knee Arthroplasty — Posterior Stabilized)

Surgeon: Dr. __
Assistant: __
Anaesthetist: __
Anaesthesia: Spinal / General / Regional Block

Position: Supine with bolster
Prep & Drape: Standard sterile chlorhexidine prep

Incision:
- Midline anterior knee incision, medial parapatellar arthrotomy (__ cm)

Findings:
- Grade IV tricompartmental osteoarthritis, denuded cartilage on medial femoral condyle and medial tibial plateau.

Steps of Procedure:
1. Proximal tibial resection performed with extramedullary guide at 90° to mechanical axis.
2. Distal femoral resection at 5° valgus angle using intramedullary guide.
3. Anterior, posterior, and chamfer cuts completed.
4. Trial components inserted; stability verified in full extension and 90° flexion with neutral mechanical axis.
5. Bone surfaces pulsatile-lavaged and dried.
6. Implants cemented: Femoral component size __, Tibial tray size __ with __ mm ultra-congruent poly insert.
7. Patellar resurfacing / denervation performed.
8. Thorough washout, tourniquet deflated, meticulous hemostasis achieved.

Implants Used:
- Femoral: __ (Lot: __)
- Tibial Tray: __ (Lot: __)
- Insert: __ mm PE (Lot: __)

Closure:
- Capsule: #1 Vicryl running
- Subcutaneous: 2-0 Vicryl
- Skin: Monocryl subcuticular / Staples

Estimated Blood Loss: 100 ml
Tourniquet Time: 48 min
Drains: None

Post-op Instructions:
- Full weight bearing as tolerated with walker from POD 1
- DVT Prophylaxis: Enoxaparin 40mg SC daily × 14 days
- Suture/staple removal: POD 14
- Follow-up: 14 days with AP & Lateral radiographs

Signature: Dr. Ortho
Date: ${today()}`,
  },
  {
    id: 'discharge',
    target: 'discharge_note',
    label: 'Discharge Summary',
    builtin: true,
    body: `DISCHARGE SUMMARY

Admission Date: __
Surgery Date: __
Discharge Date: ${today()}

Pre-op Diagnosis:
- Osteoarthritis / Fracture / Ligament injury

Procedure Performed:
- Joint Arthroplasty / Arthroscopy / Fracture Fixation
- Implants: __

Hospital Course:
- Uneventful post-operative recovery. Vitals stable. Surgical site dressing clean and dry.

Range of Motion at Discharge:
- Flexion: 90°  Extension: 0°
- Neurovascular status: Distal pulses palpable, motor/sensory intact.

Wound Status:
- Dry and healthy. Suture removal scheduled on POD 14.

Weight Bearing:
- Full weight bearing with walker / Non-weight bearing

Physiotherapy Protocol:
- Active assisted knee flexion/extension exercises
- Quadriceps and hamstring isometric strengthening
- Ankle pumps for DVT prevention

Discharge Medications:
- Tab. Cefuroxime 500mg BD × 5 days
- Tab. Paracetamol + Tramadol BD PRN pain
- Tab. Pantoprazole 40mg OD AC × 7 days
- Tab. Rivaroxaban 10mg OD × 14 days (DVT Prophylaxis)

Follow-up Plan:
- OPD review at 14 days for wound inspection & suture removal
- Review X-ray at 6 weeks

Red-flag Signs Advised (Report immediately if: Fever >101°F, persistent wound discharge, calf swelling/pain, chest tightness).

Signature: _______________`,
  },
  {
    id: 'trauma',
    target: 'result',
    label: 'Trauma Examination & Result',
    builtin: true,
    body: `TRAUMA & OUTCOME NOTES

Mechanism of Injury:
- Road traffic collision / Fall from height
- Date & Time: __

Primary Survey (ATLS):
- Airway: Intact
- Breathing: Bilateral air entry equal
- Circulation: Stable, pulses palpable
- Disability: GCS 15/15, pupils reactive
- Exposure: Log-roll normal

Injured Extremity Findings:
- Closed/Open Injury (Gustilo-Anderson Grade: __)
- Deformity & Swelling: Present
- Distal Neurovascular: Radial/Dorsalis pedis pulses palpable, sensations intact
- Compartments: Soft, supple, non-tender

Radiographic Confirmation:
- Fracture pattern classified as AO/OTA: __
- Alignment restored post-reduction.

Outcome / Result:
- Patient recovered satisfactorily without early neurovascular or wound complications.

Date: ${today()}`,
  },
  {
    id: 'arthroscopy',
    target: 'operative_note',
    label: 'Arthroscopy Operative Findings',
    builtin: true,
    body: `ARTHROSCOPY OPERATIVE REPORT

Joint: Knee / Shoulder (Side: Right / Left)
Approach: Standard Anterolateral (viewing) and Anteromedial (working) portals

Diagnostic Arthroscopy Findings:
- Patellofemoral Joint: Normal articular cartilage (ICRS Grade 0)
- Medial Compartment: Medial meniscus tear (Bucket-handle / Radial)
- Intercondylar Notch: Anterior Cruciate Ligament (ACL) complete mid-substance tear
- Lateral Compartment: Lateral meniscus intact, articular cartilage smooth

Procedure Performed:
1. Debridement and partial medial meniscectomy preserving stable peripheral rim.
2. Notch preparation and radiofrequency clearance.
3. Hamstring autograft (Semitendinosus + Gracilis) quadrupled to 8.5mm diameter.
4. Femoral tunnel drilled via transportal technique, tibial tunnel with ACL jig.
5. Graft shuttled and secured with Femoral Adjustable Loop Button and Tibial Bioabsorbable Interference Screw (9 × 30 mm).
6. Lachman and Pivot Shift tests negative at 30° flexion with full passive extension.

Post-op Protocol:
- Hinged knee brace locked in extension for walking
- Immediate passive ROM 0-90°
- Isometric quadriceps exercises from Day 1

Date: ${today()}`,
  },
  {
    id: 'fracture',
    target: 'operative_note',
    label: 'ORIF Fracture Fixation',
    builtin: true,
    body: `FRACTURE REDUCTION & FIXATION NOTE

Diagnosis: Displaced Fracture (AO Classification: __)
Anaesthesia: Regional Block / General Anaesthesia

Surgical Approach:
- Direct anatomical approach, subperiosteal elevation kept minimal.

Reduction:
- Fracture hematoma evacuated, fracture ends cleared.
- Anatomical reduction achieved with reduction clamps under fluoroscopy.

Fixation:
- Anatomical locking compression plate (LCP) applied.
- Secured with __ cortical and __ locking screws.
- Interfragmentary lag screw inserted across fracture plane.

Fluoroscopic Verification:
- Coronal and sagittal alignment: Anatomical
- Joint line congruity: Preserved
- Screw lengths: Ideal, no intra-articular penetration

Closure & Drain:
- Deep layers closed over suction drain with #1 Vicryl.
- Skin staples applied, sterile sterile compression dressing.

Date: ${today()}`,
  },
];
