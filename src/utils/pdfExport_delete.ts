import jsPDF from 'jspdf'
import { MenuItem, WeeklyMenu } from '../types'
import { formatDayName, formatDate } from './menuGenerator'

export function exportMenuToPDF(menu: WeeklyMenu): void {
  const doc = new jsPDF()
  
  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const headerTop = 25
  const tableStartY = 50
  
  // Colors (matching template)
  const tealColor = [23, 162, 184] // Teal for borders and day badges
  const greenColor = [40, 167, 69] // Green for "MEAL PLANNER"
  const orangeColor = [255, 152, 0] // Orange for "MY"
  const grayColor = [108, 117, 125] // Gray for week text
  
  // Calculate column widths
  const availableWidth = pageWidth - 2 * margin
  const dayColWidth = availableWidth * 0.2 // Day column: 20% of available width
  const mealColWidth = availableWidth * 0.4 // Lunch/Dinner columns: 40% each
  
  // Title: "MY MEAL PLANNER"
  // "MY" in smaller orange font
  doc.setFontSize(14)
  doc.setTextColor(orangeColor[0], orangeColor[1], orangeColor[2])
  doc.setFont('helvetica', 'normal')
  const myText = 'MY'
  const myWidth = doc.getTextWidth(myText)
  doc.text(myText, (pageWidth - myWidth) / 2, headerTop - 5)
  
  // "MEAL PLANNER" in bold green
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(greenColor[0], greenColor[1], greenColor[2])
  doc.text('MEAL PLANNER', pageWidth / 2, headerTop + 5, { align: 'center' })
  
  // Week range: "Week: 20 Dec to 26 Dec"
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2])
  const weekStart = formatDate(menu.week_start)
  const weekEnd = formatDate(menu.week_end)
  const weekRange = `Week: ${weekStart} to ${weekEnd}`
  doc.text(weekRange, pageWidth / 2, headerTop + 15, { align: 'center' })
  
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
  
  // Draw column headers
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Lunch', margin + dayColWidth + 10, yPosition - 5)
  doc.text('Dinner', margin + dayColWidth + mealColWidth + 10, yPosition - 5)
  
  yPosition += 5
  
  // Row height for each day
  const rowHeight = 28
  
  // Draw table rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  
  sortedDays.forEach((day) => {
    // Check if we need a new page
    if (yPosition + rowHeight > pageHeight - margin) {
      doc.addPage()
      yPosition = margin + 15
      
      // Redraw headers on new page
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Lunch', margin + dayColWidth + 10, yPosition - 5)
      doc.text('Dinner', margin + dayColWidth + mealColWidth + 10, yPosition - 5)
      yPosition += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
    }
    
    const { lunch, dinner } = itemsByDay[day]
    const dayName = formatDayName(day)
    
    // Day column: Draw teal badge/rectangle
    const badgeHeight = rowHeight - 4
    const badgeY = yPosition + 2
    doc.setFillColor(tealColor[0], tealColor[1], tealColor[2])
    doc.rect(margin + 5, badgeY, dayColWidth - 10, badgeHeight, 'F')
    
    // Day name text (white, centered in badge)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    const dayTextY = badgeY + badgeHeight / 2 + 3
    doc.text(dayName, margin + dayColWidth / 2, dayTextY, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    
    // Lunch column: Draw white box with teal border
    const lunchBoxX = margin + dayColWidth + 5
    const lunchBoxY = yPosition + 2
    const lunchBoxWidth = mealColWidth - 10
    const lunchBoxHeight = rowHeight - 4
    
    doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2])
    doc.setLineWidth(0.5)
    doc.setFillColor(255, 255, 255)
    doc.rect(lunchBoxX, lunchBoxY, lunchBoxWidth, lunchBoxHeight, 'FD')
    
    // Lunch dishes with fork/knife icon
    let lunchTextY = lunchBoxY + 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100) // Light gray for icon
    const iconSpacing = 8
    
    if (lunch) {
      if (lunch.single) {
        doc.text('•', lunchBoxX + 5, lunchTextY) // Fork/knife icon representation
        doc.setTextColor(0, 0, 0)
        doc.text(lunch.single, lunchBoxX + 5 + iconSpacing, lunchTextY, {
          maxWidth: lunchBoxWidth - 15 - iconSpacing,
        })
      } else {
        if (lunch.starter) {
          doc.text('•', lunchBoxX + 5, lunchTextY) // Fork/knife icon
          doc.setTextColor(0, 0, 0)
          doc.text(lunch.starter, lunchBoxX + 5 + iconSpacing, lunchTextY, {
            maxWidth: lunchBoxWidth - 15 - iconSpacing,
          })
          lunchTextY += 8
        }
        if (lunch.main) {
          doc.setTextColor(100, 100, 100)
          doc.text('•', lunchBoxX + 5, lunchTextY) // Fork/knife icon
          doc.setTextColor(0, 0, 0)
          doc.text(lunch.main, lunchBoxX + 5 + iconSpacing, lunchTextY, {
            maxWidth: lunchBoxWidth - 15 - iconSpacing,
          })
        }
      }
    }
    
    // Dinner column: Draw white box with teal border
    const dinnerBoxX = margin + dayColWidth + mealColWidth + 5
    const dinnerBoxY = yPosition + 2
    const dinnerBoxWidth = mealColWidth - 10
    const dinnerBoxHeight = rowHeight - 4
    
    doc.setDrawColor(tealColor[0], tealColor[1], tealColor[2])
    doc.setLineWidth(0.5)
    doc.setFillColor(255, 255, 255)
    doc.rect(dinnerBoxX, dinnerBoxY, dinnerBoxWidth, dinnerBoxHeight, 'FD')
    
    // Dinner dish with pot/pan icon
    const dinnerTextY = dinnerBoxY + 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    if (dinner && dinner.main) {
      doc.setTextColor(100, 100, 100) // Light gray for icon
      doc.text('○', dinnerBoxX + 5, dinnerTextY) // Pot/pan icon representation
      doc.setTextColor(0, 0, 0)
      doc.text(dinner.main, dinnerBoxX + 5 + iconSpacing, dinnerTextY, {
        maxWidth: dinnerBoxWidth - 15 - iconSpacing,
      })
    }
    
    yPosition += rowHeight
  })
  
  // Save the PDF
  const fileName = `meal-plan-${menu.week_start}-${menu.week_end}.pdf`
  doc.save(fileName)
}








