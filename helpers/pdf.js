const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs-extra');

class ReportGenerator {
    static async generateExcel(data, period) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Daily Sales Table
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Sales (₹)', key: 'sales', width: 15 },
            { header: 'GST (₹)', key: 'gst', width: 12 },
            { header: 'Total Amount (₹)', key: 'totalAmountWithGST', width: 18 },
            { header: 'Orders', key: 'orders', width: 12 },
            { header: 'Items Sold', key: 'items', width: 12 },
            { header: 'Discounts (₹)', key: 'discounts', width: 15 }
        ];

        // Add daily sales data
        if (data.dailySales && data.dailySales.length > 0) {
            data.dailySales.forEach(day => {
                worksheet.addRow({
                    date: day._id,
                    sales: day.dailyTotal,
                    gst: day.gst,
                    totalAmountWithGST: day.totalAmountWithGST,
                    orders: day.orderCount,
                    items: day.items,
                    discounts: day.discounts || 0
                });
            });
        } else {
            worksheet.addRow({ date: 'No data', sales: '', gst: '', totalAmountWithGST: '', orders: '', items: '', discounts: '' });
        }

        worksheet.addRow([]); // Empty row for spacing

        // Product Sales Table
        worksheet.addRow(['Product Sales Report']);
        worksheet.addRow(['Product Name', 'Quantity', 'Size', 'Unit Price', 'Total Price', 'GST (₹)', 'Total Amount (₹)']);
        if (data.productSales && data.productSales.length > 0) {
            data.productSales.forEach(row => {
                worksheet.addRow([
                    row.productName,
                    row.quantity,
                    row.size || '',
                    row.unitPrice ? `₹${Number(row.unitPrice).toFixed(2)}` : '',
                    row.totalPrice ? `₹${Number(row.totalPrice).toFixed(2)}` : '',
                    row.gst,
                    row.totalAmountWithGST ? `₹${Number(row.totalAmountWithGST).toFixed(2)}` : ''
                ]);
            });
        } else {
            worksheet.addRow(['No product sales data', '', '', '', '', '', '']);
        }

        worksheet.addRow([]); // Empty row for spacing

        // Add summary section
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Period', `${period.startDate} to ${period.endDate}`]);
        worksheet.addRow(['Total Sales', `₹${data.periodSales.total}`]);
        worksheet.addRow(['Total GST', `₹${data.periodSales.gst}`]);
        worksheet.addRow(['Total Amount (with GST)', `₹${data.periodSales.totalAmountWithGST}`]);
        worksheet.addRow(['Total Orders', data.periodSales.orders]);
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
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {});

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
        doc.moveDown(1.5);

        // Period
        doc.fontSize(12).font('Helvetica').text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.moveDown(1);

        // Summary
        doc.fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica');
        doc.text(`Total Sales: ₹${data.periodSales.total}`);
        doc.text(`Total GST: ₹${data.periodSales.gst}`);
        doc.text(`Total Amount (with GST): ₹${data.periodSales.totalAmountWithGST}`);
        doc.text(`Total Orders: ${data.periodSales.orders}`);
        doc.text(`Total Items Sold: ${data.periodSales.items}`);
        doc.moveDown(1.5);

        // Daily Sales Table
        doc.fontSize(14).font('Helvetica-Bold').text('Daily Sales Breakdown', { underline: true });
        doc.moveDown(0.5);

        // Table headers
        const tableHeaders = ['Date', 'Sales (₹)', 'GST (₹)', 'Total Amount (₹)', 'Orders', 'Items'];
        const colWidths = [80, 70, 70, 90, 60, 60];
        let tableX = 50;
        let tableY = doc.y;

        // Draw header row
        tableHeaders.forEach((header, i) => {
            doc.rect(tableX, tableY, colWidths[i], 22).fillAndStroke('#f0f0f0', '#cccccc');
            doc.fillColor('#000').font('Helvetica-Bold').fontSize(11)
                .text(header, tableX + 4, tableY + 6, { width: colWidths[i] - 8, align: 'center' });
            tableX += colWidths[i];
        });

        tableX = 50;
        tableY += 22;

        // Draw data rows
        if (data.dailySales && data.dailySales.length > 0) {
            data.dailySales.forEach(day => {
                let values = [
                    day._id,
                    day.dailyTotal,
                    day.gst,
                    day.totalAmountWithGST,
                    day.orderCount,
                    day.items
                ];
                values.forEach((val, i) => {
                    doc.rect(tableX, tableY, colWidths[i], 20).stroke('#cccccc');
                    doc.font('Helvetica').fontSize(10).fillColor('#222')
                        .text(val !== undefined ? val.toString() : '', tableX + 4, tableY + 5, { width: colWidths[i] - 8, align: 'center' });
                    tableX += colWidths[i];
                });
                tableX = 50;
                tableY += 20;
            });
        } else {
            doc.rect(tableX, tableY, colWidths.reduce((a, b) => a + b), 20).stroke('#cccccc');
            doc.font('Helvetica').fontSize(10).fillColor('#222')
                .text('No daily sales data', tableX + 4, tableY + 5, { width: colWidths.reduce((a, b) => a + b) - 8, align: 'center' });
            tableY += 20;
        }

        doc.y = tableY + 20;
        doc.moveDown(1);

        // Product Sales Table
        doc.fontSize(14).font('Helvetica-Bold').text('Product Sales Report', { underline: true });
        doc.moveDown(0.5);

        // Product table headers
        const prodHeaders = ['Product Name', 'Quantity', 'Size', 'Unit Price', 'Total Price', 'GST (₹)', 'Total Amount (₹)'];
        const prodColWidths = [120, 60, 60, 70, 70, 70, 90];
        let prodX = 50;
        let prodY = doc.y;

        prodHeaders.forEach((header, i) => {
            doc.rect(prodX, prodY, prodColWidths[i], 22).fillAndStroke('#f0f0f0', '#cccccc');
            doc.fillColor('#000').font('Helvetica-Bold').fontSize(11)
                .text(header, prodX + 4, prodY + 6, { width: prodColWidths[i] - 8, align: 'center' });
            prodX += prodColWidths[i];
        });

        prodX = 50;
        prodY += 22;

        if (data.productSales && data.productSales.length > 0) {
            data.productSales.forEach(row => {
                let values = [
                    row.productName,
                    row.quantity,
                    row.size || '',
                    row.unitPrice ? `₹${Number(row.unitPrice).toFixed(2)}` : '',
                    row.totalPrice ? `₹${Number(row.totalPrice).toFixed(2)}` : '',
                    row.gst ? `₹${Number(row.gst).toFixed(2)}` : '',
                    row.totalAmountWithGST ? `₹${Number(row.totalAmountWithGST).toFixed(2)}` : ''
                ];
                values.forEach((val, i) => {
                    doc.rect(prodX, prodY, prodColWidths[i], 20).stroke('#cccccc');
                    doc.font('Helvetica').fontSize(10).fillColor('#222')
                        .text(val !== undefined ? val.toString() : '', prodX + 4, prodY + 5, { width: prodColWidths[i] - 8, align: 'center' });
                    prodX += prodColWidths[i];
                });
                prodX = 50;
                prodY += 20;
            });
        } else {
            doc.rect(prodX, prodY, prodColWidths.reduce((a, b) => a + b), 20).stroke('#cccccc');
            doc.font('Helvetica').fontSize(10).fillColor('#222')
                .text('No product sales data', prodX + 4, prodY + 5, { width: prodColWidths.reduce((a, b) => a + b) - 8, align: 'center' });
            prodY += 20;
        }

        doc.end();

        return new Promise(resolve => {
            doc.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });
    }
}

module.exports = ReportGenerator;