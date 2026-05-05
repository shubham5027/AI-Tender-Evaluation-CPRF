import type { Tender, Criterion, Bidder, EvaluationResult, ActivityLog, TimelineStep } from '../types';

// Map database snake_case records to frontend camelCase types

export function mapCriterion(row: Record<string, unknown>): Criterion {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as Criterion['category'],
    weight: row.weight as Criterion['weight'],
    description: (row.description as string) || '',
    threshold: (row.threshold as string) || '',
  };
}

export function mapBidder(row: Record<string, unknown>, files?: Record<string, unknown>[]): Bidder {
  return {
    id: row.id as string,
    name: row.name as string,
    files: files?.map((f) => f.file_name as string) || [],
    status: row.status as Bidder['status'],
    uploadedAt: (row.created_at as string) || new Date().toISOString(),
  };
}

export function mapEvaluation(row: Record<string, unknown>, bidderName?: string, criterionName?: string): EvaluationResult {
  return {
    id: row.id as string,
    bidderId: row.bidder_id as string,
    bidderName: bidderName || '',
    criterionId: row.criterion_id as string,
    criterionName: criterionName || '',
    extractedValue: (row.extracted_value as string) || '',
    decision: row.decision as EvaluationResult['decision'],
    confidence: (row.confidence as number) || 0.5,
    sourceDocument: (row.source_document as string) || '',
    explanation: (row.explanation as string) || '',
    reviewedBy: row.reviewed_by as string | undefined,
    reviewComment: row.review_comment as string | undefined,
    reviewedAt: row.reviewed_at as string | undefined,
  };
}

export function mapActivityLog(row: Record<string, unknown>): ActivityLog {
  return {
    id: row.id as string,
    action: row.action as string,
    user: (row.user_name as string) || 'System',
    timestamp: (row.created_at as string) || new Date().toISOString(),
    tenderRef: undefined,
    details: (row.details as string) || '',
  };
}

export function mapTender(
  row: Record<string, unknown>,
  criteriaRows?: Record<string, unknown>[],
  biddersRows?: Record<string, unknown>[],
  evalRows?: Record<string, unknown>[],
  filesRows?: Record<string, unknown>[]
): Tender {
  const criteria = (criteriaRows || []).map(mapCriterion);

  const bidders = (biddersRows || []).map((b) => {
    const bidderFiles = filesRows?.filter((f) => f.bidder_id === b.id);
    return mapBidder(b, bidderFiles);
  });

  const evaluations = (evalRows || []).map((e) => {
    const bidder = biddersRows?.find((b) => b.id === e.bidder_id);
    const criterion = criteriaRows?.find((c) => c.id === e.criterion_id);
    return mapEvaluation(e, bidder?.name as string, criterion?.name as string);
  });

  return {
    id: row.id as string,
    title: row.title as string,
    referenceNo: (row.reference_no as string) || '',
    status: row.status as Tender['status'],
    uploadedAt: (row.created_at as string) || new Date().toISOString(),
    criteria,
    bidders,
    evaluations,
  };
}

export function buildTimeline(tender: Tender): TimelineStep[] {
  const steps: TimelineStep[] = [
    { id: 'ts1', label: 'Tender Uploaded', status: 'completed', timestamp: tender.uploadedAt },
  ];

  if (tender.criteria.length > 0) {
    steps.push({ id: 'ts2', label: 'Criteria Extracted', status: 'completed' });
  } else {
    steps.push({ id: 'ts2', label: 'Criteria Extracted', status: 'pending' });
    return steps;
  }

  if (tender.bidders.length > 0) {
    steps.push({ id: 'ts3', label: 'Bidder Documents Collected', status: 'completed' });
  } else {
    steps.push({ id: 'ts3', label: 'Bidder Documents Collected', status: 'pending' });
    return steps;
  }

  if (tender.evaluations.length > 0) {
    steps.push({ id: 'ts4', label: 'AI Evaluation Running', status: 'completed' });
  } else {
    steps.push({ id: 'ts4', label: 'AI Evaluation Running', status: 'pending' });
    return steps;
  }

  const hasReview = tender.evaluations.some((e) => e.decision === 'Review');
  const allReviewed = !hasReview;

  if (allReviewed) {
    steps.push({ id: 'ts5', label: 'Manual Review', status: 'completed' });
    steps.push({ id: 'ts6', label: 'Final Report', status: 'current' });
  } else {
    steps.push({ id: 'ts5', label: 'Manual Review', status: 'current' });
    steps.push({ id: 'ts6', label: 'Final Report', status: 'pending' });
  }

  return steps;
}
