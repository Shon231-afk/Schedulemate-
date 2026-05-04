import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Group } from '../types';

export const exportScheduleToPDF = async (group: Group) => {
  const element = document.getElementById('schedule-to-export');
  if (!element || !group.schedule) return;

  try {
    // We capture the schedule element as an image
    // This preserves all colors, Russian text, and the dark theme perfectly
    const canvas = await html2canvas(element, {
      backgroundColor: '#050505',
      scale: 1.5,
      logging: false,
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: -window.scrollY, // Adjust for page scroll
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Create PDF (A4 size)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate aspect ratio
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = imgWidth / imgHeight;
    
    const finalWidth = pdfWidth - 20; // 10mm margins
    const finalHeight = finalWidth / ratio;

    pdf.setFontSize(10);
    pdf.setTextColor(150);
    pdf.text(`ScheduleMate AI - ${group.name}`, 10, 8);

    pdf.addImage(imgData, 'PNG', 10, 15, finalWidth, finalHeight);
    
    pdf.save(`Расписание_${group.name}.pdf`);
  } catch (error) {
    console.error('PDF Generation Error:', error);
  }
};
