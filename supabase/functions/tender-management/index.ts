import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

    const url = new URL(req.url);
    const path = url.pathname.replace("/tender-management", "");
    const method = req.method;

    // GET / — List all tenders with counts
    if (method === "GET" && (path === "/" || path === "")) {
      const { data: tenders, error } = await supabase
        .from("tenders")
        .select(`
          *,
          criteria:criteria(count),
          bidders:bidders(count),
          evaluations:evaluations(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, tenders }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /:id — Get single tender with full details
    if (method === "GET" && path.startsWith("/") && path.length > 1) {
      const tenderId = path.slice(1);

      const { data: tender, error: tenderError } = await supabase
        .from("tenders")
        .select("*")
        .eq("id", tenderId)
        .maybeSingle();

      if (tenderError) throw tenderError;
      if (!tender) {
        return new Response(
          JSON.stringify({ error: "Tender not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: criteria } = await supabase
        .from("criteria")
        .select("*")
        .eq("tender_id", tenderId);

      const { data: bidders } = await supabase
        .from("bidders")
        .select("*, files:bidder_files(*)")
        .eq("tender_id", tenderId);

      const { data: evaluations } = await supabase
        .from("evaluations")
        .select("*")
        .eq("tender_id", tenderId);

      const { data: activityLogs } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("tender_id", tenderId)
        .order("created_at", { ascending: false });

      return new Response(
        JSON.stringify({
          success: true,
          tender: { ...tender, criteria: criteria || [], bidders: bidders || [], evaluations: evaluations || [] },
          activityLogs: activityLogs || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST / — Create a new tender
    if (method === "POST" && (path === "/" || path === "")) {
      const body = await req.json();
      const { title, reference_no, uploaded_by } = body;

      if (!title || !reference_no) {
        return new Response(
          JSON.stringify({ error: "title and reference_no are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: tender, error } = await supabase
        .from("tenders")
        .insert({ title, reference_no, uploaded_by, status: "Draft" })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("activity_logs").insert({
        tender_id: tender.id,
        action: "Tender document uploaded",
        user_name: "Procurement Officer",
        details: `Tender "${title}" created with reference ${reference_no}.`,
      });

      return new Response(
        JSON.stringify({ success: true, tender }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUT /:id — Update a tender
    if (method === "PUT" && path.startsWith("/") && path.length > 1) {
      const tenderId = path.slice(1);
      const body = await req.json();

      const { data: tender, error } = await supabase
        .from("tenders")
        .update(body)
        .eq("id", tenderId)
        .select()
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, tender }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUT /:id/criteria/:criterionId — Update a criterion
    if (method === "PUT" && path.includes("/criteria/")) {
      const parts = path.split("/criteria/");
      const tenderId = parts[0].slice(1);
      const criterionId = parts[1];
      const body = await req.json();

      const { data: criterion, error } = await supabase
        .from("criteria")
        .update(body)
        .eq("id", criterionId)
        .eq("tender_id", tenderId)
        .select()
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, criterion }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUT /:id/evaluations/:evalId — Update an evaluation (human review)
    if (method === "PUT" && path.includes("/evaluations/")) {
      const parts = path.split("/evaluations/");
      const tenderId = parts[0].slice(1);
      const evalId = parts[1];
      const body = await req.json();

      const updateData: Record<string, unknown> = { ...body };
      if (body.decision) {
        updateData.reviewed_at = new Date().toISOString();
      }

      const { data: evaluation, error } = await supabase
        .from("evaluations")
        .update(updateData)
        .eq("id", evalId)
        .eq("tender_id", tenderId)
        .select()
        .maybeSingle();

      if (error) throw error;

      // Log the review action
      if (body.decision) {
        await supabase.from("activity_logs").insert({
          tender_id: tenderId,
          action: `Manual review: ${body.decision}`,
          user_name: body.reviewed_by_name || "Reviewer",
          details: `Evaluation ${evalId} updated to ${body.decision}.${body.review_comment ? ` Comment: ${body.review_comment}` : ""}`,
        });
      }

      return new Response(
        JSON.stringify({ success: true, evaluation }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /:id/bidders — Add a bidder to a tender
    if (method === "POST" && path.includes("/bidders") && !path.includes("/bidders/")) {
      const tenderId = path.replace("/bidders", "").slice(1);
      const body = await req.json();
      const { name, uploaded_by } = body;

      if (!name) {
        return new Response(
          JSON.stringify({ error: "name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: bidder, error } = await supabase
        .from("bidders")
        .insert({ tender_id: tenderId, name, uploaded_by, status: "Processing" })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("activity_logs").insert({
        tender_id: tenderId,
        action: "Bidder documents uploaded",
        user_name: "Procurement Officer",
        details: `${name} — files uploaded for processing.`,
      });

      return new Response(
        JSON.stringify({ success: true, bidder }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /activity — Get all activity logs
    if (method === "GET" && path === "/activity") {
      const { data: logs, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, logs }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Route not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
