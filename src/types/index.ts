export type CriterionCategory = 'Technical' | 'Financial' | 'Compliance';
export type CriterionWeight = 'Mandatory' | 'Optional';
export type DecisionStatus = 'Eligible' | 'Not Eligible' | 'Review';
export type BidderStatus = 'Processing' | 'Completed' | 'Failed';
export type TenderStatus = 'Draft' | 'Parsing' | 'Parsed' | 'Evaluating' | 'Completed';

export interface Criterion {
  id: string;
  name: string;
  category: CriterionCategory;
  weight: CriterionWeight;
  description: string;
  threshold?: string;
}

export interface Bidder {
  id: string;
  name: string;
  files: string[];
  status: BidderStatus;
  uploadedAt: string;
}

export interface EvaluationResult {
  id: string;
  bidderId: string;
  bidderName: string;
  criterionId: string;
  criterionName: string;
  extractedValue: string;
  decision: DecisionStatus;
  confidence: number;
  sourceDocument: string;
  explanation: string;
  reviewedBy?: string;
  reviewComment?: string;
  reviewedAt?: string;
}

export interface Tender {
  id: string;
  title: string;
  referenceNo: string;
  status: TenderStatus;
  uploadedAt: string;
  criteria: Criterion[];
  bidders: Bidder[];
  evaluations: EvaluationResult[];
}

export interface ActivityLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  tenderRef?: string;
  details?: string;
}

export interface TimelineStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string;
}
