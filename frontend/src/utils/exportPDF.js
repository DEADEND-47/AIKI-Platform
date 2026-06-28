export async function exportAnswerAsPDF(message) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  
  doc.setFontSize(16);
  doc.text('AIKI Knowledge Copilot — Query Export', 20, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
  doc.text(`Confidence: ${message.confidence_label || 'HIGH'}`, 20, 36);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('Query:', 20, 50);
  doc.setFontSize(10);
  
  const queryText = message.query || 'Selected Query';
  doc.text(doc.splitTextToSize(queryText, 170), 20, 58);
  
  doc.setFontSize(12);
  doc.text('Answer:', 20, 80);
  doc.setFontSize(10);
  
  // Strip markdown formatting for PDF output
  const rawAnswer = message.content || message.answer || '';
  const plainAnswer = rawAnswer.replace(/\*\*/g, '').replace(/\*/g, '');
  doc.text(doc.splitTextToSize(plainAnswer, 170), 20, 88);
  
  if (message.sources && message.sources.length > 0) {
    doc.setFontSize(10);
    doc.text('Sources:', 20, 160);
    message.sources.forEach((s, i) => {
      doc.text(`${i + 1}. ${s.filename}, Page ${s.page}`, 25, 168 + i * 8);
    });
  }
  
  doc.save(`AIKI_Query_${Date.now()}.pdf`);
}
