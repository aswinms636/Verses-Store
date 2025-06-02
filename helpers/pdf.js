const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs-extra');

class ReportGenerator {
    static async generateExcel(data, period) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Set headers
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Sales (₹)', key: 'sales', width: 15 },
            { header: 'Orders', key: 'orders', width: 12 },
            { header: 'Items Sold', key: 'items', width: 12 },
            { header: 'Discounts (₹)', key: 'discounts', width: 15 }
        ];

        // Add data rows
        data.dailySales.forEach(day => {
            worksheet.addRow({
                date: day._id,
                sales: day.dailyTotal,
                orders: day.orderCount,
                items: day.items,
                discounts: day.discounts || 0
            });
        });

        // Add summary section
        worksheet.addRow([]); // Empty row for spacing
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Period', `${period.startDate} to ${period.endDate}`]);
        worksheet.addRow(['Total Sales', `₹${data.periodSales.total}`]);
        worksheet.addRow(['Total Orders', data.periodSales.orders]);
        worksheet.addRow(['Average Order Value', `₹${data.periodSales.averageOrder}`]);
        worksheet.addRow(['Total Items Sold', data.periodSales.items]);

        // Style the headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }

    static async generatePDF(data, period) {
        const doc = new PDFDocument();
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {});

        // Add title
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();

        // Add period
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`);
        doc.moveDown();

        // Add summary
        doc.fontSize(14).text('Summary');
        doc.fontSize(12);
        doc.text(`Total Sales: ₹${data.periodSales.total}`);
        doc.text(`Total Orders: ${data.periodSales.orders}`);
        doc.text(`Average Order Value: ₹${data.periodSales.averageOrder}`);
        doc.text(`Total Items Sold: ${data.periodSales.items}`);
        doc.moveDown();

        // Add daily sales table
        doc.fontSize(14).text('Daily Sales Breakdown');
        doc.moveDown();

        // Create table headers
        const tableTop = doc.y;
        const tableHeaders = ['Date', 'Sales (₹)', 'Orders', 'Items'];
        const columnWidth = 150;

        // Draw headers
        tableHeaders.forEach((header, i) => {
            doc.text(header, 50 + (i * columnWidth), tableTop);
        });

        // Draw data rows
        let rowTop = tableTop + 20;
        data.dailySales.forEach(day => {
            doc.text(day._id, 50, rowTop);
            doc.text(day.dailyTotal.toString(), 50 + columnWidth, rowTop);
            doc.text(day.orderCount.toString(), 50 + (2 * columnWidth), rowTop);
            doc.text(day.items.toString(), 50 + (3 * columnWidth), rowTop);
            rowTop += 20;
        });

        doc.end();

        return new Promise(resolve => {
            doc.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });
    }
}

module.exports = ReportGenerator;