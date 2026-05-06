import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Tender } from '../types';

export interface EvaluationSummary {
  bidderName: string;
  totalCriteria: number;
  eligibleCount: number;
  notEligibleCount: number;
  reviewCount: number;
  mandatoryCriteria: number;
  mandatoryEligible: number;
  optionalCriteria: number;
  optionalEligible: number;
  overallStatus: 'Eligible' | 'Not Eligible' | 'Review';
}

function getEvaluationSummaries(
  tender: Tender
): EvaluationSummary[] {
  const bidders = tender.bidders;
  const evaluations = tender.evaluations;
  const criteria = tender.criteria;

  return bidders.map((bidder) => {
    const bidderEvals = evaluations.filter((e) => e.bidderId === bidder.id);
    const eligibleCount = bidderEvals.filter((e) => e.decision === 'Eligible').length;
    const notEligibleCount = bidderEvals.filter((e) => e.decision === 'Not Eligible').length;
    const reviewCount = bidderEvals.filter((e) => e.decision === 'Review').length;

    const mandatoryCriteria = criteria.filter((c) => c.weight === 'Mandatory').length;
    const mandatoryEvals = bidderEvals.filter((e) => {
      const criterion = criteria.find((c) => c.id === e.criterionId);
      return criterion?.weight === 'Mandatory';
    });
    const mandatoryEligible = mandatoryEvals.filter((e) => e.decision === 'Eligible').length;

    const optionalCriteria = criteria.filter((c) => c.weight === 'Optional').length;
    const optionalEvals = bidderEvals.filter((e) => {
      const criterion = criteria.find((c) => c.id === e.criterionId);
      return criterion?.weight === 'Optional';
    });
    const optionalEligible = optionalEvals.filter((e) => e.decision === 'Eligible').length;

    const overallStatus: 'Eligible' | 'Not Eligible' | 'Review' =
      notEligibleCount > 0 ? 'Not Eligible' : reviewCount > 0 ? 'Review' : 'Eligible';

    return {
      bidderName: bidder.name,
      totalCriteria: bidderEvals.length,
      eligibleCount,
      notEligibleCount,
      reviewCount,
      mandatoryCriteria,
      mandatoryEligible,
      optionalCriteria,
      optionalEligible,
      overallStatus,
    };
  });
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateString;
  }
}

