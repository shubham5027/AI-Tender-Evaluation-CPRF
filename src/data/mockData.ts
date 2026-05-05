import type { Tender, Criterion, Bidder, EvaluationResult, ActivityLog, TimelineStep } from '../types';

const CRITERIA: Criterion[] = [
  { id: 'c1', name: 'Annual Turnover', category: 'Financial', weight: 'Mandatory', description: 'Minimum average annual turnover of ₹5 Crore for the last 3 financial years', threshold: '₹5 Cr' },
  { id: 'c2', name: 'GST Registration', category: 'Compliance', weight: 'Mandatory', description: 'Valid GST registration certificate', threshold: 'Valid' },
  { id: 'c3', name: 'ISO 9001 Certification', category: 'Technical', weight: 'Mandatory', description: 'ISO 9001:2015 certification for quality management', threshold: 'Valid' },
  { id: 'c4', name: 'Experience Certificate', category: 'Technical', weight: 'Mandatory', description: 'Minimum 3 similar works executed in last 7 years', threshold: '3 works' },
  { id: 'c5', name: 'EMD Submission', category: 'Financial', weight: 'Mandatory', description: 'Earnest Money Deposit of ₹2 Lakh', threshold: '₹2 Lakh' },
  { id: 'c6', name: 'PAN Verification', category: 'Compliance', weight: 'Mandatory', description: 'Valid PAN card of the bidding entity', threshold: 'Valid' },
  { id: 'c7', name: 'Solvency Certificate', category: 'Financial', weight: 'Optional', description: 'Solvency certificate from a scheduled bank', threshold: 'Valid' },
  { id: 'c8', name: 'MSME Registration', category: 'Compliance', weight: 'Optional', description: 'MSME/Udyam registration for preference benefits', threshold: 'Valid' },
  { id: 'c9', name: 'Technical Proposal', category: 'Technical', weight: 'Mandatory', description: 'Detailed technical proposal with methodology', threshold: 'Complete' },
  { id: 'c10', name: 'Power of Attorney', category: 'Compliance', weight: 'Optional', description: 'Authorization for the signatory', threshold: 'Valid' },
];

const BIDDERS: Bidder[] = [
  { id: 'b1', name: 'Bharat Defence Systems Pvt. Ltd.', files: ['TechnicalProposal.pdf', 'FinancialBid.pdf', 'GST_Certificate.pdf', 'ISO_Certificate.pdf', 'Turnover_Certificates.pdf', 'Experience_Letters.pdf', 'EMD_Receipt.pdf', 'PAN_Card.pdf'], status: 'Completed', uploadedAt: '2026-04-28T10:30:00Z' },
  { id: 'b2', name: 'Shakti Engineering Works', files: ['TechProposal.pdf', 'FinancialBid.pdf', 'GST_Reg.pdf', 'Turnover.pdf', 'Experience.pdf', 'EMD.pdf', 'PAN.pdf'], status: 'Completed', uploadedAt: '2026-04-28T11:15:00Z' },
  { id: 'b3', name: 'National Security Solutions Ltd.', files: ['Technical_Proposal.pdf', 'Financial_Bid.pdf', 'GST_Cert.pdf', 'ISO_9001.pdf', 'Turnover_FY23-25.pdf', 'Experience_Certs.pdf', 'EMD_Submission.pdf', 'PAN_Card.pdf', 'Solvency_Cert.pdf'], status: 'Completed', uploadedAt: '2026-04-29T09:00:00Z' },
  { id: 'b4', name: 'Vijay Tactical Equipment Co.', files: ['Proposal.pdf', 'Financial.pdf', 'GST.pdf', 'Turnover.pdf', 'EMD.pdf', 'PAN.pdf'], status: 'Completed', uploadedAt: '2026-04-29T14:20:00Z' },
  { id: 'b5', name: 'Garuda Security Systems Pvt. Ltd.', files: ['Tech_Proposal.pdf', 'FinBid.pdf', 'GST_Certificate.pdf', 'ISO_Cert.pdf', 'Turnover_Sheets.pdf', 'Exp_Certificates.pdf', 'EMD_Receipt.pdf', 'PAN_Card.pdf', 'MSME_Registration.pdf', 'PoA.pdf'], status: 'Completed', uploadedAt: '2026-04-30T08:45:00Z' },
];

