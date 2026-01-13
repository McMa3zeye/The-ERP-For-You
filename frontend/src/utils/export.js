import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'

// Export data to CSV with error handling and validation
export const exportToCSV = (data, filename = 'export.csv', headers = null) => {
  try {
    if (!data) {
      console.error('No data provided for CSV export')
      alert('No data to export')
      return
    }
    
    // Validate filename
    if (!filename || typeof filename !== 'string') {
      filename = 'export.csv'
    }
    // Sanitize filename
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100)
    if (!filename.endsWith('.csv')) {
      filename += '.csv'
    }
    
    let csv = ''
    
    // Add BOM for Excel compatibility
    csv += '\ufeff'
    
    if (headers && Array.isArray(headers) && headers.length > 0) {
      // Escape headers properly
      csv += headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n'
    }
    
    if (Array.isArray(data)) {
      if (data.length === 0) {
        alert('No data to export')
        return
      }
      
      // Get headers from first object if not provided
      const actualHeaders = headers || (data.length > 0 && typeof data[0] === 'object' ? Object.keys(data[0]) : null)
      
      if (actualHeaders && actualHeaders.length > 0) {
        csv += actualHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n'
      }
      
      data.forEach((row, index) => {
        try {
          if (typeof row === 'object' && row !== null) {
            const values = (actualHeaders || Object.keys(row)).map(key => {
              const val = row[key]
              if (val === null || val === undefined) return '""'
              // Escape quotes and handle special characters
              return `"${String(val).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '')}"`
            })
            csv += values.join(',') + '\n'
          } else {
            csv += `"${String(row).replace(/"/g, '""')}"\n`
          }
        } catch (err) {
          console.error(`Error processing row ${index}:`, err)
        }
      })
    } else if (typeof data === 'object' && data !== null) {
      // Convert object to rows
      const entries = Object.entries(data)
      if (entries.length === 0) {
        alert('No data to export')
        return
      }
      
      entries.forEach(([key, value]) => {
        csv += `"${String(key).replace(/"/g, '""')}","${String(value).replace(/"/g, '""')}"\n`
      })
    } else {
      alert('Invalid data format for CSV export')
      return
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, filename)
  } catch (error) {
    console.error('Error exporting to CSV:', error)
    alert('Failed to export CSV: ' + error.message)
  }
}

// Export data to Excel with error handling and validation
export const exportToExcel = (data, filename = 'export.xlsx', sheetName = 'Sheet1') => {
  try {
    if (!data) {
      console.error('No data provided for Excel export')
      alert('No data to export')
      return
    }
    
    // Validate inputs
    if (!Array.isArray(data)) {
      console.error('Excel export requires an array of objects')
      alert('Invalid data format for Excel export')
      return
    }
    
    if (data.length === 0) {
      alert('No data to export')
      return
    }
    
    // Validate and sanitize filename
    if (!filename || typeof filename !== 'string') {
      filename = 'export.xlsx'
    }
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100)
    if (!filename.endsWith('.xlsx')) {
      filename += '.xlsx'
    }
    
    // Validate and sanitize sheet name
    if (!sheetName || typeof sheetName !== 'string') {
      sheetName = 'Sheet1'
    }
    sheetName = sheetName.substring(0, 31) // Excel limit is 31 characters
    
    // Limit data size to prevent memory issues (max 100k rows)
    const exportData = data.slice(0, 100000)
    if (data.length > 100000) {
      console.warn(`Data truncated to 100,000 rows (original: ${data.length})`)
    }
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    alert('Failed to export Excel: ' + error.message)
  }
}

// Export dashboard to PDF with error handling and validation
export const exportDashboardToPDF = async (elementId, filename = 'dashboard.pdf') => {
  try {
    // Validate inputs
    if (!elementId || typeof elementId !== 'string') {
      console.error('Invalid element ID')
      alert('Invalid element ID')
      return
    }
    
    // Validate and sanitize filename
    if (!filename || typeof filename !== 'string') {
      filename = 'dashboard.pdf'
    }
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100)
    if (!filename.endsWith('.pdf')) {
      filename += '.pdf'
    }
    
    const html2canvas = (await import('html2canvas')).default
    const element = document.getElementById(elementId)
    
    if (!element) {
      console.error('Element not found:', elementId)
      alert('Dashboard element not found')
      return
    }
    
    // Check if element has content
    if (element.scrollHeight === 0 && element.scrollWidth === 0) {
      alert('Dashboard is empty')
      return
    }
    
    // Show loading indicator
    const originalCursor = document.body.style.cursor
    document.body.style.cursor = 'wait'
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#2a2a2a',
        allowTaint: true,
        useCORS: true,
        timeout: 60000 // 60 second timeout
      })
      
      // Check canvas dimensions
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas has zero dimensions')
      }
      
      const imgData = canvas.toDataURL('image/png', 0.95)
      const pdf = new jsPDF('l', 'mm', 'a4') // landscape, millimeters, A4
      const imgWidth = 297 // A4 width in mm
      const pageHeight = 210 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      pdf.save(filename)
    } finally {
      document.body.style.cursor = originalCursor
    }
  } catch (error) {
    console.error('Error exporting to PDF:', error)
    alert('Failed to export dashboard to PDF: ' + (error.message || 'Unknown error'))
    document.body.style.cursor = ''
  }
}

// Export chart data
export const exportChartData = (chartData, chartTitle, format = 'csv') => {
  if (format === 'csv') {
    exportToCSV(chartData, `${chartTitle}_data.csv`)
  } else if (format === 'excel') {
    exportToExcel(chartData, `${chartTitle}_data.xlsx`)
  }
}

