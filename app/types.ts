export type DeliverableBreakdown = {
  total: number;
  prod_done: number;
  prod_pct: number;
  prod_in_progress: number;
  prod_not_started: number;
  prod_on_hold: number;
  qc_passed: number;
  qc_pct: number;
  qc_failed: number;
  qc_in_progress: number;
  qc_not_started: number;
  qc_on_hold: number;
};

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
  deliverable_breakdown: Partial<Record<'SDTMs' | 'ADaMs' | 'Tables' | 'Listings' | 'Figures', DeliverableBreakdown>>;
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
    sdtm: string; adam: string; tfls: string; define: string;
    tables?: string; listings?: string; figures?: string;
  };
  issue: { date: string; category: string; severity: string; description: string };
  comments: string;
  riskBump: number;
};

export type StudyMetadata = {
  id: string; study: string; savedAt: string;
  // General Study Information
  protocol_plan_no: string; sponsor: string; fortrea_study_id: string;
  timesheet_billing_code: string; lead_statistician: string; lead_programmer: string;
  study_project_manager: string; data_mgmt_contact: string;
  deliverable_description: string; deliverable_date: string;
  // Study Details
  therapeutic_area: string; study_phase: string; raw_data_path: string;
  sdtm_data_path: string; adam_path: string; sdtm_spec_path: string;
  adam_spec_path: string; client_comments_tracker: string;
  tlfs_path: string; key_programmers: string; project_tracker_path: string;
};

export type IssueLogEntry = {
  id: string; study: string; savedAt: string;
  no: number; title: string; table_number: string; issue_description: string;
  issue_type: string; initially_reported_by: string; initial_report_date: string;
  responsible_party: string;
  issue_status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  resolved_by: string; final_date_resolved: string;
  comments: string; resolution: string;
};

export type CustomStudy = {
  id: string; study: string; client: string; ta: string;
  fso_fsp: 'FSO' | 'FSP'; phase: string; addedAt: string;
};
