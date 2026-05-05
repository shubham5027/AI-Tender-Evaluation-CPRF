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

    // Check if data already exists
    const { data: existing } = await supabase
      .from("tenders")
      .select("id")
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Data already exists. Delete existing data first if you want to re-seed." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create tenders
    const { data: tenders, error: tenderError } = await supabase
      .from("tenders")
      .insert([
        {
          title: "Supply and Installation of Integrated Surveillance System for CRPF Camps — Phase III",
          reference_no: "CRPF/PROC/2026/SS-III/001",
          status: "Completed",
        },
        {
          title: "Procurement of Body Armour and Protective Equipment for CRPF Personnel",
          reference_no: "CRPF/PROC/2026/BA-IV/002",
          status: "Evaluating",
        },
        {
          title: "Construction of Barrack Buildings at CRPF Group Centre, Hyderabad",
          reference_no: "CRPF/PROC/2026/BLD/003",
          status: "Parsed",
        },
      ])
      .select();

    if (tenderError) throw tenderError;

    const tender1Id = tenders[0].id;
    const tender2Id = tenders[1].id;
    const tender3Id = tenders[2].id;

    // Create criteria for tender 1
    const { data: criteria1, error: c1Error } = await supabase
      .from("criteria")
      .insert([
        { tender_id: tender1Id, name: "Annual Turnover", category: "Financial", weight: "Mandatory", description: "Minimum average annual turnover of ₹5 Crore for the last 3 financial years", threshold: "₹5 Cr" },
        { tender_id: tender1Id, name: "GST Registration", category: "Compliance", weight: "Mandatory", description: "Valid GST registration certificate", threshold: "Valid" },
        { tender_id: tender1Id, name: "ISO 9001 Certification", category: "Technical", weight: "Mandatory", description: "ISO 9001:2015 certification for quality management", threshold: "Valid" },
        { tender_id: tender1Id, name: "Experience Certificate", category: "Technical", weight: "Mandatory", description: "Minimum 3 similar works executed in last 7 years", threshold: "3 works" },
        { tender_id: tender1Id, name: "EMD Submission", category: "Financial", weight: "Mandatory", description: "Earnest Money Deposit of ₹2 Lakh", threshold: "₹2 Lakh" },
        { tender_id: tender1Id, name: "PAN Verification", category: "Compliance", weight: "Mandatory", description: "Valid PAN card of the bidding entity", threshold: "Valid" },
        { tender_id: tender1Id, name: "Solvency Certificate", category: "Financial", weight: "Optional", description: "Solvency certificate from a scheduled bank", threshold: "Valid" },
        { tender_id: tender1Id, name: "MSME Registration", category: "Compliance", weight: "Optional", description: "MSME/Udyam registration for preference benefits", threshold: "Valid" },
        { tender_id: tender1Id, name: "Technical Proposal", category: "Technical", weight: "Mandatory", description: "Detailed technical proposal with methodology", threshold: "Complete" },
        { tender_id: tender1Id, name: "Power of Attorney", category: "Compliance", weight: "Optional", description: "Authorization for the signatory", threshold: "Valid" },
      ])
      .select();

    if (c1Error) throw c1Error;

    // Create criteria for tender 2 (subset)
    await supabase.from("criteria").insert([
      { tender_id: tender2Id, name: "Annual Turnover", category: "Financial", weight: "Mandatory", description: "Minimum average annual turnover of ₹3 Crore", threshold: "₹3 Cr" },
      { tender_id: tender2Id, name: "GST Registration", category: "Compliance", weight: "Mandatory", description: "Valid GST registration", threshold: "Valid" },
      { tender_id: tender2Id, name: "ISO 9001 Certification", category: "Technical", weight: "Mandatory", description: "ISO 9001:2015 certification", threshold: "Valid" },
      { tender_id: tender2Id, name: "Experience Certificate", category: "Technical", weight: "Mandatory", description: "Minimum 2 similar works", threshold: "2 works" },
      { tender_id: tender2Id, name: "EMD Submission", category: "Financial", weight: "Mandatory", description: "EMD of ₹1 Lakh", threshold: "₹1 Lakh" },
      { tender_id: tender2Id, name: "PAN Verification", category: "Compliance", weight: "Mandatory", description: "Valid PAN card", threshold: "Valid" },
    ]);

    // Create criteria for tender 3 (subset)
    await supabase.from("criteria").insert([
      { tender_id: tender3Id, name: "Annual Turnover", category: "Financial", weight: "Mandatory", description: "Minimum ₹10 Cr average turnover", threshold: "₹10 Cr" },
      { tender_id: tender3Id, name: "Experience Certificate", category: "Technical", weight: "Mandatory", description: "5 similar construction works", threshold: "5 works" },
      { tender_id: tender3Id, name: "GST Registration", category: "Compliance", weight: "Mandatory", description: "Valid GST", threshold: "Valid" },
      { tender_id: tender3Id, name: "EMD Submission", category: "Financial", weight: "Mandatory", description: "EMD of ₹5 Lakh", threshold: "₹5 Lakh" },
    ]);

    // Create bidders for tender 1
    const { data: bidders1, error: b1Error } = await supabase
      .from("bidders")
      .insert([
        { tender_id: tender1Id, name: "Bharat Defence Systems Pvt. Ltd.", status: "Completed" },
        { tender_id: tender1Id, name: "Shakti Engineering Works", status: "Completed" },
        { tender_id: tender1Id, name: "National Security Solutions Ltd.", status: "Completed" },
        { tender_id: tender1Id, name: "Vijay Tactical Equipment Co.", status: "Completed" },
        { tender_id: tender1Id, name: "Garuda Security Systems Pvt. Ltd.", status: "Completed" },
      ])
      .select();

    if (b1Error) throw b1Error;

    // Create bidders for tender 2
    await supabase.from("bidders").insert([
      { tender_id: tender2Id, name: "Bharat Defence Systems Pvt. Ltd.", status: "Completed" },
      { tender_id: tender2Id, name: "Shakti Engineering Works", status: "Completed" },
      { tender_id: tender2Id, name: "National Security Solutions Ltd.", status: "Completed" },
    ]);

    // Create bidder files for tender 1 bidders
    const bidderFiles: Record<string, unknown>[] = [];
    const fileTemplates: Record<string, string[]> = {
      [bidders1[0].id]: ["TechnicalProposal.pdf", "FinancialBid.pdf", "GST_Certificate.pdf", "ISO_Certificate.pdf", "Turnover_Certificates.pdf", "Experience_Letters.pdf", "EMD_Receipt.pdf", "PAN_Card.pdf"],
      [bidders1[1].id]: ["TechProposal.pdf", "FinancialBid.pdf", "GST_Reg.pdf", "Turnover.pdf", "Experience.pdf", "EMD.pdf", "PAN.pdf"],
      [bidders1[2].id]: ["Technical_Proposal.pdf", "Financial_Bid.pdf", "GST_Cert.pdf", "ISO_9001.pdf", "Turnover_FY23-25.pdf", "Experience_Certs.pdf", "EMD_Submission.pdf", "PAN_Card.pdf", "Solvency_Cert.pdf"],
      [bidders1[3].id]: ["Proposal.pdf", "Financial.pdf", "GST.pdf", "Turnover.pdf", "EMD.pdf", "PAN.pdf"],
      [bidders1[4].id]: ["Tech_Proposal.pdf", "FinBid.pdf", "GST_Certificate.pdf", "ISO_Cert.pdf", "Turnover_Sheets.pdf", "Exp_Certificates.pdf", "EMD_Receipt.pdf", "PAN_Card.pdf", "MSME_Registration.pdf", "PoA.pdf"],
    };

    for (const [bidderId, files] of Object.entries(fileTemplates)) {
      for (const fileName of files) {
        bidderFiles.push({
          bidder_id: bidderId,
          file_name: fileName,
          storage_path: `seed/${bidderId}/${fileName}`,
          file_type: fileName.endsWith(".pdf") ? "PDF" : "DOC",
          file_size: Math.floor(Math.random() * 3000000) + 500000,
          ocr_status: "Completed",
          ocr_text: `Simulated OCR text for ${fileName}. Contains relevant procurement document data.`,
        });
      }
    }

    await supabase.from("bidder_files").insert(bidderFiles);

    // Create evaluations for tender 1
    const evalRecords: Record<string, unknown>[] = [];
    const criteriaMap: Record<string, string> = {};
    for (const c of criteria1) {
      criteriaMap[c.name] = c.id;
    }

    const evalData: Record<string, Record<string, { value: string; decision: string; confidence: number; source: string; explanation: string }>> = {
      [bidders1[0].id]: {
        "Annual Turnover": { value: "₹6.2 Cr (avg last 3 FY)", decision: "Eligible", confidence: 0.95, source: "Turnover_Certificates.pdf", explanation: "Document shows ₹6.2 Cr average. Exceeds ₹5 Cr threshold." },
        "GST Registration": { value: "GSTIN: 07AABCB1234F1ZK, Valid", decision: "Eligible", confidence: 0.98, source: "GST_Certificate.pdf", explanation: "Valid GST registration. GSTIN is active." },
        "ISO 9001 Certification": { value: "ISO 9001:2015, Valid till Dec 2027", decision: "Eligible", confidence: 0.92, source: "ISO_Certificate.pdf", explanation: "ISO 9001:2015 valid until December 2027." },
        "Experience Certificate": { value: "5 similar works in last 7 years", decision: "Eligible", confidence: 0.88, source: "Experience_Letters.pdf", explanation: "5 completed works found. Exceeds minimum of 3." },
        "EMD Submission": { value: "₹2,00,000 via DD No. 789456", decision: "Eligible", confidence: 0.96, source: "EMD_Receipt.pdf", explanation: "EMD of ₹2,00,000 submitted. Meets requirement." },
        "PAN Verification": { value: "AABCB1234F, Valid", decision: "Eligible", confidence: 0.97, source: "PAN_Card.pdf", explanation: "PAN verified against company records." },
        "Solvency Certificate": { value: "Not submitted", decision: "Review", confidence: 0.6, source: "N/A", explanation: "Solvency certificate not found. Optional criterion." },
        "MSME Registration": { value: "Not submitted", decision: "Review", confidence: 0.55, source: "N/A", explanation: "MSME registration not found. Optional." },
        "Technical Proposal": { value: "Complete — 42 pages, methodology included", decision: "Eligible", confidence: 0.91, source: "TechnicalProposal.pdf", explanation: "42-page proposal with detailed methodology." },
        "Power of Attorney": { value: "Not submitted", decision: "Review", confidence: 0.5, source: "N/A", explanation: "Power of Attorney not found. Optional." },
      },
      [bidders1[1].id]: {
        "Annual Turnover": { value: "₹4.8 Cr (avg last 3 FY)", decision: "Not Eligible", confidence: 0.93, source: "Turnover.pdf", explanation: "₹4.8 Cr average — shortfall of ₹0.2 Cr. Mandatory criterion." },
        "GST Registration": { value: "GSTIN: 09AAGCS5678B1ZP, Valid", decision: "Eligible", confidence: 0.97, source: "GST_Reg.pdf", explanation: "Valid GST registration." },
        "ISO 9001 Certification": { value: "Not submitted", decision: "Not Eligible", confidence: 0.85, source: "N/A", explanation: "ISO 9001:2015 not found. Mandatory criterion." },
        "Experience Certificate": { value: "2 similar works in last 7 years", decision: "Not Eligible", confidence: 0.82, source: "Experience.pdf", explanation: "Only 2 works found. Shortfall of 1 work." },
        "EMD Submission": { value: "₹2,00,000 via RTGS Ref 987654", decision: "Eligible", confidence: 0.95, source: "EMD.pdf", explanation: "EMD submitted via RTGS." },
        "PAN Verification": { value: "AAGCS5678B, Valid", decision: "Eligible", confidence: 0.96, source: "PAN.pdf", explanation: "PAN verified." },
        "Solvency Certificate": { value: "Not submitted", decision: "Review", confidence: 0.5, source: "N/A", explanation: "Not found. Optional." },
        "MSME Registration": { value: "Udyam Reg: UDYAM-09-01-0023456", decision: "Eligible", confidence: 0.89, source: "N/A", explanation: "MSME/Udyam registration found." },
        "Technical Proposal": { value: "Complete — 28 pages", decision: "Eligible", confidence: 0.85, source: "TechProposal.pdf", explanation: "28-page proposal submitted." },
        "Power of Attorney": { value: "Not submitted", decision: "Review", confidence: 0.5, source: "N/A", explanation: "Not found. Optional." },
      },
      [bidders1[2].id]: {
        "Annual Turnover": { value: "₹8.5 Cr (avg last 3 FY)", decision: "Eligible", confidence: 0.97, source: "Turnover_FY23-25.pdf", explanation: "₹8.5 Cr exceeds threshold by ₹3.5 Cr." },
        "GST Registration": { value: "GSTIN: 27AABCN9012C1ZM, Valid", decision: "Eligible", confidence: 0.98, source: "GST_Cert.pdf", explanation: "Valid GST registration." },
        "ISO 9001 Certification": { value: "ISO 9001:2015, Valid till Mar 2028", decision: "Eligible", confidence: 0.94, source: "ISO_9001.pdf", explanation: "Valid until March 2028." },
        "Experience Certificate": { value: "7 similar works in last 7 years", decision: "Eligible", confidence: 0.92, source: "Exp_Certificates.pdf", explanation: "7 similar works completed." },
        "EMD Submission": { value: "₹2,00,000 via BG No. BG2026/456", decision: "Eligible", confidence: 0.96, source: "EMD_Submission.pdf", explanation: "EMD via Bank Guarantee." },
        "PAN Verification": { value: "AABCN9012C, Valid", decision: "Eligible", confidence: 0.97, source: "PAN_Card.pdf", explanation: "PAN verified." },
        "Solvency Certificate": { value: "₹15 Cr solvency, Valid till Jun 2026", decision: "Eligible", confidence: 0.91, source: "Solvency_Cert.pdf", explanation: "₹15 Cr solvency from SBI." },
        "MSME Registration": { value: "Not submitted", decision: "Review", confidence: 0.55, source: "N/A", explanation: "Not found. Optional." },
        "Technical Proposal": { value: "Complete — 56 pages, comprehensive", decision: "Eligible", confidence: 0.95, source: "Technical_Proposal.pdf", explanation: "56-page comprehensive proposal." },
        "Power of Attorney": { value: "Not submitted", decision: "Review", confidence: 0.5, source: "N/A", explanation: "Not found. Optional." },
      },
      [bidders1[3].id]: {
        "Annual Turnover": { value: "₹5.1 Cr (avg last 3 FY)", decision: "Eligible", confidence: 0.82, source: "Turnover.pdf", explanation: "₹5.1 Cr marginally meets threshold. Needs manual verification." },
        "GST Registration": { value: "GSTIN: 33AABCV3456D1ZR, Valid", decision: "Eligible", confidence: 0.97, source: "GST.pdf", explanation: "Valid GST registration." },
        "ISO 9001 Certification": { value: "ISO 9001:2015, Expired Feb 2026", decision: "Review", confidence: 0.75, source: "N/A", explanation: "Certificate expired. Renewal status unknown." },
        "Experience Certificate": { value: "3 similar works in last 7 years", decision: "Eligible", confidence: 0.78, source: "N/A", explanation: "3 works found. One at 7-year boundary." },
        "EMD Submission": { value: "₹1,50,000 via DD", decision: "Not Eligible", confidence: 0.94, source: "EMD.pdf", explanation: "₹1,50,000 is ₹50,000 short. Mandatory criterion not met." },
        "PAN Verification": { value: "AABCV3456D, Valid", decision: "Eligible", confidence: 0.96, source: "PAN.pdf", explanation: "PAN verified." },
        "Solvency Certificate": { value: "Not submitted", decision: "Review", confidence: 0.5, source: "N/A", explanation: "Not found. Optional." },
        "MSME Registration": { value: "Not submitted", decision: "Review", confidence: 0.5, source: "N/A", explanation: "Not found. Optional." },
        "Technical Proposal": { value: "Partial — 18 pages, methodology incomplete", decision: "Review", confidence: 0.65, source: "Proposal.pdf", explanation: "Only 18 pages with incomplete methodology." },
        "Power of Attorney": { value: "Not submitted", decision: "Review", confidence: 0.5, source: "N/A", explanation: "Not found. Optional." },
      },
      [bidders1[4].id]: {
        "Annual Turnover": { value: "₹7.8 Cr (avg last 3 FY)", decision: "Eligible", confidence: 0.96, source: "Turnover_Sheets.pdf", explanation: "₹7.8 Cr exceeds threshold." },
        "GST Registration": { value: "GSTIN: 06AABCG7890E1ZS, Valid", decision: "Eligible", confidence: 0.98, source: "GST_Certificate.pdf", explanation: "Valid GST registration." },
        "ISO 9001 Certification": { value: "ISO 9001:2015, Valid till Sep 2027", decision: "Eligible", confidence: 0.93, source: "ISO_Cert.pdf", explanation: "Valid until September 2027." },
        "Experience Certificate": { value: "4 similar works in last 7 years", decision: "Eligible", confidence: 0.9, source: "Exp_Certificates.pdf", explanation: "4 similar works completed." },
        "EMD Submission": { value: "₹2,00,000 via DD No. 456123", decision: "Eligible", confidence: 0.96, source: "EMD_Receipt.pdf", explanation: "EMD submitted." },
        "PAN Verification": { value: "AABCG7890E, Valid", decision: "Eligible", confidence: 0.97, source: "PAN_Card.pdf", explanation: "PAN verified." },
        "Solvency Certificate": { value: "₹12 Cr solvency, Valid till Aug 2026", decision: "Eligible", confidence: 0.9, source: "N/A", explanation: "₹12 Cr solvency from ICICI Bank." },
        "MSME Registration": { value: "Udyam Reg: UDYAM-06-02-0034567", decision: "Eligible", confidence: 0.88, source: "MSME_Registration.pdf", explanation: "MSME/Udyam registration found." },
        "Technical Proposal": { value: "Complete — 48 pages, detailed", decision: "Eligible", confidence: 0.93, source: "Tech_Proposal.pdf", explanation: "48-page detailed proposal." },
        "Power of Attorney": { value: "Valid PoA for Director Mr. R.K. Sharma", decision: "Eligible", confidence: 0.87, source: "PoA.pdf", explanation: "PoA found, authorizing Director." },
      },
    };

    for (const [bidderId, criteria] of Object.entries(evalData)) {
      for (const [criterionName, data] of Object.entries(criteria)) {
        const criterionId = criteriaMap[criterionName];
        if (!criterionId) continue;
        evalRecords.push({
          tender_id: tender1Id,
          bidder_id: bidderId,
          criterion_id: criterionId,
          extracted_value: data.value,
          decision: data.decision,
          confidence: data.confidence,
          source_document: data.source,
          explanation: data.explanation,
        });
      }
    }

    await supabase.from("evaluations").insert(evalRecords);

    // Create activity logs
    await supabase.from("activity_logs").insert([
      { tender_id: tender1Id, action: "Tender document uploaded", user_name: "Sh. A.K. Verma", details: "Tender document uploaded and parsing initiated." },
      { tender_id: tender1Id, action: "Criteria extraction completed", user_name: "System", details: "10 criteria extracted — 7 mandatory, 3 optional." },
      { tender_id: tender1Id, action: "Bidder documents uploaded", user_name: "Sh. A.K. Verma", details: "Bharat Defence Systems — 8 files uploaded." },
      { tender_id: tender1Id, action: "Bidder documents uploaded", user_name: "Sh. A.K. Verma", details: "Shakti Engineering Works — 7 files uploaded." },
      { tender_id: tender1Id, action: "AI Evaluation completed", user_name: "System", details: "All 5 bidders evaluated. 2 bidders fully eligible, 1 partially eligible, 2 need review." },
      { tender_id: tender1Id, action: "Manual review completed", user_name: "Smt. P. Devi", details: "Reviewed Vijay Tactical Equipment — EMD shortfall confirmed." },
      { tender_id: tender2Id, action: "Tender document uploaded", user_name: "Sh. A.K. Verma", details: "Body Armour tender uploaded." },
      { tender_id: tender3Id, action: "Tender document uploaded", user_name: "Sh. R. Kumar", details: "Barrack construction tender uploaded." },
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Seed data created successfully",
        tenders: tenders.length,
        criteria: criteria1.length + 6 + 4,
        bidders: bidders1.length + 3,
        evaluations: evalRecords.length,
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
