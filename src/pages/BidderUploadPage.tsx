import { useState, useCallback } from 'react';
import { FileText, CheckCircle, Loader2, FolderOpen, X, Play, Brain } from 'lucide-react';
import Header from '../components/layout/Header';
import { showToast } from '../components/common/NotificationToast';
import { useAppStore } from '../store/useAppStore';
import { fileApi } from '../lib/api';

export default function BidderUploadPage() {
  const {
    getSelectedTender, simulateUpload, isUploading, uploadProgress,
    selectedTenderId, addBidderApi, runEvaluation, isParsing, processOcr,
  } = useAppStore();
  const tender = getSelectedTender();
  const [dragOver, setDragOver] = useState(false);
  const [uploadingBidder, setUploadingBidder] = useState<string | null>(null);
  const [newBidderName, setNewBidderName] = useState('');
  const [showAddBidder, setShowAddBidder] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);

  const fileToBase64 = useCallback(async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0 || !selectedTenderId) return;

    // Derive bidder name from first file or use input
    const bidderName = newBidderName.trim() || files[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setUploadingBidder(bidderName);

    // Create bidder in backend
    try {
      await addBidderApi(selectedTenderId, bidderName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add bidder at this time.';
      showToast('error', `Failed to create bidder: ${message}. Upload will continue in offline mode.`);
    }

    // Upload files to the newly created bidder
    const updatedTender = useAppStore.getState().getSelectedTender();
    const newBidder = updatedTender?.bidders[updatedTender.bidders.length - 1];

    if (newBidder?.id) {
      try {
        for (const file of files) {
          const uploadResult = await fileApi.upload(file, newBidder.id, selectedTenderId);
          const fileId = uploadResult.file?.id as string | undefined;
          if (fileId) {
            const fileBase64 = await fileToBase64(file);
            await processOcr(fileId, undefined, fileBase64, {
              tenderId: selectedTenderId,
              bidderId: newBidder.id,
              sourceScope: 'bidder_document',
            });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload or OCR processing failed.';
        showToast('error', `Document upload failed: ${message}. Continuing with offline fallback.`);
      }
    }

    await simulateUpload();
    setUploadingBidder(null);
    setNewBidderName('');
    setShowAddBidder(false);
  }, [selectedTenderId, newBidderName, addBidderApi, fileToBase64, processOcr, simulateUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleUpload(files);
  }, [handleUpload]);

  const handleRunPipeline = useCallback(async () => {
    if (!selectedTenderId) return;
    setPipelineStatus('Running AI evaluation on all bidder documents...');
    try {
      await runEvaluation(selectedTenderId);
      setPipelineStatus('Evaluation complete!');
      setTimeout(() => setPipelineStatus(null), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Evaluation failed.';
      setPipelineStatus('Evaluation failed. Please try again.');
      showToast('error', `AI evaluation failed: ${message}`);
      setTimeout(() => setPipelineStatus(null), 3000);
    }
  }, [selectedTenderId, runEvaluation]);

  const bidders = tender?.bidders || [];
  const hasBidders = bidders.length > 0;
  const hasEvaluations = (tender?.evaluations.length || 0) > 0;

  return (
    <div>
      <Header title="Bidder Submissions" subtitle="Upload and manage bidder documents for evaluation" />
      <div className="p-8">
        {/* Add bidder section */}
        <div className="mb-6">
          {showAddBidder && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Add New Bidder</h3>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newBidderName}
                  onChange={(e) => setNewBidderName(e.target.value)}
                  placeholder="Enter bidder company name"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                />
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
                    input.onchange = (e) => {
                      const fileList = (e.target as HTMLInputElement).files;
                      if (fileList) {
                        handleUpload(Array.from(fileList));
                      }
                    };
                    input.click();
                  }}
                  disabled={!newBidderName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-navy-600 text-white text-xs font-medium rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Upload Files
                </button>
                <button
                  onClick={() => { setShowAddBidder(false); setNewBidderName(''); }}
                  className="px-3 py-2 text-xs font-medium text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragOver ? 'border-navy-500 bg-navy-50' : 'border-gray-300 bg-white'
            }`}
          >
            <FolderOpen className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-navy-600' : 'text-gray-400'}`} />
            <h3 className="text-base font-semibold text-gray-900 mb-1.5">Upload Bidder Documents</h3>
            <p className="text-sm text-gray-500 mb-4">Drag and drop bidder folders or files here</p>
            <p className="text-xs text-gray-400 mb-5">Supported: PDF, DOC, DOCX, JPG, PNG (max 100MB per bidder)</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowAddBidder(true)}
                className="px-5 py-2 bg-navy-600 text-white text-sm font-medium rounded-lg hover:bg-navy-700 transition-colors"
              >
                Add Bidder & Upload
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
                  input.onchange = (e) => {
                    const fileList = (e.target as HTMLInputElement).files;
                    if (fileList) handleUpload(Array.from(fileList));
                  };
                  input.click();
                }}
                className="px-5 py-2 bg-white text-navy-600 text-sm font-medium rounded-lg border border-navy-200 hover:bg-navy-50 transition-colors"
              >
                Quick Upload
              </button>
            </div>
          </div>
        </div>

        {/* Upload progress */}
        {uploadingBidder && isUploading && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-navy-600 animate-spin" />
              <span className="text-sm font-medium text-gray-900">Uploading documents for {uploadingBidder}...</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-navy-600 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">{uploadProgress}% complete</p>
          </div>
        )}

        {/* Pipeline status */}
        {pipelineStatus && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            {isParsing ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" /> : <Brain className="w-5 h-5 text-blue-600 flex-shrink-0" />}
            <p className="text-sm font-medium text-blue-800">{pipelineStatus}</p>
          </div>
        )}

        {/* Bidders list */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Submitted Bidders</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{bidders.length} bidders</span>
            {hasBidders && !hasEvaluations && selectedTenderId && (
              <button
                onClick={handleRunPipeline}
                disabled={isParsing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-600 text-white text-xs font-medium rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> Run Evaluation
              </button>
            )}
          </div>
        </div>

        {hasBidders ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {bidders.map((bidder) => (
              <div key={bidder.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{bidder.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Uploaded {new Date(bidder.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    bidder.status === 'Completed'
                      ? 'bg-emerald-50 text-emerald-700'
                      : bidder.status === 'Processing'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {bidder.status === 'Processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {bidder.status === 'Completed' && <CheckCircle className="w-3 h-3" />}
                    {bidder.status === 'Failed' && <X className="w-3 h-3" />}
                    {bidder.status}
                  </span>
                </div>

                <div className="space-y-1.5 mb-3">
                  {bidder.files.slice(0, 4).map((file) => (
                    <div key={file} className="flex items-center gap-2 text-xs text-gray-600">
                      <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                  ))}
                  {bidder.files.length > 4 && (
                    <p className="text-[11px] text-gray-400 pl-5.5">+{bidder.files.length - 4} more files</p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">{bidder.files.length} files</span>
                  <span className="text-[11px] font-medium text-navy-600">View Details</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No bidders uploaded yet.</p>
            <p className="text-xs text-gray-400 mt-1">Upload bidder documents to begin the evaluation process.</p>
          </div>
        )}
      </div>
    </div>
  );
}
