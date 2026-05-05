import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SARVAM_API_URL = "https://api.sarvam.ai/v1/ocr";
const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY") ?? "";

interface OCRRequest {
  file_url?: string;
  file_base64?: string;
  language?: string;
  file_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { file_url, file_base64, language, file_id } = await req.json() as OCRRequest;

    if (!file_url && !file_base64) {
      return new Response(
        JSON.stringify({ error: "Either file_url or file_base64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update bidder file status to Processing
    if (file_id) {
      await supabase
        .from("bidder_files")
        .update({ ocr_status: "Processing" })
        .eq("id", file_id);
    }

    let ocrResult: string;

    if (SARVAM_API_KEY) {
      // Real Sarvam OCR API call
      const payload: Record<string, unknown> = {
        language: language || "hi,en",
        model: "dococr",
      };

      if (file_base64) {
        payload.file_base64 = file_base64;
      } else if (file_url) {
        // Fetch the file from storage and convert to base64
        const fileResponse = await fetch(file_url);
        const fileBuffer = await fileResponse.arrayBuffer();
        payload.file_base64 = btoa(
          String.fromCharCode(...new Uint8Array(fileBuffer))
        );
      }

      const sarvamResponse = await fetch(SARVAM_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": SARVAM_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!sarvamResponse.ok) {
        const errorText = await sarvamResponse.text();
        throw new Error(`Sarvam API error: ${sarvamResponse.status} - ${errorText}`);
      }

      const sarvamData = await sarvamResponse.json();
      ocrResult = sarvamData.text || sarvamData.output || JSON.stringify(sarvamData);
    } else {
      // Fallback: simulate OCR for development
      ocrResult = simulateOCR(file_url || "");
    }

    // Update bidder file with OCR result
    if (file_id) {
      await supabase
        .from("bidder_files")
        .update({
          ocr_status: "Completed",
          ocr_text: ocrResult,
        })
        .eq("id", file_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: ocrResult,
        file_id,
        provider: SARVAM_API_KEY ? "sarvam" : "simulated",
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

function simulateOCR(fileUrl: string): string {
  const fileName = fileUrl.split("/").pop() || "document";

  const simulatedTexts: Record<string, string> = {
    "Turnover": "Annual Turnover Certificate\nFinancial Year 2022-23: INR 5,80,00,000\nFinancial Year 2023-24: INR 6,20,00,000\nFinancial Year 2024-25: INR 6,60,00,000\nAverage Annual Turnover (3 years): INR 6,20,00,000 (Rupees Six Crore Twenty Lakh Only)\nCertified by: CA R.K. Sharma, Membership No. 087654",
    "GST": "GST Registration Certificate\nGSTIN: 07AABCB1234F1ZK\nLegal Name: BHARAT DEFENCE SYSTEMS PRIVATE LIMITED\nDate of Registration: 15-03-2018\nStatus: Active\nIssuing Authority: Commissioner, CGST Delhi",
    "ISO": "ISO 9001:2015 Certificate\nCertificate No: QMS/2024/12345\nOrganization: Bharat Defence Systems Pvt. Ltd.\nScope: Design, Development and Supply of Defence and Security Equipment\nValid From: 01-Jan-2025\nValid Until: 31-Dec-2027\nIssued By: Bureau Veritas Certification",
    "Experience": "Experience Certificate\nThis is to certify that M/s Bharat Defence Systems Pvt. Ltd. has successfully executed the following works:\n1. CRPF Barrack Construction - 2020 - Value: INR 3.5 Cr\n2. BSF Outpost Setup - 2021 - Value: INR 2.8 Cr\n3. CISF Surveillance System - 2022 - Value: INR 4.2 Cr\n4. ITBP Equipment Supply - 2023 - Value: INR 3.1 Cr\n5. SSB Communication Network - 2024 - Value: INR 5.0 Cr",
    "EMD": "Earnest Money Deposit Receipt\nDD No: 789456\nDate: 25-Apr-2026\nAmount: INR 2,00,000 (Rupees Two Lakh Only)\nDrawn On: State Bank of India\nIn Favour of: DIG, CRPF Procurement Cell\nStatus: Realized",
    "PAN": "Permanent Account Number Card\nPAN: AABCB1234F\nName: BHARAT DEFENCE SYSTEMS PRIVATE LIMITED\nDate of Incorporation: 12-08-2015\nStatus: Valid",
    "Solvency": "Solvency Certificate\nCertified By: State Bank of India, Connaught Place Branch\nSolvency Amount: INR 15,00,00,000 (Rupees Fifteen Crore Only)\nValid Until: 30-June-2026\nAccount No: 3827465190",
    "MSME": "Udyam Registration Certificate\nRegistration No: UDYAM-06-02-0034567\nEnterprise Name: Garuda Security Systems Pvt. Ltd.\nType: Small Enterprise\nDate of Registration: 10-05-2021",
    "Technical": "Technical Proposal\nProject: Supply and Installation of Integrated Surveillance System for CRPF Camps Phase III\nMethodology: We propose a comprehensive approach including site survey, system design, procurement, installation, testing and commissioning.\nTimeline: 18 months from date of award\nTeam: 25 engineers, 10 technicians\nQuality Assurance: ISO 9001:2015 certified processes\nTotal Pages: 48",
    "PoA": "Power of Attorney\nKnow all men by these presents that M/s Garuda Security Systems Pvt. Ltd. hereby appoints Mr. R.K. Sharma, Director, as its authorized signatory for all matters relating to Tender CRPF/PROC/2026/SS-III/001.\nNotarized on: 28-Apr-2026\nNotary: Sh. V.K. Gupta, Notary Public, Delhi",
  };

  for (const [key, text] of Object.entries(simulatedTexts)) {
    if (fileName.toLowerCase().includes(key.toLowerCase())) {
      return text;
    }
  }

  return `Document: ${fileName}\nExtracted text content from the uploaded document.\nThis is a simulated OCR output for development purposes.\nWhen the Sarvam API key is configured, real OCR processing will be performed.`;
}
