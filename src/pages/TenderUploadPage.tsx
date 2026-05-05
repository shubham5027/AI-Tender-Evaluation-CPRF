import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, Loader2, CreditCard as Edit3, Save, X, Tag } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAppStore } from '../store/useAppStore';
import type { Criterion, CriterionCategory, CriterionWeight } from '../types';
import { fileApi } from '../lib/api';

export default function TenderUploadPage() {
  const {
    isUploading, uploadProgress, isParsing, parsingProgress,
    simulateUpload, simulateParsing, getSelectedTender,
    updateCriterion, extractCriteria, selectedTenderId,
    createTender, isLoading, tenders, setSelectedTender,
  } = useAppStore();

  const tender = getSelectedTender();
  const [uploaded, setUploaded] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Criterion>>({});
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // New tender form
  const [showNewTenderForm, setShowNewTenderForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newRefNo, setNewRefNo] = useState('');

  const handleCreateTender = useCallback(async () => {
    if (!newTitle.trim() || !newRefNo.trim()) return;
    const newTender = await createTender(newTitle.trim(), newRefNo.trim());
    if (newTender) {
      setShowNewTenderForm(false);
      setNewTitle('');
      setNewRefNo('');
    }
  }, [newTitle, newRefNo, createTender]);

  const handleUploadWithFile = useCallback(async (file?: File) => {
    const fileToUpload = file || selectedFile;
    if (fileToUpload && selectedTenderId) {
      try {
        await fileApi.uploadTenderDoc(fileToUpload, selectedTenderId);
      } catch {
        // Storage upload failed, continue with mock flow
      }
    }
    await simulateUpload();
    setUploaded(true);

    if (selectedTenderId) {
      try {
        await extractCriteria(selectedTenderId);
        setParsed(true);
        return;
      } catch {
        // Fall back to simulation
      }
    }
    await simulateParsing();
    setParsed(true);
  }, [simulateUpload, simulateParsing, extractCriteria, selectedTenderId, selectedFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
      handleUploadWithFile(files[0]);
    }
  }, [handleUploadWithFile]);

  const startEdit = (c: Criterion) => {
    setEditingId(c.id);
    setEditValues({ name: c.name, description: c.description, category: c.category, weight: c.weight, threshold: c.threshold });
  };

  const saveEdit = () => {
    if (editingId && tender) {
      updateCriterion(tender.id, editingId, editValues);
      setEditingId(null);
      setEditValues({});
    }
  };

  const categoryColor: Record<CriterionCategory, string> = {
    Technical: 'bg-blue-50 text-blue-700',
    Financial: 'bg-emerald-50 text-emerald-700',
    Compliance: 'bg-amber-50 text-amber-700',
  };

  const weightColor: Record<CriterionWeight, string> = {
    Mandatory: 'bg-red-50 text-red-700',
    Optional: 'bg-gray-100 text-gray-600',
  };

  // Determine if we need to show the new tender form
  const hasTender = !!tender;
  const showUploadArea = hasTender && !uploaded;

  return (
    <div>
      <Header title="Tender Upload" subtitle="Upload tender document and review extracted criteria" />
      <div className="p-8">
        {/* Tender selector / creator */}
        {!showUploadArea && !uploaded && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Select or Create a Tender</h2>
              <button
                onClick={() => setShowNewTenderForm(!showNewTenderForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-600 text-white text-xs font-medium rounded-lg hover:bg-navy-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> New Tender
              </button>
            </div>

            {/* Existing tenders list */}
            {tenders.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 mb-4">
                {tenders.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTender(t.id);
                      setUploaded(t.status !== 'Draft');
                      setParsed(t.criteria.length > 0);
                    }}
                    className={`w-full px-5 py-3.5 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      t.id === selectedTenderId ? 'bg-navy-50' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.referenceNo}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      t.status === 'Completed' ? 'bg-emerald-50 text-emerald-700'
                        : t.status === 'Evaluating' ? 'bg-blue-50 text-blue-700'
                        : t.status === 'Parsed' ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {t.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* New tender form */}
            {showNewTenderForm && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Create New Tender</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Tender Title</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Supply and Installation of Surveillance System"
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Reference Number</label>
                    <input
                      type="text"
                      value={newRefNo}
                      onChange={(e) => setNewRefNo(e.target.value)}
                      placeholder="e.g. CRPF/PROC/2026/SS-III/001"
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleCreateTender}
                      disabled={isLoading || !newTitle.trim() || !newRefNo.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-navy-600 text-white text-xs font-medium rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Create Tender
                    </button>
                    <button
                      onClick={() => setShowNewTenderForm(false)}
                      className="px-4 py-2 text-xs font-medium text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* If a tender is selected, show upload area */}
            {hasTender && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  dragOver ? 'border-navy-500 bg-navy-50' : 'border-gray-300 bg-white'
                }`}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-navy-600' : 'text-gray-400'}`} />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Tender Document</h3>
                <p className="text-sm text-gray-500 mb-6">Drag and drop your tender document here, or click to browse</p>
                <p className="text-xs text-gray-400 mb-6">Supported formats: PDF, DOC, DOCX (max 50MB)</p>
                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf,.doc,.docx';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        handleUploadWithFile(file);
                      }
                    };
                    input.click();
                  }}
                  className="px-6 py-2.5 bg-navy-600 text-white text-sm font-medium rounded-lg hover:bg-navy-700 transition-colors"
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>
        )}

        {/* Upload progress */}
        {isUploading && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-navy-600 animate-spin" />
              <span className="text-sm font-medium text-gray-900">Uploading document...</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-navy-600 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">{uploadProgress}% complete</p>
          </div>
        )}

        {/* Upload success */}
        {uploaded && !isUploading && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{selectedFile?.name || 'Tender document'}</p>
              <p className="text-xs text-gray-500">Uploaded successfully{selectedFile ? ` — ${(selectedFile.size / 1024 / 1024).toFixed(1)} MB` : ''}</p>
            </div>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {/* Parsing progress */}
        {isParsing && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-navy-600 animate-spin" />
              <span className="text-sm font-medium text-gray-900">AI is extracting eligibility criteria...</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-navy-600 rounded-full transition-all duration-200" style={{ width: `${parsingProgress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2">{parsingProgress}% — Analyzing document structure and requirements</p>
          </div>
        )}

        {/* Extracted criteria */}
        {parsed && !isParsing && tender && tender.criteria.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Extracted Eligibility Criteria</h2>
                <p className="text-xs text-gray-500 mt-0.5">{tender.criteria.length} criteria identified — review and edit as needed</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                  <Tag className="w-3 h-3" /> {tender.criteria.filter(c => c.weight === 'Mandatory').length} Mandatory
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                  <Tag className="w-3 h-3" /> {tender.criteria.filter(c => c.weight === 'Optional').length} Optional
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {tender.criteria.map((criterion) => (
                <div key={criterion.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  {editingId === criterion.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Name</label>
                          <input
                            type="text"
                            value={editValues.name || ''}
                            onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Threshold</label>
                          <input
                            type="text"
                            value={editValues.threshold || ''}
                            onChange={(e) => setEditValues({ ...editValues, threshold: e.target.value })}
                            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Description</label>
                        <textarea
                          value={editValues.description || ''}
                          onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                          rows={2}
                          className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Category</label>
                          <select
                            value={editValues.category || 'Technical'}
                            onChange={(e) => setEditValues({ ...editValues, category: e.target.value as CriterionCategory })}
                            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                          >
                            <option value="Technical">Technical</option>
                            <option value="Financial">Financial</option>
                            <option value="Compliance">Compliance</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Weight</label>
                          <select
                            value={editValues.weight || 'Mandatory'}
                            onChange={(e) => setEditValues({ ...editValues, weight: e.target.value as CriterionWeight })}
                            className="mt-1 w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                          >
                            <option value="Mandatory">Mandatory</option>
                            <option value="Optional">Optional</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={saveEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-600 text-white text-xs font-medium rounded-lg hover:bg-navy-700 transition-colors">
                          <Save className="w-3.5 h-3.5" /> Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="text-sm font-semibold text-gray-900">{criterion.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${categoryColor[criterion.category]}`}>
                            {criterion.category}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${weightColor[criterion.weight]}`}>
                            {criterion.weight}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{criterion.description}</p>
                        {criterion.threshold && (
                          <p className="text-xs text-navy-600 font-medium mt-1.5">Threshold: {criterion.threshold}</p>
                        )}
                      </div>
                      <button
                        onClick={() => startEdit(criterion)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                        title="Edit criterion"
                      >
                        <Edit3 className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
