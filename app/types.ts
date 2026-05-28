export type Study = {
  study: string;
  client: string;
  portfolio: string;
  ta: string;
  fso_fsp: 'FSO' | 'FSP';
  total_del: number;
  prod_pct: number;
  qc_pct: number;
  sig_delays: number;
  slight_delays: number;
  failed_qc: number;
  dbl: string | null;
  fpi: string | null;
  weeks_to_dbl: number | null;
  delayed: boolean;
  at_risk: boolean;
  risk_score: number;
  risk_tier: 'Critical' | 'High' | 'Elevated' | 'Moderate' | 'Low';
  ai_risk_score: number;
  risk_factors: Array<{ label: string; value: number }>;
};

export type P21Finding = {
  finding_id: string;
  study_id: string;
  rule_id: string;
  severity: 'Error' | 'Warning';
  cdisc_standard: string;
  dataset: string;
  variable: string;
  message: string;
  ai_category: string;
  ai_root_cause: string;
  ai_suggested_fix: string;
  avg_resolution_hrs: string;
};

export type MilestoneEntry = {
  id: string;
  type: string;
  planned: string;
  actual: string;
};

export type StudyUpdate = {
  id: string;
  study: string;
  savedAt: string;
  milestones: MilestoneEntry[];
  deliverables: {
    sdtm: string;
    adam: string;
    tfls: string;
    define: string;
  };
  issue: {
    date: string;
    category: string;
    severity: string;
    description: string;
  };
  comments: string;
  riskBump: number;
};
