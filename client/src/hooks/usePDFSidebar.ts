import { useState, useCallback, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { useToastContext } from '~/Providers';
import store from '~/store';

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

  const conversation = useRecoilValue(store.conversation);
  const messages = useRecoilValue(store.messagesTree);
  const { showToast } = useToastContext();

  // Open/close sidebar
  const openSidebar = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true }));
  }, []);

  const closeSidebar = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  // Auto-export toggle
  const toggleAutoExport = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, autoExportEnabled: enabled }));
    localStorage.setItem('pdfAutoExport', enabled.toString());
    
    showToast({
      title: enabled ? 'Auto-export enabled' : 'Auto-export disabled',
      description: enabled 
        ? 'Documents will be automatically exported to PDF when chat makes changes'
        : 'Auto-export has been disabled',
      status: 'success',
    });
  }, [showToast]);

  // Extract legal document data from messages
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
            results: extractCaseLawResults(content),
            searchMethods: extractSearchMethods(content),
            criteria: extractSearchCriteria(content)
          };
        }
        
        // Check for legal analysis patterns  
        if (content.includes('РИСКОВА ОЦЕНКА') || content.includes('Правен анализ')) {
          return {
            type: 'legal_analysis',
            timestamp: message.createdAt || new Date(),
            content: content,
            analysis: extractAnalysisData(content),
            document: extractDocumentInfo(content),
            recommendations: extractRecommendations(content)
          };
        }
        
        // Check for contract patterns
        if (content.includes('ДОГОВОР') || content.includes('СТРАНИ ПО ДОГОВОРА')) {
          return {
            type: 'contract',
            timestamp: message.createdAt || new Date(),
            content: content,
            parties: extractParties(content),
            terms: extractTerms(content),
            clauses: extractClauses(content)
          };
        }
      }
    }
    
    return null;
  }, []);

  // Helper functions for data extraction
  const extractCaseLawResults = (content: string) => {
    const results = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^[📚⚖️🏛️📖📋]\s*\d+\./)) {
        const caseMatch = line.match(/\d+\.\s*(.+)$/);
        if (caseMatch) {
          const caseInfo = {
            citation: caseMatch[1],
            legalBasis: extractFromNextLines(lines, i, 'Основание:'),
            outcome: extractFromNextLines(lines, i, 'Резултат:'),
            summary: extractFromNextLines(lines, i, 'Резюме:'),
            reasoning: extractFromNextLines(lines, i, 'Мотиви:')
          };
          results.push(caseInfo);
        }
      }
    }
    
    return results;
  };

  const extractSearchMethods = (content: string) => {
    const methodsMatch = content.match(/🔍 Методи на търсене:\s*([^\n]+)/);
    return methodsMatch ? methodsMatch[1].split(',').map(m => m.trim()) : [];
  };

  const extractSearchCriteria = (content: string) => {
    const criteria: any = {};
    
    const articlesMatch = content.match(/📜 Членове:\s*([^\n]+)/);
    if (articlesMatch) criteria.articles = articlesMatch[1].split(',').map(a => a.trim());
    
    const lawsMatch = content.match(/⚖️ Закони:\s*([^\n]+)/);
    if (lawsMatch) criteria.laws = lawsMatch[1].split(',').map(l => l.trim());
    
    const courtMatch = content.match(/🏛️ Съд:\s*([^\n]+)/);
    if (courtMatch) criteria.court = courtMatch[1].trim();
    
    return criteria;
  };

  const extractAnalysisData = (content: string) => {
    const analysis: any = {};
    
    const riskMatch = content.match(/РИСКОВА ОЦЕНКА:\s*([^\n]+)/);
    if (riskMatch) {
      const riskText = riskMatch[1];
      const levelMatch = riskText.match(/(висок|среден|нисък)/i);
      const scoreMatch = riskText.match(/\((\d+)/);
      
      analysis.riskAssessment = {
        level: levelMatch ? levelMatch[1] : 'unknown',
        score: scoreMatch ? parseInt(scoreMatch[1]) : 0
      };
    }
    
    return analysis;
  };

  const extractDocumentInfo = (content: string) => {
    const doc: any = {};
    
    const typeMatch = content.match(/Тип документ:\s*([^\n]+)/);
    if (typeMatch) doc.type = typeMatch[1].trim();
    
    const wordsMatch = content.match(/(\d+)\s*думи/);
    if (wordsMatch) doc.wordCount = parseInt(wordsMatch[1]);
    
    return doc;
  };

  const extractRecommendations = (content: string) => {
    const recommendations = [];
    const lines = content.split('\n');
    
    let inRecommendations = false;
    for (const line of lines) {
      if (line.includes('ПРЕПОРЪКИ')) {
        inRecommendations = true;
        continue;
      }
      
      if (inRecommendations && line.match(/^\d+\./)) {
        recommendations.push(line.replace(/^\d+\.\s*/, '').trim());
      } else if (inRecommendations && line.trim() === '') {
        break;
      }
    }
    
    return recommendations;
  };

  const extractParties = (content: string) => {
    const parties: any = {};
    
    const firstMatch = content.match(/Първа страна:\s*([^\n]+)/);
    if (firstMatch) parties.first = firstMatch[1].trim();
    
    const secondMatch = content.match(/Втора страна:\s*([^\n]+)/);
    if (secondMatch) parties.second = secondMatch[1].trim();
    
    return parties;
  };

  const extractTerms = (content: string) => {
    const terms = [];
    const lines = content.split('\n');
    
    let inTerms = false;
    for (const line of lines) {
      if (line.includes('УСЛОВИЯ')) {
        inTerms = true;
        continue;
      }
      
      if (inTerms && line.match(/^\d+\./)) {
        terms.push(line.replace(/^\d+\.\s*/, '').trim());
      } else if (inTerms && line.includes('ПОДПИСИ')) {
        break;
      }
    }
    
    return terms;
  };

  const extractClauses = (content: string) => {
    // Extract contract clauses - simplified implementation
    const clauses = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('чл.') || line.includes('член')) {
        clauses.push(line.trim());
      }
    }
    
    return clauses;
  };

  const extractFromNextLines = (lines: string[], startIndex: number, prefix: string) => {
    for (let i = startIndex + 1; i < Math.min(startIndex + 5, lines.length); i++) {
      if (lines[i].includes(prefix)) {
        return lines[i].replace(prefix, '').trim();
      }
    }
    return '';
  };

  // Update current document data when messages change
  useEffect(() => {
    if (messages && conversation?.conversationId) {
      const currentMessages = Object.values(messages).filter(Boolean);
      const documentData = extractLegalDocumentData(currentMessages);
      
      if (documentData && documentData !== state.currentDocumentData) {
        setState(prev => ({ 
          ...prev, 
          currentDocumentData: documentData 
        }));
      }
    }
  }, [messages, conversation?.conversationId, extractLegalDocumentData, state.currentDocumentData]);

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
            includeAnalysis: true
          };
          break;
          
        case 'legal_analysis':
          exportEndpoint = 'export_legal_analysis_to_pdf';
          exportData = {
            analysisData: state.currentDocumentData,
            title: `Правен анализ - ${new Date().toLocaleDateString('bg-BG')}`
          };
          break;
          
        case 'contract':
          exportEndpoint = 'export_contract_to_pdf';
          exportData = {
            contractData: state.currentDocumentData,
            title: `Договор - ${new Date().toLocaleDateString('bg-BG')}`
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
          arguments: exportData
        })
      });
      
      if (response.ok) {
        setState(prev => ({ ...prev, lastExportTime: new Date() }));
        showToast({
          title: 'Auto-export successful',
          description: 'Document has been exported to PDF',
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
