import { create } from 'zustand';
import type { Tender, Criterion, EvaluationResult, ActivityLog, TimelineStep } from '../types';
import { MOCK_TENDERS, MOCK_ACTIVITY, MOCK_TIMELINE } from '../data/mockData';
import { tenderApi, criteriaApi, evaluationApi, ocrApi, seedApi } from '../lib/api';
import { mapTender, buildTimeline } from '../lib/mappers';
import { showToast } from '../components/common/NotificationToast';

interface AppState {
  tenders: Tender[];
  selectedTenderId: string | null;
  activityLog: ActivityLog[];
  timeline: TimelineStep[];
  uploadProgress: number;
  isUploading: boolean;
  isParsing: boolean;
  parsingProgress: number;
  isLoading: boolean;
  error: string | null;
  useMockData: boolean;

  setSelectedTender: (id: string | null) => void;
  getSelectedTender: () => Tender | undefined;
  updateCriterion: (tenderId: string, criterionId: string, updates: Partial<Criterion>) => void;
  updateEvaluation: (evaluationId: string, updates: Partial<EvaluationResult>) => void;
  setUploadProgress: (progress: number) => void;
  setIsUploading: (uploading: boolean) => void;
  setIsParsing: (parsing: boolean) => void;
  setParsingProgress: (progress: number) => void;
  addActivity: (activity: Omit<ActivityLog, 'id'>) => void;
  setError: (error: string | null) => void;
  simulateUpload: () => Promise<void>;
  simulateParsing: () => Promise<void>;
  simulateEvaluation: () => Promise<void>;

  // Real API actions
  fetchTenders: () => Promise<void>;
  fetchTender: (id: string) => Promise<void>;
  createTender: (title: string, referenceNo: string) => Promise<Tender | undefined>;
  extractCriteria: (tenderId: string, ocrText?: string) => Promise<void>;
  runEvaluation: (tenderId: string) => Promise<void>;
  updateCriterionApi: (tenderId: string, criterionId: string, updates: Partial<Criterion>) => Promise<void>;
  updateEvaluationApi: (tenderId: string, evalId: string, updates: Partial<EvaluationResult>) => Promise<void>;
  addBidderApi: (tenderId: string, name: string) => Promise<void>;
  processOcr: (
    fileId: string,
    fileUrl?: string,
    fileBase64?: string,
    meta?: { tenderId?: string; bidderId?: string; sourceScope?: 'tender_policy' | 'bidder_document' }
  ) => Promise<string>;
  refreshTimeline: () => void;
  seedDatabase: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  tenders: MOCK_TENDERS,
  selectedTenderId: MOCK_TENDERS[0]?.id || null,
  activityLog: MOCK_ACTIVITY,
  timeline: MOCK_TIMELINE,
  uploadProgress: 0,
  isUploading: false,
  isParsing: false,
  parsingProgress: 0,
  isLoading: false,
  error: null,
  useMockData: false,

  setSelectedTender: (id) => {
    set({ selectedTenderId: id });
    get().refreshTimeline();
  },

  getSelectedTender: () => {
    const { tenders, selectedTenderId } = get();
    return tenders.find((t) => t.id === selectedTenderId);
  },

  updateCriterion: (tenderId, criterionId, updates) =>
    set((state) => ({
      tenders: state.tenders.map((t) =>
        t.id === tenderId
          ? { ...t, criteria: t.criteria.map((c) => c.id === criterionId ? { ...c, ...updates } : c) }
          : t
      ),
    })),

  updateEvaluation: (evaluationId, updates) =>
    set((state) => ({
      tenders: state.tenders.map((t) => ({
        ...t,
        evaluations: t.evaluations.map((e) => e.id === evaluationId ? { ...e, ...updates } : e),
      })),
    })),

  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  setIsUploading: (uploading) => set({ isUploading: uploading }),
  setIsParsing: (parsing) => set({ isParsing: parsing }),
  setParsingProgress: (progress) => set({ parsingProgress: progress }),
  setError: (error) => set({ error }),

  addActivity: (activity) =>
    set((state) => ({
      activityLog: [{ ...activity, id: `a${Date.now()}` }, ...state.activityLog],
    })),

