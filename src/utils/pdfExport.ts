import jsPDF from 'jspdf'
import { MenuItem, WeeklyMenu } from '../types'
import { formatDayName, formatDate } from './menuGenerator'

export function exportMenuToPDF(menu: WeeklyMenu): void {
  const doc = new jsPDF()
  
  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const tableStartY = 40
  const rowHeight = 22 // Reduced to fit all 7 days on one page
  const availableWidth = pageWidth - 2 * margin
  const dayColWidth = availableWidth * 0.25 // Day column: 25% of available width
  const mealColWidth = availableWidth * 0.375 // Lunch/Dinner columns: 37.5% each
  
  // Title
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Weekly Meal Plan', pageWidth / 2, 20, { align: 'center' })
  
  // Week range
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  const weekRange = `${formatDate(menu.week_start)} - ${formatDate(menu.week_end)}`
  doc.text(weekRange, pageWidth / 2, 30, { align: 'center' })
  
  // Group menu items by day
  const itemsByDay = menu.menu_items.reduce((acc, item) => {
    if (!acc[item.day]) {
      acc[item.day] = { lunch: null, dinner: null }
    }
    if (item.meal_type === 'lunch') {
      acc[item.day].lunch = item
    } else if (item.meal_type === 'dinner') {
      acc[item.day].dinner = item
    }
    return acc
  }, {} as Record<string, { lunch: MenuItem | null; dinner: MenuItem | null }>)
  
  // Sort days chronologically
  const sortedDays = Object.keys(itemsByDay).sort((a, b) => {
    const dateA = new Date(a).getTime()
    const dateB = new Date(b).getTime()
    return dateA - dateB
  })
  
  let yPosition = tableStartY
  
  // Draw table header
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  
  // Header background (light gray rectangle)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, yPosition - 8, pageWidth - 2 * margin, 8, 'F')
  
  // Header text
  doc.text('Day', margin + 5, yPosition - 3)
  doc.text('Lunch', margin + dayColWidth + 5, yPosition - 3)
  doc.text('Dinner', margin + dayColWidth + mealColWidth + 5, yPosition - 3)
  
  yPosition += 2
  
  // Draw table rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  
  sortedDays.forEach((day) => {
    // Check if we need a new page
    if (yPosition + rowHeight > pageHeight - margin) {
      doc.addPage()
      yPosition = margin + 10
      
      // Redraw header on new page
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, yPosition - 8, pageWidth - 2 * margin, 8, 'F')
      doc.text('Day', margin + 5, yPosition - 3)
      doc.text('Lunch', margin + dayColWidth + 5, yPosition - 3)
      doc.text('Dinner', margin + dayColWidth + mealColWidth + 5, yPosition - 3)
      yPosition += 2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
    }
    
    const { lunch, dinner } = itemsByDay[day]
    const dayName = formatDayName(day)
    const dayDate = formatDate(day)
    
    // Draw row border
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.1)
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    
    // Day column
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(dayName, margin + 5, yPosition + 4)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(dayDate, margin + 5, yPosition + 9)
    doc.setTextColor(0, 0, 0)
    
    // Lunch column
    let lunchY = yPosition + 5
    doc.setFontSize(16) // Doubled from 8
    doc.setFont('helvetica', 'normal')
    if (lunch) {
      if (lunch.single) {
        doc.text(lunch.single, margin + dayColWidth + 5, lunchY, {
          maxWidth: mealColWidth - 10,
        })
      } else {
        if (lunch.starter) {
          doc.text(lunch.starter, margin + dayColWidth + 5, lunchY, {
            maxWidth: mealColWidth - 10,
          })
          lunchY += 11
        }
        if (lunch.main) {
          doc.text(lunch.main, margin + dayColWidth + 5, lunchY, {
            maxWidth: mealColWidth - 10,
          })
        }
      }
    }
    
    // Dinner column
    const dinnerY = yPosition + 5
    doc.setFontSize(16) // Doubled from 8
    doc.setFont('helvetica', 'normal')
    if (dinner && dinner.main) {
      doc.text(dinner.main, margin + dayColWidth + mealColWidth + 5, dinnerY, {
        maxWidth: mealColWidth - 10,
      })
    }
    
    // Draw vertical lines between columns
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.1)
    doc.line(margin + dayColWidth, yPosition, margin + dayColWidth, yPosition + rowHeight)
    doc.line(margin + dayColWidth + mealColWidth, yPosition, margin + dayColWidth + mealColWidth, yPosition + rowHeight)
    
    yPosition += rowHeight
  })
  
  // Draw bottom border
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.1)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  
  // Save the PDF
  const fileName = `meal-plan-${menu.week_start}-${menu.week_end}.pdf`
  doc.save(fileName)
}








