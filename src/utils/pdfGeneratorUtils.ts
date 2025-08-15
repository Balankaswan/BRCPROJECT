import jsPDF from 'jspdf';

// Function to add BRC logo to PDF
export const addBRCLogo = async (pdf: jsPDF, x: number, y: number, width: number, height: number): Promise<void> => {
  try {
    // Try to load the professional BRC logo
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise<void>((resolve, _reject) => {
      img.onload = () => {
        try {
          // Add the professional logo image
          pdf.addImage(img, 'PNG', x, y, width, height);
          resolve();
        } catch (error) {
          console.warn('Failed to add logo image, using fallback:', error);
          addFallbackLogo(pdf, x, y, width, height);
          resolve();
        }
      };
      
      img.onerror = () => {
        console.warn('Logo image not found, using fallback');
        addFallbackLogo(pdf, x, y, width, height);
        resolve();
      };
      
      // Try to load the logo from public folder
      img.src = '/IMG_8496.jpg';
    });
  } catch (error) {
    console.warn('Error loading logo, using fallback:', error);
    addFallbackLogo(pdf, x, y, width, height);
  }
};

// Fallback logo function
export const addFallbackLogo = (pdf: jsPDF, x: number, y: number, width: number, height: number): void => {
  // Create a styled logo placeholder as fallback
  pdf.setFillColor(0, 100, 200); // Blue background
  pdf.rect(x, y, width, height, 'F');
  
  // Add "BRC" text in white
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BRC', x + width/2, y + height/2 + 2, { align: 'center' });
  
  // Reset text color
  pdf.setTextColor(0, 0, 0);
};