  refreshTimeline: () => {
    const tender = get().getSelectedTender();
    if (tender) {
      set({ timeline: buildTimeline(tender) });
    }
  },

  simulateUpload: async () => {
    set({ isUploading: true, uploadProgress: 0 });
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((r) => setTimeout(r, 80));
      set({ uploadProgress: i });
    }
    set({ isUploading: false, uploadProgress: 100 });
  },

  simulateParsing: async () => {
    set({ isParsing: true, parsingProgress: 0 });
    for (let i = 0; i <= 100; i += 3) {
      await new Promise((r) => setTimeout(r, 60));
      set({ parsingProgress: i });
    }
    set({ isParsing: false, parsingProgress: 100 });
  },

  simulateEvaluation: async () => {
    set({ isParsing: true, parsingProgress: 0 });
    for (let i = 0; i <= 100; i += 2) {
      await new Promise((r) => setTimeout(r, 40));
      set({ parsingProgress: i });
    }
    set({ isParsing: false, parsingProgress: 100 });
  },

  // Real API actions
  fetchTenders: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await tenderApi.list();
      if (result.success && result.tenders) {
        const enrichedTenders = await Promise.all(
          result.tenders.map(async (t: Record<string, unknown>) => {
            try {
              const detail = await tenderApi.get(t.id as string);
              if (detail.success && detail.tender) {
                return mapTender(
                  detail.tender as Record<string, unknown>,
                  detail.tender.criteria as Record<string, unknown>[] | undefined,
                  detail.tender.bidders as Record<string, unknown>[] | undefined,
                  detail.tender.evaluations as Record<string, unknown>[] | undefined,
                  detail.tender.bidder_files as Record<string, unknown>[] | undefined,
                );
              }
            } catch {
              // Fall back to basic tender data
            }
            return mapTender(t);
          })
        );
        set({ tenders: enrichedTenders, useMockData: false, isLoading: false });
        if (enrichedTenders.length > 0 && !get().selectedTenderId) {
          set({ selectedTenderId: enrichedTenders[0].id });
        }
        get().refreshTimeline();
      }
    } catch {
      set({ isLoading: false, error: 'Failed to fetch tenders' });
      showToast('error', 'Failed to fetch tenders from server.');
    }
  },

  fetchTender: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await tenderApi.get(id);
      if (result.success && result.tender) {
        const t = result.tender as Record<string, unknown>;
        const mapped = mapTender(
          t,
          t.criteria as Record<string, unknown>[] | undefined,
          t.bidders as Record<string, unknown>[] | undefined,
          t.evaluations as Record<string, unknown>[] | undefined,
          t.bidder_files as Record<string, unknown>[] | undefined,
        );
        set((state) => ({
          tenders: state.tenders.map((existing) => existing.id === id ? mapped : existing),
          isLoading: false,
          useMockData: false,
        }));
        get().refreshTimeline();
      }
    } catch {
      set({ isLoading: false, error: 'Failed to fetch tender details' });
      showToast('error', 'Failed to load tender details.');
    }
  },

  createTender: async (title: string, referenceNo: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await tenderApi.create({ title, reference_no: referenceNo });
      if (result.success && result.tender) {
        const newTender = mapTender(result.tender as Record<string, unknown>);
        set((state) => ({
          tenders: [newTender, ...state.tenders],
          selectedTenderId: newTender.id,
          isLoading: false,
          useMockData: false,
        }));
        get().refreshTimeline();
        showToast('success', `Tender "${title}" created successfully.`);
        return newTender;
      }
    } catch {
      set({ isLoading: false, error: 'Failed to create tender' });
      showToast('error', 'Failed to create tender. Please try again.');
    }
  },

  extractCriteria: async (tenderId: string, ocrText?: string) => {
    set({ isParsing: true, parsingProgress: 0, error: null });
    try {
      const result = await criteriaApi.extract({ tender_id: tenderId, ocr_text: ocrText });
      if (result.success && result.criteria) {
        const mappedCriteria = (result.criteria as Record<string, unknown>[]).map((c) => ({
          id: c.id as string,
          name: c.name as string,
          category: c.category as Criterion['category'],
          weight: c.weight as Criterion['weight'],
          description: (c.description as string) || '',
          threshold: (c.threshold as string) || '',
        }));
        set((state) => ({
          tenders: state.tenders.map((t) =>
            t.id === tenderId ? { ...t, criteria: mappedCriteria, status: 'Parsed' as const } : t
          ),
          isParsing: false,
          parsingProgress: 100,
          useMockData: false,
        }));
        get().refreshTimeline();
        showToast('success', `${mappedCriteria.length} eligibility criteria extracted.`);
      }
    } catch {
      set({ isParsing: false, parsingProgress: 0, error: 'Criteria extraction failed' });
      showToast('error', 'Criteria extraction failed. Using simulated data.');
    }
  },

  runEvaluation: async (tenderId: string) => {
    set({ isParsing: true, parsingProgress: 0, error: null });
    try {
      const result = await evaluationApi.evaluate({ tender_id: tenderId });
      if (result.success) {
        await get().fetchTender(tenderId);
        set({ isParsing: false, parsingProgress: 100, useMockData: false });
        showToast('success', 'AI evaluation completed successfully.');
      }
    } catch {
      set({ isParsing: false, parsingProgress: 0, error: 'Evaluation failed' });
      showToast('error', 'AI evaluation failed. Please try again.');
    }
  },

  updateCriterionApi: async (tenderId: string, criterionId: string, updates: Partial<Criterion>) => {
    get().updateCriterion(tenderId, criterionId, updates);
    try {
      await tenderApi.updateCriterion(tenderId, criterionId, updates as Record<string, unknown>);
      showToast('success', 'Criterion updated.');
    } catch {
      get().fetchTender(tenderId);
      showToast('error', 'Failed to update criterion.');
    }
  },

  updateEvaluationApi: async (tenderId: string, evalId: string, updates: Partial<EvaluationResult>) => {
    get().updateEvaluation(evalId, updates);
    try {
      await tenderApi.updateEvaluation(tenderId, evalId, updates as Record<string, unknown>);
      if (updates.decision) {
        showToast('success', `Evaluation marked as ${updates.decision}.`);
      }
    } catch {
      get().fetchTender(tenderId);
      showToast('error', 'Failed to update evaluation.');
    }
  },

  addBidderApi: async (tenderId: string, name: string) => {
    try {
      const result = await tenderApi.addBidder(tenderId, { name });
      if (result.success && result.bidder) {
        const b = result.bidder as Record<string, unknown>;
        const newBidder = {
          id: b.id as string,
          name: b.name as string,
          files: [] as string[],
          status: b.status as 'Processing' | 'Completed' | 'Failed',
          uploadedAt: (b.created_at as string) || new Date().toISOString(),
        };
        set((state) => ({
          tenders: state.tenders.map((t) =>
            t.id === tenderId ? { ...t, bidders: [...t.bidders, newBidder] } : t
          ),
        }));
        get().refreshTimeline();
        showToast('success', `Bidder "${name}" added.`);
      }
    } catch {
      set({ error: 'Failed to add bidder' });
      showToast('error', 'Failed to add bidder.');
    }
  },

  processOcr: async (
    fileId: string,
    fileUrl?: string,
    fileBase64?: string,
    meta?: { tenderId?: string; bidderId?: string; sourceScope?: 'tender_policy' | 'bidder_document' }
  ): Promise<string> => {
    try {
      const result = await ocrApi.process({
        file_id: fileId,
        file_url: fileUrl,
        file_base64: fileBase64,
        tender_id: meta?.tenderId,
        bidder_id: meta?.bidderId,
        source_scope: meta?.sourceScope,
      });
      return result.text || '';
    } catch {
      return '';
    }
  },

  seedDatabase: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await seedApi.seed();
      if (result.success) {
        showToast('success', result.message || 'Demo data seeded successfully.');
        await get().fetchTenders();
      } else {
        showToast('info', result.message || 'Data already exists.');
      }
      set({ isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Seed failed' });
      showToast('error', 'Failed to seed demo data.');
    }
  },
}));
