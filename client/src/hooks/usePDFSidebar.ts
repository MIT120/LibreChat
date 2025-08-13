import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useToastContext } from '~/Providers';
import { useGetMessagesByConvoId } from '~/data-provider';

interface PDFSidebarState {
  isOpen: boolean;
  autoExportEnabled: boolean;
  currentDocumentData: any;
  lastExportTime: Date | null;
}

export const usePDFSidebar = () => {
  const [state, setState] = useState<PDFSidebarState>({
    isOpen: false,
    autoExportEnabled: localStorage.getItem('pdfAutoExport') === 'true',
    currentDocumentData: null,
    lastExportTime: null,
  });

  const { conversationId } = useParams();
  const { data: messages } = useGetMessagesByConvoId(conversationId ?? '', {
    enabled: !!conversationId,
  });
  const { showToast } = useToastContext();

  // Open/close sidebar
  const openSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
  }, []);

  const closeSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  // Auto-export toggle
  const toggleAutoExport = useCallback(
    (enabled: boolean) => {
      setState((prev) => ({ ...prev, autoExportEnabled: enabled }));
      localStorage.setItem('pdfAutoExport', enabled.toString());

      showToast({
        message: enabled
          ? 'Auto-export enabled - Documents will be automatically exported to PDF when chat makes changes'
          : 'Auto-export disabled',
        status: 'success',
      });
    },
    [showToast],
  );

  // Simplified legal document data extraction
  const extractLegalDocumentData = useCallback((messages: any[]) => {
    if (!messages || messages.length === 0) return null;

    // Look for the latest message with legal content
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      if (message.content && typeof message.content === 'string') {
        const content = message.content;

        // Check for case law analysis patterns
        if (content.includes('📋 Намерени са') && content.includes('съдебни решения')) {
          return {
            type: 'case_law',
            timestamp: message.createdAt || new Date(),
            content: content,
          };
        }

        // Check for legal analysis patterns
        if (content.includes('РИСКОВА ОЦЕНКА') || content.includes('Правен анализ')) {
          return {
            type: 'legal_analysis',
            timestamp: message.createdAt || new Date(),
            content: content,
          };
        }

        // Check for contract patterns
        if (content.includes('ДОГОВОР') || content.includes('СТРАНИ ПО ДОГОВОРА')) {
          return {
            type: 'contract',
            timestamp: message.createdAt || new Date(),
            content: content,
          };
        }
      }
    }

    return null;
  }, []);

  // Update current document data when messages change
  useEffect(() => {
    if (messages && conversationId) {
      const currentMessages = Array.isArray(messages) ? messages : [];
      const documentData = extractLegalDocumentData(currentMessages);

      if (documentData && documentData !== state.currentDocumentData) {
        setState((prev) => ({
          ...prev,
          currentDocumentData: documentData,
        }));
      }
    }
  }, [messages, conversationId, extractLegalDocumentData, state.currentDocumentData]);

  // Auto-export when document data changes
  const triggerAutoExport = useCallback(async () => {
    if (!state.autoExportEnabled || !state.currentDocumentData) return;

    try {
      let exportEndpoint = '';
      let exportData: any = {};

      switch (state.currentDocumentData.type) {
        case 'case_law':
          exportEndpoint = 'export_case_law_to_pdf';
          exportData = {
            caseLawData: state.currentDocumentData,
            title: `Анализ на съдебна практика - ${new Date().toLocaleDateString('bg-BG')}`,
            template: 'professional',
            includeSummary: true,
            includeAnalysis: true,
          };
          break;

        case 'legal_analysis':
          exportEndpoint = 'export_legal_analysis_to_pdf';
          exportData = {
            analysisData: state.currentDocumentData,
            title: `Правен анализ - ${new Date().toLocaleDateString('bg-BG')}`,
          };
          break;

        case 'contract':
          exportEndpoint = 'export_contract_to_pdf';
          exportData = {
            contractData: state.currentDocumentData,
            title: `Договор - ${new Date().toLocaleDateString('bg-BG')}`,
          };
          break;

        default:
          return;
      }

      const response = await fetch('/api/legal-documents/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: exportEndpoint,
          arguments: exportData,
        }),
      });

      if (response.ok) {
        setState((prev) => ({ ...prev, lastExportTime: new Date() }));
        showToast({
          message: 'Document has been exported to PDF',
          status: 'success',
        });
      }
    } catch (error) {
      console.error('Auto-export error:', error);
    }
  }, [state.autoExportEnabled, state.currentDocumentData, showToast]);

  // Debounced auto-export effect
  useEffect(() => {
    if (state.autoExportEnabled && state.currentDocumentData) {
      const timer = setTimeout(triggerAutoExport, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.currentDocumentData, triggerAutoExport, state.autoExportEnabled]);

  return {
    isOpen: state.isOpen,
    autoExportEnabled: state.autoExportEnabled,
    currentDocumentData: state.currentDocumentData,
    lastExportTime: state.lastExportTime,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    toggleAutoExport,
  };
};