export async function generatePDFReport(tender: Tender): Promise<void> {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 15;

  // Header
  pdf.setFontSize(20);
  pdf.text('Tender Evaluation Report', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`Generated on ${formatDate(new Date().toISOString())}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // Tender Details
  pdf.setDrawColor(200);
  pdf.line(10, yPosition, pageWidth - 10, yPosition);
  yPosition += 6;

  pdf.setTextColor(0);
  pdf.setFontSize(12);
  pdf.text('Tender Details', 12, yPosition);
  yPosition += 7;

  pdf.setFontSize(10);
  pdf.text(`Title: ${tender.title}`, 15, yPosition);
  yPosition += 5;
  pdf.text(`Reference: ${tender.referenceNo}`, 15, yPosition);
  yPosition += 5;
  pdf.text(`Status: ${tender.status}`, 15, yPosition);
  yPosition += 5;
  pdf.text(`Uploaded: ${formatDate(tender.uploadedAt)}`, 15, yPosition);
  yPosition += 10;

  // Summary Statistics
  pdf.setFontSize(12);
  pdf.text('Summary Statistics', 12, yPosition);
  yPosition += 7;

  const summaries = getEvaluationSummaries(tender);
  const totalEligible = summaries.reduce((sum, s) => sum + (s.overallStatus === 'Eligible' ? 1 : 0), 0);
  const totalNotEligible = summaries.reduce((sum, s) => sum + (s.overallStatus === 'Not Eligible' ? 1 : 0), 0);
  const totalReview = summaries.reduce((sum, s) => sum + (s.overallStatus === 'Review' ? 1 : 0), 0);

  pdf.setFontSize(10);
  pdf.text(`Total Bidders Evaluated: ${tender.bidders.length}`, 15, yPosition);
  yPosition += 5;
  pdf.text(`Total Criteria: ${tender.criteria.length}`, 15, yPosition);
  yPosition += 5;
  pdf.text(`Eligible Bidders: ${totalEligible}`, 15, yPosition);
  yPosition += 5;
  pdf.text(`Not Eligible Bidders: ${totalNotEligible}`, 15, yPosition);
  yPosition += 5;
  pdf.text(`Bidders Flagged for Review: ${totalReview}`, 15, yPosition);
  yPosition += 10;

  // Bidder Summary Table
  pdf.setFontSize(12);
  pdf.text('Bidder Evaluation Summary', 12, yPosition);
  yPosition += 7;

  pdf.setFontSize(9);
  const tableHeaders = ['Bidder', 'Status', 'Mandatory', 'Optional', 'Review'];
  const tableRows = summaries.map((s) => [
    s.bidderName.length > 25 ? s.bidderName.substring(0, 22) + '...' : s.bidderName,
    s.overallStatus,
    `${s.mandatoryEligible}/${s.mandatoryCriteria}`,
    `${s.optionalEligible}/${s.optionalCriteria}`,
    s.reviewCount.toString(),
  ]);

  const startY = yPosition;
  const tableWidth = pageWidth - 20;
  const colWidth = tableWidth / tableHeaders.length;
  const rowHeight = 6;

  // Header row
  pdf.setFillColor(41, 128, 185);
  pdf.setTextColor(255, 255, 255);
  tableHeaders.forEach((header, idx) => {
    pdf.rect(10 + idx * colWidth, startY, colWidth, rowHeight, 'F');
    pdf.text(header, 10 + idx * colWidth + 2, startY + 4, { maxWidth: colWidth - 4 });
  });

  // Data rows
  pdf.setTextColor(0, 0, 0);
  tableRows.forEach((row, rowIdx) => {
    const rowY = startY + (rowIdx + 1) * rowHeight;
    if (rowY > pageHeight - 20) {
      pdf.addPage();
      yPosition = 15;
    }
    row.forEach((cell, colIdx) => {
      if (rowIdx % 2 === 0) {
        pdf.setFillColor(240, 240, 240);
        pdf.rect(10 + colIdx * colWidth, rowY, colWidth, rowHeight, 'F');
      }
      pdf.text(cell, 10 + colIdx * colWidth + 2, rowY + 4, { maxWidth: colWidth - 4 });
    });
  });

  yPosition = startY + (tableRows.length + 1) * rowHeight + 5;

  // Detailed Evaluation Results (if needed)
  const notEligibleAndReview = tender.evaluations.filter(
    (e) => e.decision === 'Not Eligible' || e.decision === 'Review'
  );

  if (notEligibleAndReview.length > 0) {
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = 15;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text('Items Requiring Attention', 12, yPosition);
    yPosition += 7;

    pdf.setFontSize(9);
    notEligibleAndReview.slice(0, 10).forEach((eval_item) => {
      if (yPosition > pageHeight - 15) {
        pdf.addPage();
        yPosition = 15;
      }

      const bidder = tender.bidders.find((b) => b.id === eval_item.bidderId);
      const criterion = tender.criteria.find((c) => c.id === eval_item.criterionId);
      const statusColor: [number, number, number] =
        eval_item.decision === 'Not Eligible' ? [192, 0, 0] : [192, 128, 0];

      pdf.setTextColor(...statusColor);
      pdf.text(`${eval_item.decision.toUpperCase()}: ${bidder?.name} - ${criterion?.name}`, 15, yPosition);
      yPosition += 5;

      pdf.setTextColor(100);
      pdf.text(`Extracted: ${eval_item.extractedValue}`, 18, yPosition, { maxWidth: pageWidth - 26 });
      yPosition += 5;
      pdf.text(`Explanation: ${eval_item.explanation.substring(0, 80)}...`, 18, yPosition, { maxWidth: pageWidth - 26 });
      yPosition += 6;
    });
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(150);
  pdf.text(
    `Page ${pdf.internal.pages.length - 1}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save PDF
  const filename = `${tender.referenceNo || 'Tender'}_Evaluation_Report_${formatDate(new Date().toISOString()).replace(/\s/g, '_')}.pdf`;
  pdf.save(filename);
}

export async function generateHTMLPDF(htmlElement: HTMLElement, filename: string): Promise<void> {
  try {
    const canvas = await html2canvas(htmlElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'l' : 'p',
      unit: 'mm',
      format: [canvas.width, canvas.height],
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
}
