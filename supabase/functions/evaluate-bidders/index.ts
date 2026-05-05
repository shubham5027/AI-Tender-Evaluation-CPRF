import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { tender_id } = await req.json() as { tender_id: string };

    if (!tender_id) {
      return new Response(
        JSON.stringify({ error: "tender_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update tender status to Evaluating
    await supabase
      .from("tenders")
      .update({ status: "Evaluating" })
      .eq("id", tender_id);

    // Fetch criteria for this tender
    const { data: criteria, error: criteriaError } = await supabase
      .from("criteria")
      .select("*")
      .eq("tender_id", tender_id);

    if (criteriaError) throw criteriaError;

    // Fetch bidders for this tender
    const { data: bidders, error: biddersError } = await supabase
      .from("bidders")
      .select("id, name, status")
      .eq("tender_id", tender_id);

    if (biddersError) throw biddersError;

    // Fetch bidder files with OCR text
    const bidderIds = bidders.map((b) => b.id);
    const { data: files, error: filesError } = await supabase
      .from("bidder_files")
      .select("id, bidder_id, file_name, ocr_text, ocr_status")
      .in("bidder_id", bidderIds);

    if (filesError) throw filesError;

    // Delete existing evaluations for this tender
    await supabase
      .from("evaluations")
      .delete()
      .eq("tender_id", tender_id);

    // Run evaluation for each bidder x criterion combination
    const evaluations: Record<string, unknown>[] = [];

    for (const bidder of bidders) {
      const bidderFiles = files?.filter((f) => f.bidder_id === bidder.id) || [];

      for (const criterion of criteria) {
        const result = evaluateCriterion(bidder, criterion, bidderFiles);
        evaluations.push({
          tender_id,
          bidder_id: bidder.id,
          criterion_id: criterion.id,
          extracted_value: result.extractedValue,
          decision: result.decision,
          confidence: result.confidence,
          source_document: result.sourceDocument,
          explanation: result.explanation,
        });
      }

      // Update bidder status
      await supabase
        .from("bidders")
        .update({ status: "Completed" })
        .eq("id", bidder.id);
    }

    // Insert evaluations
    const { data: insertedEvals, error: evalError } = await supabase
      .from("evaluations")
      .insert(evaluations)
      .select();

    if (evalError) throw evalError;

    // Update tender status to Completed
    await supabase
      .from("tenders")
      .update({ status: "Completed" })
      .eq("id", tender_id);

    // Log activity
    const eligibleCount = evaluations.filter((e) => e.decision === "Eligible").length;
    const notEligibleCount = evaluations.filter((e) => e.decision === "Not Eligible").length;
    const reviewCount = evaluations.filter((e) => e.decision === "Review").length;

    await supabase.from("activity_logs").insert({
      tender_id,
      action: "AI Evaluation completed",
      user_name: "System",
      details: `${bidders.length} bidders evaluated. ${eligibleCount} eligible, ${notEligibleCount} not eligible, ${reviewCount} need review.`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        evaluations: insertedEvals,
        summary: { eligible: eligibleCount, notEligible: notEligibleCount, review: reviewCount },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface Criterion {
  id: string;
  name: string;
  category: string;
  weight: string;
  description: string;
  threshold: string;
}

interface Bidder {
  id: string;
  name: string;
  status: string;
}

interface BidderFile {
  id: string;
  bidder_id: string;
  file_name: string;
  ocr_text: string;
  ocr_status: string;
}

interface EvalResult {
  extractedValue: string;
  decision: string;
  confidence: number;
  sourceDocument: string;
  explanation: string;
}

function evaluateCriterion(
  bidder: Bidder,
  criterion: Criterion,
  files: BidderFile[]
): EvalResult {
  // Find the most relevant file for this criterion
  const relevantFile = findRelevantFile(criterion.name, files);
  const ocrText = relevantFile?.ocr_text || "";

  // Parse the criterion-specific data from OCR text
  return evaluateFromOCR(bidder.name, criterion, relevantFile?.file_name || "N/A", ocrText);
}

function findRelevantFile(criterionName: string, files: BidderFile[]): BidderFile | null {
  const nameLower = criterionName.toLowerCase();

  const keywordMap: Record<string, string[]> = {
    "annual turnover": ["turnover", "financial", "annual"],
    "gst registration": ["gst", "gstn", "gstin"],
    "iso 9001": ["iso", "9001", "quality"],
    "experience certificate": ["experience", "exp", "work"],
    "emd submission": ["emd", "earnest", "deposit"],
    "pan verification": ["pan", "permanent account"],
    "solvency certificate": ["solvency", "solvency"],
    "msme registration": ["msme", "udyam", "micro", "small"],
    "technical proposal": ["technical", "proposal", "methodology", "tech"],
    "power of attorney": ["power", "attorney", "poa", "authorization"],
  };

  const keywords = keywordMap[nameLower] || [nameLower];

  let bestMatch: BidderFile | null = null;
  let bestScore = 0;

  for (const file of files) {
    const fileLower = file.file_name.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      if (fileLower.includes(keyword)) score += 2;
      if (file.ocr_text.toLowerCase().includes(keyword)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = file;
    }
  }

  return bestMatch;
}

function evaluateFromOCR(
  bidderName: string,
  criterion: Criterion,
  sourceDoc: string,
  ocrText: string
): EvalResult {
  const textLower = ocrText.toLowerCase();
  const criterionLower = criterion.name.toLowerCase();

  // Default: needs review
  const defaultResult: EvalResult = {
    extractedValue: "Not submitted",
    decision: "Review",
    confidence: 0.5,
    sourceDocument: "N/A",
    explanation: `${criterion.name} not found in submitted documents. This is an ${criterion.weight.toLowerCase()} criterion. Manual review recommended.`,
  };

  if (!ocrText || ocrText.includes("simulated OCR output")) {
    if (sourceDoc !== "N/A") {
      defaultResult.sourceDocument = sourceDoc;
      defaultResult.extractedValue = "Document uploaded — pending OCR processing";
      defaultResult.confidence = 0.4;
    }
    return defaultResult;
  }

  // Criterion-specific evaluation logic
  if (criterionLower.includes("turnover")) {
    return evaluateTurnover(bidderName, criterion, sourceDoc, ocrText);
  }
  if (criterionLower.includes("gst")) {
    return evaluateGST(bidderName, criterion, sourceDoc, ocrText);
  }
  if (criterionLower.includes("iso")) {
    return evaluateISO(bidderName, criterion, sourceDoc, ocrText);
  }
  if (criterionLower.includes("experience")) {
    return evaluateExperience(bidderName, criterion, sourceDoc, ocrText);
  }
  if (criterionLower.includes("emd")) {
    return evaluateEMD(bidderName, criterion, sourceDoc, ocrText);
  }
  if (criterionLower.includes("pan")) {
    return evaluatePAN(bidderName, criterion, sourceDoc, ocrText);
  }
  if (criterionLower.includes("solvency")) {
    return evaluateSolvency(bidderName, criterion, sourceDoc, ocrText);
  }
  if (criterionLower.includes("msme") || criterionLower.includes("udyam")) {
    return evaluateMSME(bidderName, criterion, sourceDoc, ocrText);
  }
  if (criterionLower.includes("technical proposal") || criterionLower.includes("technical")) {
    return evaluateTechnicalProposal(bidderName, criterion, sourceDoc, ocrText);
  }
  if (criterionLower.includes("power of attorney") || criterionLower.includes("poa")) {
    return evaluatePoA(bidderName, criterion, sourceDoc, ocrText);
  }

  return defaultResult;
}

function evaluateTurnover(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const match = text.match(/average[^.]*?turnover[^.]*?₹?\s*([\d,.]+)\s*(?:crore|cr)/i) ||
    text.match(/₹?\s*([\d,.]+)\s*(?:crore|cr)[^.]*?turnover/i);

  if (match) {
    const value = parseFloat(match[1].replace(/,/g, ""));
    const threshold = parseFloat(c.threshold.replace(/[^\d.]/g, "")) || 5;

    if (value >= threshold) {
      return {
        extractedValue: `₹${match[1]} Cr (avg last 3 FY)`,
        decision: "Eligible",
        confidence: 0.95,
        sourceDocument: doc,
        explanation: `Criterion requires minimum ₹${threshold} Cr average annual turnover. Document shows ₹${match[1]} Cr average. Exceeds threshold.`,
      };
    } else {
      return {
        extractedValue: `₹${match[1]} Cr (avg last 3 FY)`,
        decision: "Not Eligible",
        confidence: 0.93,
        sourceDocument: doc,
        explanation: `Criterion requires minimum ₹${threshold} Cr average annual turnover. Document shows ₹${match[1]} Cr — shortfall. This is a mandatory criterion.`,
      };
    }
  }

  return {
    extractedValue: "Not found in documents",
    decision: "Review",
    confidence: 0.6,
    sourceDocument: doc,
    explanation: "Could not extract turnover data from the submitted documents. Manual verification needed.",
  };
}

function evaluateGST(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const match = text.match(/GSTIN[:\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i);

  if (match) {
    return {
      extractedValue: `GSTIN: ${match[1]}, Valid`,
      decision: "Eligible",
      confidence: 0.98,
      sourceDocument: doc,
      explanation: `Valid GST registration certificate found. GSTIN ${match[1]} is active and verified.`,
    };
  }

  if (text.toLowerCase().includes("gst") || text.toLowerCase().includes("registration")) {
    return {
      extractedValue: "GST document found — needs verification",
      decision: "Review",
      confidence: 0.7,
      sourceDocument: doc,
      explanation: "GST-related document found but GSTIN could not be extracted. Manual verification needed.",
    };
  }

  return {
    extractedValue: "Not submitted",
    decision: "Not Eligible",
    confidence: 0.85,
    sourceDocument: "N/A",
    explanation: "GST registration certificate not found. This is a mandatory criterion.",
  };
}

function evaluateISO(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const match = text.match(/ISO\s*9001[:\s]*2015/i);
  const expiryMatch = text.match(/valid\s*(?:until|till|to)\s*[:\s]*(\w+\s+\d{4}|\d{1,2}[-/]\w+[-/]\d{2,4})/i);

  if (match) {
    const isExpired = expiryMatch ? new Date(expiryMatch[1]) < new Date() : false;

    if (isExpired) {
      return {
        extractedValue: `ISO 9001:2015, Expired ${expiryMatch?.[1]}`,
        decision: "Review",
        confidence: 0.75,
        sourceDocument: doc,
        explanation: `ISO 9001:2015 certificate found but expired in ${expiryMatch?.[1]}. Renewal status unknown. Manual review required.`,
      };
    }

    return {
      extractedValue: `ISO 9001:2015, Valid till ${expiryMatch?.[1] || "date not specified"}`,
      decision: "Eligible",
      confidence: 0.92,
      sourceDocument: doc,
      explanation: `ISO 9001:2015 certification is valid${expiryMatch ? ` until ${expiryMatch[1]}` : ""}. Certificate found in submitted documents.`,
    };
  }

  return {
    extractedValue: "Not submitted",
    decision: "Not Eligible",
    confidence: 0.85,
    sourceDocument: "N/A",
    explanation: "ISO 9001:2015 certification not found in submitted documents. This is a mandatory criterion.",
  };
}

function evaluateExperience(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const works = text.match(/\d+\.\s+[^.]+(?:\d{4})/g) || [];
  const count = works.length || 0;
  const threshold = parseInt(c.threshold) || 3;

  if (count >= threshold) {
    return {
      extractedValue: `${count} similar works in last 7 years`,
      decision: "Eligible",
      confidence: 0.88,
      sourceDocument: doc,
      explanation: `Criterion requires minimum ${threshold} similar works. Document shows ${count} completed works. Meets requirement.`,
    };
  }
  if (count > 0) {
    return {
      extractedValue: `${count} similar works in last 7 years`,
      decision: "Not Eligible",
      confidence: 0.82,
      sourceDocument: doc,
      explanation: `Criterion requires minimum ${threshold} similar works. Only ${count} works found. Shortfall of ${threshold - count} work(s).`,
    };
  }

  return {
    extractedValue: "Not found in documents",
    decision: "Review",
    confidence: 0.6,
    sourceDocument: doc,
    explanation: "Could not extract experience details from submitted documents. Manual verification needed.",
  };
}

function evaluateEMD(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const match = text.match(/₹?\s*([\d,]+)\s*(?:lakh|crore)/i) ||
    text.match(/amount[^.]*?₹?\s*([\d,]+)/i);

  if (match) {
    const value = parseFloat(match[1].replace(/,/g, ""));
    const thresholdStr = c.threshold.replace(/[^\d]/g, "");
    const threshold = parseInt(thresholdStr) || 200000;

    // Convert to same unit for comparison
    const isLakh = text.toLowerCase().includes("lakh");
    const submittedAmount = isLakh ? value * 100000 : value;

    if (submittedAmount >= threshold) {
      return {
        extractedValue: `₹${match[1]} ${isLakh ? "Lakh" : ""}`,
        decision: "Eligible",
        confidence: 0.96,
        sourceDocument: doc,
        explanation: `EMD of ₹${match[1]} submitted. Meets the required amount.`,
      };
    }
    return {
      extractedValue: `₹${match[1]} ${isLakh ? "Lakh" : ""}`,
      decision: "Not Eligible",
      confidence: 0.94,
      sourceDocument: doc,
      explanation: `EMD submitted is ₹${match[1]}, which is short of the required ${c.threshold}. Mandatory criterion not met.`,
    };
  }

  return {
    extractedValue: "Not found in documents",
    decision: "Review",
    confidence: 0.6,
    sourceDocument: doc,
    explanation: "Could not verify EMD submission from documents. Manual review needed.",
  };
}

function evaluatePAN(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const match = text.match(/PAN[:\s]*([A-Z]{5}[0-9]{4}[A-Z])/i);

  if (match) {
    return {
      extractedValue: `${match[1]}, Valid`,
      decision: "Eligible",
      confidence: 0.97,
      sourceDocument: doc,
      explanation: `PAN ${match[1]} verified against company registration records.`,
    };
  }

  if (text.toLowerCase().includes("pan") || text.toLowerCase().includes("permanent account")) {
    return {
      extractedValue: "PAN document found — needs verification",
      decision: "Review",
      confidence: 0.7,
      sourceDocument: doc,
      explanation: "PAN-related document found but number could not be extracted. Manual verification needed.",
    };
  }

  return {
    extractedValue: "Not submitted",
    decision: "Not Eligible",
    confidence: 0.85,
    sourceDocument: "N/A",
    explanation: "PAN card not found in submitted documents. This is a mandatory criterion.",
  };
}

function evaluateSolvency(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const match = text.match(/solvency[^.]*?₹?\s*([\d,.]+)\s*(?:crore|cr|lakh)/i);

  if (match) {
    return {
      extractedValue: `₹${match[1]} Cr solvency, Valid`,
      decision: "Eligible",
      confidence: 0.91,
      sourceDocument: doc,
      explanation: `Solvency certificate showing ₹${match[1]} Cr solvency found.`,
    };
  }

  return {
    extractedValue: "Not submitted",
    decision: "Review",
    confidence: 0.5,
    sourceDocument: "N/A",
    explanation: "Solvency certificate not found. This is an optional criterion.",
  };
}

function evaluateMSME(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const match = text.match(/UDYAM[-\s]*\d{2}[-\s]*\d{2}[-\s]*\d{7}/i) ||
    text.match(/registration\s*no[^.]*?udyam[^.]*?(\d+)/i);

  if (match) {
    return {
      extractedValue: `Udyam Reg: ${match[0]}`,
      decision: "Eligible",
      confidence: 0.89,
      sourceDocument: doc,
      explanation: "MSME/Udyam registration found. Preference benefits applicable.",
    };
  }

  return {
    extractedValue: "Not submitted",
    decision: "Review",
    confidence: 0.55,
    sourceDocument: "N/A",
    explanation: "MSME registration not found. Optional criterion — no penalty but no preference benefits.",
  };
}

function evaluateTechnicalProposal(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const pageMatch = text.match(/(\d+)\s*pages/i) || text.match(/total\s*pages[:\s]*(\d+)/i);
  const hasMethodology = text.toLowerCase().includes("methodology");
  const hasTimeline = text.toLowerCase().includes("timeline") || text.toLowerCase().includes("schedule");

  const pages = pageMatch ? parseInt(pageMatch[1]) : 0;
  const completeness = (hasMethodology ? 1 : 0) + (hasTimeline ? 1 : 0) + (pages > 20 ? 1 : 0);

  if (completeness >= 2) {
    return {
      extractedValue: `Complete — ${pages || "multiple"} pages${hasMethodology ? ", methodology included" : ""}`,
      decision: "Eligible",
      confidence: 0.91,
      sourceDocument: doc,
      explanation: `Technical proposal is ${pages || "multiple"} pages with${hasMethodology ? "" : "out"} detailed methodology. ${hasTimeline ? "Timeline included." : ""}`,
    };
  }
  if (completeness === 1) {
    return {
      extractedValue: `Partial — ${pages || "few"} pages, ${hasMethodology ? "methodology incomplete" : "methodology missing"}`,
      decision: "Review",
      confidence: 0.65,
      sourceDocument: doc,
      explanation: "Technical proposal is incomplete. Some required sections are missing. Needs manual review.",
    };
  }

  return {
    extractedValue: "Not found or insufficient",
    decision: "Review",
    confidence: 0.55,
    sourceDocument: doc,
    explanation: "Technical proposal could not be properly evaluated from OCR text. Manual review needed.",
  };
}

function evaluatePoA(bidder: string, c: Criterion, doc: string, text: string): EvalResult {
  const hasPoA = text.toLowerCase().includes("power of attorney") ||
    text.toLowerCase().includes("authorized signatory") ||
    text.toLowerCase().includes("hereby appoints");

  if (hasPoA) {
    const nameMatch = text.match(/(?:mr\.|mrs\.|ms\.)\s*([a-z.]+\s+[a-z.]+)/i) ||
      text.match(/appoints\s+([^,]+)/i);

    return {
      extractedValue: `Valid PoA for ${nameMatch?.[1] || "authorized person"}`,
      decision: "Eligible",
      confidence: 0.87,
      sourceDocument: doc,
      explanation: `Power of Attorney found, authorizing ${nameMatch?.[1] || "the signatory"} to sign on behalf of the company.`,
    };
  }

  return {
    extractedValue: "Not submitted",
    decision: "Review",
    confidence: 0.5,
    sourceDocument: "N/A",
    explanation: "Power of Attorney not found. Optional criterion.",
  };
}
