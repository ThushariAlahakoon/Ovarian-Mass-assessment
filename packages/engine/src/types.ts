// Domain types for the CFWU ovarian mass rules engine.
// Field names follow the protocol's IOTA terms (Protocol, D. Lesion characterisation).

export type Menopause = 'premenopausal' | 'postmenopausal';
export type TumourType = 'unilocular' | 'unilocular-solid' | 'multilocular' | 'multilocular-solid' | 'solid';
export type Echogenicity = 'anechoic' | 'low-level' | 'ground-glass' | 'haemorrhagic' | 'mixed';
export type WallRegularity = 'smooth' | 'irregular';
export type SolidSurface = 'regular' | 'irregular' | 'n/a';
/** '>3' means four or more papillary projections. */
export type PapillaryCount = 0 | 1 | 2 | 3 | '>3';
export type ColourScore = 1 | 2 | 3 | 4;
export type ORadsCategory = 0 | 1 | 2 | 3 | 4 | 5;
export type Side = 'right' | 'left';
export type Origin = 'ovarian' | 'para-ovarian' | 'tubal' | 'uncertain';
export type CentreType = 'non-oncology' | 'oncology';
export type AcuteCondition = 'torsion' | 'ectopic' | 'toa-pid';

/** ADNEX result copied by the clinician from the IOTA app / online calculator (percentages). */
export interface AdnexManualEntry {
  withCa125: boolean;
  total: number;
  benign: number;
  borderline: number;
  stageI: number;
  stageIIToIV: number;
  metastatic: number;
}

export interface LesionInput {
  /** Report label, e.g. "R1", "L1". Not a patient identifier. */
  id: string;
  side: Side;
  origin: Origin;
  /** Three orthogonal diameters of the whole lesion, mm. */
  diametersMm: [number, number, number];
  /** Clinician ticks "follicle / corpus luteum <=3 cm, premenopausal". */
  physiological?: boolean;
  tumourType: TumourType;
  loculeCount?: number | null;
  moreThan10Locules: boolean;
  wallRegularity: WallRegularity;
  /** Cyst content; null for a solid lesion with no cystic content. */
  echogenicity: Echogenicity | null;
  solidComponentPresent: boolean;
  /** Largest solid component in three planes, mm (papillary projections count as solid). */
  solidDiametersMm?: [number, number, number] | null;
  papillaryCount: PapillaryCount | null;
  papillaryFlow?: boolean | null;
  solidSurface: SolidSurface;
  acousticShadows: boolean;
  colourScore: ColourScore | null;
  tenderness?: boolean | null;
  mobile?: boolean | null;
  suggestedDiagnosis?: string | null;
  diagnosisConfidence?: 'low' | 'moderate' | 'high' | null;
  adnex?: AdnexManualEntry | null;
  /** Category the clinician assigns by O-RADS v2022 descriptors (optional). */
  descriptorCategory?: ORadsCategory | null;
}

export type OvaryStatus = 'normal' | 'contains-lesion' | 'not-visualised';

export interface OvaryFinding {
  status: OvaryStatus;
  dimensionsMm?: [number, number, number] | null;
}

export interface UpperAbdomen {
  assessed: boolean;
  peritonealNodules?: boolean;
  omentalCake?: boolean;
  hydronephrosis?: boolean;
  pleuralEffusion?: boolean;
  morisonPouchFluid?: boolean;
}

export interface ExamInput {
  age: number;
  menopause: Menopause | null;
  lmpOrCycleDay?: string | null;
  indication?: string | null;
  pregnant?: boolean;
  acuteCondition?: AcuteCondition | null;
  riskFactors?: { familyHistory?: boolean; brca?: boolean; lynch?: boolean };
  ca125?: { value: number; date: string } | null;
  centreType?: CentreType;
  technique?: string;
  imageQuality?: { good: boolean; reason?: string };
  uterus?: string | null;
  ovaries: { right: OvaryFinding; left: OvaryFinding };
  /** IOTA ascites = fluid outside the pouch of Douglas. */
  ascites: boolean | null;
  podFluidDepthMm?: number | null;
  upperAbdomen?: UpperAbdomen;
  lesions: LesionInput[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  field: string;
  lesionId?: string;
  message: string;
}

export interface BenignDescriptorResult {
  applies: boolean;
  id: string | null;
  text: string | null;
  /** Why no BD applies (e.g. largest diameter >=10 cm). */
  reason: string | null;
}

export type SimpleRulesResult = 'benign' | 'malignant' | 'inconclusive';

export interface SimpleRulesOutcome {
  bFeatures: { id: string; text: string }[];
  mFeatures: { id: string; text: string }[];
  result: SimpleRulesResult;
}

export interface Flag {
  /** Stable key, e.g. "R1:M-FEATURE" or "EXAM:ASCITES". */
  key: string;
  id: string;
  scope: 'lesion' | 'exam';
  lesionId?: string;
  message: string;
  detail: string;
}

export interface ORadsOutcome {
  fromAdnex: ORadsCategory | null;
  fromDescriptors: ORadsCategory | null;
  /** Category the engine suggests (physiological, BD, or higher of ADNEX/descriptor). */
  suggested: ORadsCategory | null;
  basis: string;
}

export interface ManagementOutcome {
  category: ORadsCategory;
  recommendation: string;
  communication: string;
  additional: string[];
}

export interface LesionAssessment {
  lesionId: string;
  rulesVersion: string;
  status: 'assessed' | 'invalid' | 'excluded-acute';
  issues: ValidationIssue[];
  physiological: boolean;
  benignDescriptor: BenignDescriptorResult | null;
  adnexRequired: boolean;
  adnex: AdnexManualEntry | null;
  simpleRules: SimpleRulesOutcome | null;
  orads: ORadsOutcome | null;
  flags: Flag[];
  management: ManagementOutcome | null;
  /** Additional-trigger ids (M-FEATURE, ADNEX-METASTATIC, RMI) that apply regardless of category. */
  triggers: string[];
  requiresLevelIIIReview: boolean;
}

export interface RmiOutcome {
  uFeatures: string[];
  uScore: number | null;
  mScore: number | null;
  /** Calculated only when CA125 is entered. */
  score: number | null;
}

export interface ExamAssessment {
  rulesVersion: string;
  protocolVersion: string;
  rulesSignedOff: boolean;
  issues: ValidationIssue[];
  lesions: LesionAssessment[];
  rmi: RmiOutcome | null;
  flags: Flag[];
  notices: string[];
  /** Highest suggested category across lesions (management driven by the highest). */
  highestSuggested: ORadsCategory | null;
}

export type Role = 'student' | 'sonographer' | 'reporting-clinician' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
  qualification?: string;
  /** EFSUMB expertise level. */
  level?: 'I' | 'II' | 'III';
}
