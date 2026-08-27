// Common orthopedic ICD-10 codes (curated for surgeon workflow)
export type IcdCode = { code: string; label: string };

export const ICD10_ORTHO: IcdCode[] = [
  // Osteoarthritis
  { code: 'M17.10', label: 'Osteoarthritis of Knee, Unilateral' },
  { code: 'M17.11', label: 'Osteoarthritis of Right Knee' },
  { code: 'M17.12', label: 'Osteoarthritis of Left Knee' },
  { code: 'M17.0', label: 'Bilateral Primary Osteoarthritis of Knee' },
  { code: 'M16.10', label: 'Osteoarthritis of Hip, Unilateral' },
  { code: 'M16.11', label: 'Osteoarthritis of Right Hip' },
  { code: 'M16.12', label: 'Osteoarthritis of Left Hip' },
  { code: 'M16.0', label: 'Bilateral Primary Osteoarthritis of Hip' },
  { code: 'M19.011', label: 'Primary Osteoarthritis, Right Shoulder' },
  { code: 'M19.012', label: 'Primary Osteoarthritis, Left Shoulder' },
  { code: 'M19.041', label: 'Primary Osteoarthritis, Right Hand' },
  { code: 'M19.042', label: 'Primary Osteoarthritis, Left Hand' },

  // Rotator Cuff & Shoulder
  { code: 'M75.100', label: 'Unspecified Rotator Cuff Tear (Non-traumatic)' },
  { code: 'M75.101', label: 'Rotator Cuff Tear, Right Shoulder' },
  { code: 'M75.102', label: 'Rotator Cuff Tear, Left Shoulder' },
  { code: 'M75.30', label: 'Calcific Tendinitis of Shoulder' },
  { code: 'M75.40', label: 'Impingement Syndrome of Shoulder' },
  { code: 'S43.001A', label: 'Dislocation of Right Shoulder Joint' },

  // Knee ligaments & meniscus
  { code: 'S83.511A', label: 'Sprain of ACL, Right Knee' },
  { code: 'S83.512A', label: 'Sprain of ACL, Left Knee' },
  { code: 'S83.521A', label: 'Sprain of PCL, Right Knee' },
  { code: 'S83.522A', label: 'Sprain of PCL, Left Knee' },
  { code: 'S83.241A', label: 'Bucket-handle Tear of Medial Meniscus, Right' },
  { code: 'S83.242A', label: 'Bucket-handle Tear of Medial Meniscus, Left' },
  { code: 'S83.281A', label: 'Tear of Lateral Meniscus, Right' },
  { code: 'M23.51', label: 'Chronic Instability of Right Knee' },
  { code: 'M22.41', label: 'Chondromalacia Patellae, Right' },

  // Spine
  { code: 'M51.26', label: 'Other Intervertebral Disc Displacement, Lumbar' },
  { code: 'M51.16', label: 'Intervertebral Disc Disorders with Radiculopathy, Lumbar' },
  { code: 'M50.20', label: 'Cervical Disc Displacement, Unspecified' },
  { code: 'M48.06', label: 'Spinal Stenosis, Lumbar Region' },
  { code: 'M43.16', label: 'Spondylolisthesis, Lumbar Region' },
  { code: 'M54.5', label: 'Low Back Pain' },
  { code: 'M54.2', label: 'Cervicalgia' },

  // Fractures - Upper Extremity
  { code: 'S52.501A', label: 'Fracture of Lower End of Right Radius' },
  { code: 'S52.502A', label: 'Fracture of Lower End of Left Radius' },
  { code: 'S42.201A', label: 'Fracture of Upper End of Right Humerus' },
  { code: 'S42.202A', label: 'Fracture of Upper End of Left Humerus' },
  { code: 'S42.301A', label: 'Fracture of Shaft of Right Humerus' },
  { code: 'S62.001A', label: 'Fracture of Right Scaphoid' },

  // Fractures - Lower Extremity
  { code: 'S72.001A', label: 'Fracture of Neck of Right Femur (Femoral Neck)' },
  { code: 'S72.002A', label: 'Fracture of Neck of Left Femur (Femoral Neck)' },
  { code: 'S72.301A', label: 'Fracture of Shaft of Right Femur' },
  { code: 'S72.302A', label: 'Fracture of Shaft of Left Femur' },
  { code: 'S82.101A', label: 'Fracture of Upper End of Right Tibia (Plateau)' },
  { code: 'S82.201A', label: 'Fracture of Shaft of Right Tibia' },
  { code: 'S82.831A', label: 'Fracture of Right Medial Malleolus' },
  { code: 'S82.63XA', label: 'Fracture of Lateral Malleolus, Unspecified' },
  { code: 'S92.001A', label: 'Fracture of Right Calcaneus' },

  // Deformities / Congenital
  { code: 'M20.10', label: 'Hallux Valgus (Bunion)' },
  { code: 'M21.611', label: 'Bunion of Right Foot' },
  { code: 'M21.612', label: 'Bunion of Left Foot' },
  { code: 'Q65.0', label: 'Congenital Dislocation of Hip, Unilateral' },
  { code: 'Q66.0', label: 'Congenital Talipes Equinovarus (Clubfoot)' },

  // Sports & Overuse
  { code: 'M77.11', label: 'Lateral Epicondylitis, Right (Tennis Elbow)' },
  { code: 'M77.12', label: 'Lateral Epicondylitis, Left (Tennis Elbow)' },
  { code: 'M77.01', label: 'Medial Epicondylitis, Right (Golfer\'s Elbow)' },
  { code: 'M65.311', label: 'Trigger Thumb, Right' },
  { code: 'G56.01', label: 'Carpal Tunnel Syndrome, Right' },
  { code: 'G56.02', label: 'Carpal Tunnel Syndrome, Left' },
  { code: 'M65.4', label: 'Radial Styloid Tenosynovitis (De Quervain)' },
  { code: 'M76.60', label: 'Achilles Tendinitis' },
  { code: 'M76.61', label: 'Achilles Tendinitis, Right' },
  { code: 'M72.2', label: 'Plantar Fascial Fibromatosis (Plantar Fasciitis)' },

  // Post-operative / Complications
  { code: 'T84.010A', label: 'Broken Internal Right Hip Prosthesis' },
  { code: 'T84.011A', label: 'Broken Internal Left Hip Prosthesis' },
  { code: 'T84.031A', label: 'Mechanical Loosening of Right Knee Prosthesis' },
  { code: 'T84.50XA', label: 'Infection due to Internal Joint Prosthesis' },
  { code: 'Z96.641', label: 'Presence of Right Artificial Hip Joint' },
  { code: 'Z96.651', label: 'Presence of Right Artificial Knee Joint' },
  { code: 'Z47.1', label: 'Aftercare Following Joint Replacement Surgery' },

  // Bone diseases
  { code: 'M81.0', label: 'Age-related Osteoporosis w/o Current Fracture' },
  { code: 'M80.80XA', label: 'Osteoporosis w/ Current Pathological Fracture' },
  { code: 'M86.9', label: 'Osteomyelitis, Unspecified' },
];

export function searchIcd(q: string, limit = 8): IcdCode[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const starts: IcdCode[] = [];
  const contains: IcdCode[] = [];
  for (const it of ICD10_ORTHO) {
    const label = it.label.toLowerCase();
    const code = it.code.toLowerCase();
    if (code.startsWith(query) || label.startsWith(query)) starts.push(it);
    else if (code.includes(query) || label.includes(query)) contains.push(it);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
