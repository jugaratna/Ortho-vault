// Standard orthopedic discharge summary template
export const DISCHARGE_TEMPLATE = `POST-OP OUTCOME SUMMARY

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
Date: ${new Date().toISOString().slice(0, 10)}`;