const EVALUATIONS: EvaluationResult[] = [
  // Bharat Defence Systems
  { id: 'e1-1', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c1', criterionName: 'Annual Turnover', extractedValue: '₹6.2 Cr (avg last 3 FY)', decision: 'Eligible', confidence: 0.95, sourceDocument: 'Turnover_Certificates.pdf', explanation: "Criterion requires minimum ₹5 Cr average annual turnover. Document shows ₹6.2 Cr average across FY 2022-23, 2023-24, 2024-25. Exceeds threshold by ₹1.2 Cr." },
  { id: 'e1-2', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c2', criterionName: 'GST Registration', extractedValue: 'GSTIN: 07AABCB1234F1ZK, Valid', decision: 'Eligible', confidence: 0.98, sourceDocument: 'GST_Certificate.pdf', explanation: "Valid GST registration certificate found. GSTIN 07AABCB1234F1ZK is active and verified." },
  { id: 'e1-3', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c3', criterionName: 'ISO 9001 Certification', extractedValue: 'ISO 9001:2015, Valid till Dec 2027', decision: 'Eligible', confidence: 0.92, sourceDocument: 'ISO_Certificate.pdf', explanation: "ISO 9001:2015 certification is valid until December 2027. Certificate issued by Bureau Veritas." },
  { id: 'e1-4', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c4', criterionName: 'Experience Certificate', extractedValue: '5 similar works in last 7 years', decision: 'Eligible', confidence: 0.88, sourceDocument: 'Experience_Letters.pdf', explanation: "Criterion requires minimum 3 similar works. Document shows 5 completed works: CRPF Barrack Construction (2020), BSF Outpost Setup (2021), CISF Surveillance System (2022), ITBP Equipment Supply (2023), SSB Communication Network (2024)." },
  { id: 'e1-5', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c5', criterionName: 'EMD Submission', extractedValue: '₹2,00,000 via DD No. 789456', decision: 'Eligible', confidence: 0.96, sourceDocument: 'EMD_Receipt.pdf', explanation: "EMD of ₹2,00,000 submitted via Demand Draft No. 789456 dated 25-Apr-2026, drawn on SBI." },
  { id: 'e1-6', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c6', criterionName: 'PAN Verification', extractedValue: 'AABCB1234F, Valid', decision: 'Eligible', confidence: 0.97, sourceDocument: 'PAN_Card.pdf', explanation: "PAN AABCB1234F verified against company registration records. Name matches." },
  { id: 'e1-7', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c7', criterionName: 'Solvency Certificate', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.6, sourceDocument: 'N/A', explanation: "Solvency certificate not found in submitted documents. This is an optional criterion. Manual review recommended." },
  { id: 'e1-8', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c8', criterionName: 'MSME Registration', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.55, sourceDocument: 'N/A', explanation: "MSME/Udyam registration not found. Optional criterion — no penalty for absence, but preference benefits not applicable." },
  { id: 'e1-9', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c9', criterionName: 'Technical Proposal', extractedValue: 'Complete — 42 pages, methodology included', decision: 'Eligible', confidence: 0.91, sourceDocument: 'TechnicalProposal.pdf', explanation: "Technical proposal is 42 pages with detailed methodology, timeline, and resource plan. All required sections present." },
  { id: 'e1-10', bidderId: 'b1', bidderName: 'Bharat Defence Systems Pvt. Ltd.', criterionId: 'c10', criterionName: 'Power of Attorney', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.5, sourceDocument: 'N/A', explanation: "Power of Attorney not found. Optional criterion. Signatory authorization cannot be verified." },

  // Shakti Engineering Works
  { id: 'e2-1', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c1', criterionName: 'Annual Turnover', extractedValue: '₹4.8 Cr (avg last 3 FY)', decision: 'Not Eligible', confidence: 0.93, sourceDocument: 'Turnover.pdf', explanation: "Criterion requires minimum ₹5 Cr average annual turnover. Document shows ₹4.8 Cr average — shortfall of ₹0.2 Cr. This is a mandatory criterion." },
  { id: 'e2-2', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c2', criterionName: 'GST Registration', extractedValue: 'GSTIN: 09AAGCS5678B1ZP, Valid', decision: 'Eligible', confidence: 0.97, sourceDocument: 'GST_Reg.pdf', explanation: "Valid GST registration. GSTIN 09AAGCS5678B1ZP is active." },
  { id: 'e2-3', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c3', criterionName: 'ISO 9001 Certification', extractedValue: 'Not submitted', decision: 'Not Eligible', confidence: 0.85, sourceDocument: 'N/A', explanation: "ISO 9001:2015 certification not found in submitted documents. This is a mandatory criterion — bidder is not eligible." },
  { id: 'e2-4', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c4', criterionName: 'Experience Certificate', extractedValue: '2 similar works in last 7 years', decision: 'Not Eligible', confidence: 0.82, sourceDocument: 'Experience.pdf', explanation: "Criterion requires minimum 3 similar works. Only 2 works found: CRPF Outpost Repair (2022), BSF Fence Installation (2023). Shortfall of 1 work." },
  { id: 'e2-5', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c5', criterionName: 'EMD Submission', extractedValue: '₹2,00,000 via RTGS Ref 987654', decision: 'Eligible', confidence: 0.95, sourceDocument: 'EMD.pdf', explanation: "EMD of ₹2,00,000 submitted via RTGS, reference number 987654, dated 26-Apr-2026." },
  { id: 'e2-6', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c6', criterionName: 'PAN Verification', extractedValue: 'AAGCS5678B, Valid', decision: 'Eligible', confidence: 0.96, sourceDocument: 'PAN.pdf', explanation: "PAN AAGCS5678B verified. Name matches company records." },
  { id: 'e2-7', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c7', criterionName: 'Solvency Certificate', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.5, sourceDocument: 'N/A', explanation: "Solvency certificate not found. Optional criterion." },
  { id: 'e2-8', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c8', criterionName: 'MSME Registration', extractedValue: 'Udyam Reg: UDYAM-09-01-0023456', decision: 'Eligible', confidence: 0.89, sourceDocument: 'N/A', explanation: "MSME/Udyam registration found. Category: Micro Enterprise. Preference benefits applicable." },
  { id: 'e2-9', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c9', criterionName: 'Technical Proposal', extractedValue: 'Complete — 28 pages', decision: 'Eligible', confidence: 0.85, sourceDocument: 'TechProposal.pdf', explanation: "Technical proposal submitted with 28 pages. Methodology section present but less detailed than expected." },
  { id: 'e2-10', bidderId: 'b2', bidderName: 'Shakti Engineering Works', criterionId: 'c10', criterionName: 'Power of Attorney', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.5, sourceDocument: 'N/A', explanation: "Power of Attorney not found. Optional criterion." },

  // National Security Solutions
  { id: 'e3-1', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c1', criterionName: 'Annual Turnover', extractedValue: '₹8.5 Cr (avg last 3 FY)', decision: 'Eligible', confidence: 0.97, sourceDocument: 'Turnover_FY23-25.pdf', explanation: "Average annual turnover ₹8.5 Cr exceeds the ₹5 Cr threshold by ₹3.5 Cr. Strong financial position." },
  { id: 'e3-2', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c2', criterionName: 'GST Registration', extractedValue: 'GSTIN: 27AABCN9012C1ZM, Valid', decision: 'Eligible', confidence: 0.98, sourceDocument: 'GST_Cert.pdf', explanation: "Valid GST registration. GSTIN 27AABCN9012C1ZM is active." },
  { id: 'e3-3', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c3', criterionName: 'ISO 9001 Certification', extractedValue: 'ISO 9001:2015, Valid till Mar 2028', decision: 'Eligible', confidence: 0.94, sourceDocument: 'ISO_9001.pdf', explanation: "ISO 9001:2015 certification valid until March 2028. Issued by TUV SUD." },
  { id: 'e3-4', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c4', criterionName: 'Experience Certificate', extractedValue: '7 similar works in last 7 years', decision: 'Eligible', confidence: 0.92, sourceDocument: 'Exp_Certificates.pdf', explanation: "7 similar works completed: CRPF Camp Setup (2019), BSF Border Tech (2020), CISF Access Control (2021), ITBP Comms (2022), SSB Surveillance (2023), Assam Rifles Equipment (2024), NIA Forensic Lab (2025)." },
  { id: 'e3-5', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c5', criterionName: 'EMD Submission', extractedValue: '₹2,00,000 via BG No. BG2026/456', decision: 'Eligible', confidence: 0.96, sourceDocument: 'EMD_Submission.pdf', explanation: "EMD of ₹2,00,000 submitted via Bank Guarantee No. BG2026/456 from HDFC Bank." },
  { id: 'e3-6', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c6', criterionName: 'PAN Verification', extractedValue: 'AABCN9012C, Valid', decision: 'Eligible', confidence: 0.97, sourceDocument: 'PAN_Card.pdf', explanation: "PAN AABCN9012C verified. Name matches." },
  { id: 'e3-7', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c7', criterionName: 'Solvency Certificate', extractedValue: '₹15 Cr solvency, Valid till Jun 2026', decision: 'Eligible', confidence: 0.91, sourceDocument: 'Solvency_Cert.pdf', explanation: "Solvency certificate from SBI showing ₹15 Cr solvency. Valid until June 2026." },
  { id: 'e3-8', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c8', criterionName: 'MSME Registration', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.55, sourceDocument: 'N/A', explanation: "MSME registration not found. Optional — no penalty but no preference benefits." },
  { id: 'e3-9', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c9', criterionName: 'Technical Proposal', extractedValue: 'Complete — 56 pages, comprehensive', decision: 'Eligible', confidence: 0.95, sourceDocument: 'Technical_Proposal.pdf', explanation: "Comprehensive 56-page technical proposal with detailed methodology, risk assessment, and quality assurance plan." },
  { id: 'e3-10', bidderId: 'b3', bidderName: 'National Security Solutions Ltd.', criterionId: 'c10', criterionName: 'Power of Attorney', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.5, sourceDocument: 'N/A', explanation: "Power of Attorney not found. Optional criterion." },

  // Vijay Tactical Equipment
  { id: 'e4-1', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c1', criterionName: 'Annual Turnover', extractedValue: '₹5.1 Cr (avg last 3 FY)', decision: 'Eligible', confidence: 0.82, sourceDocument: 'Turnover.pdf', explanation: "Average turnover ₹5.1 Cr marginally meets the ₹5 Cr threshold. FY 2023-24 shows ₹4.6 Cr which is below threshold — average calculation needs manual verification." },
  { id: 'e4-2', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c2', criterionName: 'GST Registration', extractedValue: 'GSTIN: 33AABCV3456D1ZR, Valid', decision: 'Eligible', confidence: 0.97, sourceDocument: 'GST.pdf', explanation: "Valid GST registration. GSTIN 33AABCV3456D1ZR is active." },
  { id: 'e4-3', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c3', criterionName: 'ISO 9001 Certification', extractedValue: 'ISO 9001:2015, Expired Feb 2026', decision: 'Review', confidence: 0.75, sourceDocument: 'N/A', explanation: "ISO 9001:2015 certificate found but expired in February 2026. Renewal status unknown. Manual review required to check if renewal is in process." },
  { id: 'e4-4', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c4', criterionName: 'Experience Certificate', extractedValue: '3 similar works in last 7 years', decision: 'Eligible', confidence: 0.78, sourceDocument: 'N/A', explanation: "3 similar works found, meeting the minimum requirement. However, one work from 2019 is at the 7-year boundary — eligibility may need verification." },
  { id: 'e4-5', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c5', criterionName: 'EMD Submission', extractedValue: '₹1,50,000 via DD', decision: 'Not Eligible', confidence: 0.94, sourceDocument: 'EMD.pdf', explanation: "EMD submitted is ₹1,50,000, which is ₹50,000 short of the required ₹2,00,000. Mandatory criterion not met." },
  { id: 'e4-6', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c6', criterionName: 'PAN Verification', extractedValue: 'AABCV3456D, Valid', decision: 'Eligible', confidence: 0.96, sourceDocument: 'PAN.pdf', explanation: "PAN AABCV3456D verified. Name matches." },
  { id: 'e4-7', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c7', criterionName: 'Solvency Certificate', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.5, sourceDocument: 'N/A', explanation: "Solvency certificate not found. Optional criterion." },
  { id: 'e4-8', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c8', criterionName: 'MSME Registration', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.5, sourceDocument: 'N/A', explanation: "MSME registration not found. Optional criterion." },
  { id: 'e4-9', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c9', criterionName: 'Technical Proposal', extractedValue: 'Partial — 18 pages, methodology incomplete', decision: 'Review', confidence: 0.65, sourceDocument: 'Proposal.pdf', explanation: "Technical proposal is only 18 pages with incomplete methodology section. Risk assessment and quality plan sections are missing. Needs manual review." },
  { id: 'e4-10', bidderId: 'b4', bidderName: 'Vijay Tactical Equipment Co.', criterionId: 'c10', criterionName: 'Power of Attorney', extractedValue: 'Not submitted', decision: 'Review', confidence: 0.5, sourceDocument: 'N/A', explanation: "Power of Attorney not found. Optional criterion." },

  // Garuda Security Systems
  { id: 'e5-1', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c1', criterionName: 'Annual Turnover', extractedValue: '₹7.8 Cr (avg last 3 FY)', decision: 'Eligible', confidence: 0.96, sourceDocument: 'Turnover_Sheets.pdf', explanation: "Average annual turnover ₹7.8 Cr exceeds the ₹5 Cr threshold. Consistent growth across all 3 financial years." },
  { id: 'e5-2', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c2', criterionName: 'GST Registration', extractedValue: 'GSTIN: 06AABCG7890E1ZS, Valid', decision: 'Eligible', confidence: 0.98, sourceDocument: 'GST_Certificate.pdf', explanation: "Valid GST registration. GSTIN 06AABCG7890E1ZS is active." },
  { id: 'e5-3', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c3', criterionName: 'ISO 9001 Certification', extractedValue: 'ISO 9001:2015, Valid till Sep 2027', decision: 'Eligible', confidence: 0.93, sourceDocument: 'ISO_Cert.pdf', explanation: "ISO 9001:2015 certification valid until September 2027. Issued by DNV GL." },
  { id: 'e5-4', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c4', criterionName: 'Experience Certificate', extractedValue: '4 similar works in last 7 years', decision: 'Eligible', confidence: 0.9, sourceDocument: 'Exp_Certificates.pdf', explanation: "4 similar works completed: CRPF Surveillance System (2021), BSF Communication Network (2022), CISF Perimeter Security (2023), ITBP Equipment Supply (2024)." },
  { id: 'e5-5', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c5', criterionName: 'EMD Submission', extractedValue: '₹2,00,000 via DD No. 456123', decision: 'Eligible', confidence: 0.96, sourceDocument: 'EMD_Receipt.pdf', explanation: "EMD of ₹2,00,000 submitted via Demand Draft No. 456123 dated 29-Apr-2026." },
  { id: 'e5-6', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c6', criterionName: 'PAN Verification', extractedValue: 'AABCG7890E, Valid', decision: 'Eligible', confidence: 0.97, sourceDocument: 'PAN_Card.pdf', explanation: "PAN AABCG7890E verified. Name matches." },
  { id: 'e5-7', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c7', criterionName: 'Solvency Certificate', extractedValue: '₹12 Cr solvency, Valid till Aug 2026', decision: 'Eligible', confidence: 0.9, sourceDocument: 'N/A', explanation: "Solvency certificate from ICICI Bank showing ₹12 Cr solvency. Valid until August 2026." },
  { id: 'e5-8', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c8', criterionName: 'MSME Registration', extractedValue: 'Udyam Reg: UDYAM-06-02-0034567', decision: 'Eligible', confidence: 0.88, sourceDocument: 'MSME_Registration.pdf', explanation: "MSME/Udyam registration found. Category: Small Enterprise. Preference benefits applicable." },
  { id: 'e5-9', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c9', criterionName: 'Technical Proposal', extractedValue: 'Complete — 48 pages, detailed', decision: 'Eligible', confidence: 0.93, sourceDocument: 'Tech_Proposal.pdf', explanation: "Comprehensive 48-page technical proposal with detailed methodology, risk assessment, and quality assurance plan." },
  { id: 'e5-10', bidderId: 'b5', bidderName: 'Garuda Security Systems Pvt. Ltd.', criterionId: 'c10', criterionName: 'Power of Attorney', extractedValue: 'Valid PoA for Director Mr. R.K. Sharma', decision: 'Eligible', confidence: 0.87, sourceDocument: 'PoA.pdf', explanation: "Power of Attorney found, authorizing Director Mr. R.K. Sharma to sign on behalf of the company. Notarized and valid." },
];

export const MOCK_TENDER: Tender = {
  id: 't1',
  title: 'Supply and Installation of Integrated Surveillance System for CRPF Camps — Phase III',
  referenceNo: 'CRPF/PROC/2026/SS-III/001',
  status: 'Completed',
  uploadedAt: '2026-04-27T09:00:00Z',
  criteria: CRITERIA,
  bidders: BIDDERS,
  evaluations: EVALUATIONS,
};

export const MOCK_TENDERS: Tender[] = [
  MOCK_TENDER,
  {
    id: 't2',
    title: 'Procurement of Body Armour and Protective Equipment for CRPF Personnel',
    referenceNo: 'CRPF/PROC/2026/BA-IV/002',
    status: 'Evaluating',
    uploadedAt: '2026-05-01T10:00:00Z',
    criteria: CRITERIA.slice(0, 6),
    bidders: BIDDERS.slice(0, 3),
    evaluations: EVALUATIONS.filter(e => ['b1', 'b2', 'b3'].includes(e.bidderId)),
  },
  {
    id: 't3',
    title: 'Construction of Barrack Buildings at CRPF Group Centre, Hyderabad',
    referenceNo: 'CRPF/PROC/2026/BLD/003',
    status: 'Parsed',
    uploadedAt: '2026-05-03T14:30:00Z',
    criteria: CRITERIA.slice(0, 4),
    bidders: [],
    evaluations: [],
  },
];

export const MOCK_ACTIVITY: ActivityLog[] = [
  { id: 'a1', action: 'Tender document uploaded', user: 'Sh. A.K. Verma', timestamp: '2026-04-27T09:00:00Z', tenderRef: 'CRPF/PROC/2026/SS-III/001', details: 'Tender document uploaded and parsing initiated.' },
  { id: 'a2', action: 'Criteria extraction completed', user: 'System', timestamp: '2026-04-27T09:05:00Z', tenderRef: 'CRPF/PROC/2026/SS-III/001', details: '10 criteria extracted — 7 mandatory, 3 optional.' },
  { id: 'a3', action: 'Bidder documents uploaded', user: 'Sh. A.K. Verma', timestamp: '2026-04-28T10:30:00Z', tenderRef: 'CRPF/PROC/2026/SS-III/001', details: 'Bharat Defence Systems — 8 files uploaded.' },
  { id: 'a4', action: 'Bidder documents uploaded', user: 'Sh. A.K. Verma', timestamp: '2026-04-28T11:15:00Z', tenderRef: 'CRPF/PROC/2026/SS-III/001', details: 'Shakti Engineering Works — 7 files uploaded.' },
  { id: 'a5', action: 'AI Evaluation completed', user: 'System', timestamp: '2026-04-30T16:00:00Z', tenderRef: 'CRPF/PROC/2026/SS-III/001', details: 'All 5 bidders evaluated. 2 bidders fully eligible, 1 partially eligible, 2 need review.' },
  { id: 'a6', action: 'Manual review completed', user: 'Smt. P. Devi', timestamp: '2026-05-01T11:00:00Z', tenderRef: 'CRPF/PROC/2026/SS-III/001', details: 'Reviewed Vijay Tactical Equipment — EDM shortfall confirmed.' },
  { id: 'a7', action: 'Tender document uploaded', user: 'Sh. A.K. Verma', timestamp: '2026-05-01T10:00:00Z', tenderRef: 'CRPF/PROC/2026/BA-IV/002', details: 'Body Armour tender uploaded.' },
  { id: 'a8', action: 'Tender document uploaded', user: 'Sh. R. Kumar', timestamp: '2026-05-03T14:30:00Z', tenderRef: 'CRPF/PROC/2026/BLD/003', details: 'Barrack construction tender uploaded.' },
];

export const MOCK_TIMELINE: TimelineStep[] = [
  { id: 'ts1', label: 'Tender Uploaded', status: 'completed', timestamp: '2026-04-27 09:00' },
  { id: 'ts2', label: 'Criteria Extracted', status: 'completed', timestamp: '2026-04-27 09:05' },
  { id: 'ts3', label: 'Bidder Documents Collected', status: 'completed', timestamp: '2026-04-30 08:45' },
  { id: 'ts4', label: 'AI Evaluation Running', status: 'completed', timestamp: '2026-04-30 16:00' },
  { id: 'ts5', label: 'Manual Review', status: 'current', timestamp: '2026-05-01 11:00' },
  { id: 'ts6', label: 'Final Report', status: 'pending' },
];
