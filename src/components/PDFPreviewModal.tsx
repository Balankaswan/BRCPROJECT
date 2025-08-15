import React, { useState, useEffect } from 'react';
import { X, Download, Eye, Loader } from 'lucide-react';
import jsPDF from 'jspdf';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  generatePDF: () => Promise<jsPDF>;
  onDownload?: () => void;
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  generatePDF,
  onDownload
}) => {
  const [pdfDataUrl, setPdfDataUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadPDF();
    } else {
      // Clean up when modal closes
      setPdfDataUrl('');
      setError('');
    }
  }, [isOpen]);

  const loadPDF = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const pdf = await generatePDF();
      const dataUrl = pdf.output('datauristring');
      setPdfDataUrl(dataUrl);
    } catch (err) {
      console.error('Error generating PDF preview:', err);
      setError('Failed to generate PDF preview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
    } else {
      try {
        const pdf = await generatePDF();
        pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
      } catch (err) {
        console.error('Error downloading PDF:', err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative flex h-full w-full items-center justify-center p-4">
        <div className="relative w-full max-w-6xl h-full max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Preview: {title}
              </h2>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </button>
              
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">Generating PDF preview...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-red-600 mb-4">
                    <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-4">{error}</p>
                  <button
                    onClick={loadPDF}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {pdfDataUrl && !isLoading && !error && (
              <div className="h-full w-full">
                <iframe
                  src={pdfDataUrl}
                  className="w-full h-full border-0"
                  title={`PDF Preview: ${title}`}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>PDF Preview - Same formatting as downloaded version</span>
              <span>Press ESC to close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for ESC key handling
export const usePDFPreviewModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return {
    isOpen,
    openModal: () => setIsOpen(true),
    closeModal: () => setIsOpen(false)
  };
};

export default PDFPreviewModal;
