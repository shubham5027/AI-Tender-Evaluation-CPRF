import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUCKET_NAME = "tender-documents";

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
    const path = url.pathname.replace("/file-upload", "");
    const method = req.method;

    // POST / — Upload a file to Supabase Storage and create bidder_file record
    if (method === "POST" && (path === "/" || path === "")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const bidderId = formData.get("bidder_id") as string | null;
      const tenderId = formData.get("tender_id") as string | null;

      if (!file) {
        return new Response(
          JSON.stringify({ error: "file is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ensure storage bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

      if (!bucketExists) {
        await supabase.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg",
            "image/png",
          ],
        });
      }

      // Generate unique storage path
      const ext = file.name.split(".").pop() || "pdf";
      const storagePath = `${tenderId || "unassigned"}/${bidderId || "tender"}/${Date.now()}_${file.name}`;

      // Upload to Supabase Storage
      const fileBuffer = await file.arrayBuffer();
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Determine file type
      const fileType = ext.toUpperCase() as string;

      // Create bidder_file record if bidder_id provided
      if (bidderId) {
        const { data: bidderFile, error: dbError } = await supabase
          .from("bidder_files")
          .insert({
            bidder_id: bidderId,
            file_name: file.name,
            storage_path: storagePath,
            file_type: fileType,
            file_size: file.size,
            ocr_status: "Pending",
          })
          .select()
          .single();

        if (dbError) throw dbError;

        return new Response(
          JSON.stringify({
            success: true,
            file: bidderFile,
            storage_path: storagePath,
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For tender documents (no bidder_id), just return storage info
      return new Response(
        JSON.stringify({
          success: true,
          storage_path: storagePath,
          file_name: file.name,
          file_size: file.size,
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /download?path=... — Get a signed URL for downloading a file
    if (method === "GET" && path === "/download") {
      const filePath = url.searchParams.get("path");

      if (!filePath) {
        return new Response(
          JSON.stringify({ error: "path query parameter is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, signed_url: data.signedUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE /?path=... — Delete a file from storage and database
    if (method === "DELETE" && (path === "/" || path === "")) {
      const filePath = url.searchParams.get("path");

      if (!filePath) {
        return new Response(
          JSON.stringify({ error: "path query parameter is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      await supabase
        .from("bidder_files")
        .delete()
        .eq("storage_path", filePath);

      return new Response(
        JSON.stringify({ success: true, message: "File deleted" }),
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
