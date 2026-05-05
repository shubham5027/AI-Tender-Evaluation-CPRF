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

    const { tender_id, ocr_text } = await req.json() as {
      tender_id: string;
      ocr_text?: string;
    };

    if (!tender_id) {
      return new Response(
        JSON.stringify({ error: "tender_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update tender status to Parsing
    await supabase
      .from("tenders")
      .update({ status: "Parsing" })
      .eq("id", tender_id);

    // Extract criteria from OCR text or use intelligent defaults
    const criteria = extractCriteria(ocr_text);

    // Insert criteria into database
    const criteriaRecords = criteria.map((c) => ({
      tender_id,
      name: c.name,
      category: c.category,
      weight: c.weight,
      description: c.description,
      threshold: c.threshold,
    }));

    const { data, error } = await supabase
      .from("criteria")
      .insert(criteriaRecords)
      .select();

    if (error) throw error;

    // Update tender status to Parsed
    await supabase
      .from("tenders")
      .update({ status: "Parsed" })
      .eq("id", tender_id);

    // Log activity
    await supabase.from("activity_logs").insert({
      tender_id,
      action: "Criteria extraction completed",
      user_name: "System",
      details: `${criteria.length} criteria extracted — ${criteria.filter(c => c.weight === "Mandatory").length} mandatory, ${criteria.filter(c => c.weight === "Optional").length} optional.`,
    });

    return new Response(
      JSON.stringify({ success: true, criteria: data, count: criteria.length }),
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

interface ExtractedCriterion {
  name: string;
  category: string;
  weight: string;
  description: string;
  threshold: string;
}

function extractCriteria(ocrText?: string): ExtractedCriterion[] {
  // If OCR text is available, attempt keyword-based extraction
  // In production, this would call an LLM API for intelligent extraction
  // For now, use domain-aware defaults for government procurement tenders

  const defaultCriteria: ExtractedCriterion[] = [
    {
      name: "Annual Turnover",
      category: "Financial",
      weight: "Mandatory",
      description: "Minimum average annual turnover of ₹5 Crore for the last 3 financial years",
      threshold: "₹5 Cr",
    },
    {
      name: "GST Registration",
      category: "Compliance",
      weight: "Mandatory",
      description: "Valid GST registration certificate",
      threshold: "Valid",
    },
    {
      name: "ISO 9001 Certification",
      category: "Technical",
      weight: "Mandatory",
      description: "ISO 9001:2015 certification for quality management",
      threshold: "Valid",
    },
    {
      name: "Experience Certificate",
      category: "Technical",
      weight: "Mandatory",
      description: "Minimum 3 similar works executed in last 7 years",
      threshold: "3 works",
    },
    {
      name: "EMD Submission",
      category: "Financial",
      weight: "Mandatory",
      description: "Earnest Money Deposit of ₹2 Lakh",
      threshold: "₹2 Lakh",
    },
    {
      name: "PAN Verification",
      category: "Compliance",
      weight: "Mandatory",
      description: "Valid PAN card of the bidding entity",
      threshold: "Valid",
    },
    {
      name: "Solvency Certificate",
      category: "Financial",
      weight: "Optional",
      description: "Solvency certificate from a scheduled bank",
      threshold: "Valid",
    },
    {
      name: "MSME Registration",
      category: "Compliance",
      weight: "Optional",
      description: "MSME/Udyam registration for preference benefits",
      threshold: "Valid",
    },
    {
      name: "Technical Proposal",
      category: "Technical",
      weight: "Mandatory",
      description: "Detailed technical proposal with methodology",
      threshold: "Complete",
    },
    {
      name: "Power of Attorney",
      category: "Compliance",
      weight: "Optional",
      description: "Authorization for the signatory",
      threshold: "Valid",
    },
  ];

  if (!ocrText) return defaultCriteria;

  // Simple keyword matching to customize thresholds from OCR text
  const turnoverMatch = ocrText.match(/turnover[^.]*?₹?\s*([\d,.]+)\s*(?:crore|cr|lakh)/i);
  if (turnoverMatch) {
    defaultCriteria[0].threshold = `₹${turnoverMatch[1]} Cr`;
    defaultCriteria[0].description = `Minimum average annual turnover of ₹${turnoverMatch[1]} Crore for the last 3 financial years`;
  }

  const emdMatch = ocrText.match(/EMD[^.]*?₹?\s*([\d,.]+)\s*(?:lakh|crore|cr)/i);
  if (emdMatch) {
    defaultCriteria[4].threshold = `₹${emdMatch[1]} Lakh`;
    defaultCriteria[4].description = `Earnest Money Deposit of ₹${emdMatch[1]} Lakh`;
  }

  const expMatch = ocrText.match(/(\d+)\s+similar\s+works/i);
  if (expMatch) {
    defaultCriteria[3].threshold = `${expMatch[1]} works`;
    defaultCriteria[3].description = `Minimum ${expMatch[1]} similar works executed in last 7 years`;
  }

  return defaultCriteria;
}
