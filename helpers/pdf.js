const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs-extra');

// helper function to clean numbers
function cleanNumber(val) {
    if (val === undefined || val === null || val === '') return 0;
    let str = String(val).trim();

    // If it starts with '1' and rest is numeric, strip the first character
    if (str.startsWith('1') && str.length > 1 && !isNaN(str.slice(1))) {
        str = str.slice(1);
    }

    return Number(str);
}

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
                    sales: cleanNumber(day.dailyTotal).toFixed(2),
                    gst: cleanNumber(day.gst).toFixed(2),
                    totalAmountWithGST: cleanNumber(day.totalAmountWithGST).toFixed(2),
                    orders: day.orderCount,
                    items: day.items,
                    discounts: cleanNumber(day.discounts).toFixed(2)
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
                    `₹${cleanNumber(row.unitPrice).toFixed(2)}`,
                    `₹${cleanNumber(row.totalPrice).toFixed(2)}`,
                    cleanNumber(row.gst).toFixed(2),
                    `₹${cleanNumber(row.totalAmountWithGST).toFixed(2)}`
                ]);
            });
        } else {
            worksheet.addRow(['No product sales data', '', '', '', '', '', '']);
        }

        worksheet.addRow([]); // Empty row for spacing

        // Add summary section
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Period', `${period.startDate} to ${period.endDate}`]);
        worksheet.addRow(['Total Sales', `₹${cleanNumber(data.periodSales.total).toFixed(2)}`]);
        worksheet.addRow(['Total GST', `₹${cleanNumber(data.periodSales.gst).toFixed(2)}`]);
        worksheet.addRow(['Total Amount (with GST)', `₹${cleanNumber(data.periodSales.totalAmountWithGST).toFixed(2)}`]);
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
        doc.text(`Total Sales: ₹${cleanNumber(data.periodSales?.total).toFixed(2)}`);
        doc.text(`Total GST: ₹${cleanNumber(data.periodSales?.gst).toFixed(2)}`);
        doc.text(`Total Amount (with GST): ₹${cleanNumber(data.periodSales?.totalAmountWithGST).toFixed(2)}`);
        doc.text(`Total Orders: ${data.periodSales?.orders ?? '0'}`);
        doc.text(`Total Items Sold: ${data.periodSales?.items ?? '0'}`);
        doc.moveDown(1.5);

        // Daily Sales Table
        doc.fontSize(14).font('Helvetica-Bold').text('Daily Sales Breakdown', { underline: true });
        doc.moveDown(0.5);

        const tableHeaders = ['Date', 'Sales (₹)', 'GST (₹)', 'Total Amount (₹)', 'Orders', 'Items'];
        const colWidths = [80, 70, 70, 90, 60, 60];
        let tableX = 50;
        let tableY = doc.y;

        tableHeaders.forEach((header, i) => {
            doc.rect(tableX, tableY, colWidths[i], 22).fillAndStroke('#f0f0f0', '#cccccc');
            doc.fillColor('#000').font('Helvetica-Bold').fontSize(11)
                .text(header, tableX + 4, tableY + 6, { width: colWidths[i] - 8, align: 'center' });
            tableX += colWidths[i];
        });

        tableX = 50;
        tableY += 22;

        if (data.dailySales && data.dailySales.length > 0) {
            data.dailySales.forEach(day => {
                let values = [
                    day._id ?? '',
                    `₹${cleanNumber(day.dailyTotal).toFixed(2)}`,
                    `₹${cleanNumber(day.gst).toFixed(2)}`,
                    `₹${cleanNumber(day.totalAmountWithGST).toFixed(2)}`,
                    day.orderCount ?? '0',
                    day.items ?? '0'
                ];
                values.forEach((val, i) => {
                    doc.rect(tableX, tableY, colWidths[i], 20).stroke('#cccccc');
                    doc.font('Helvetica').fontSize(10).fillColor('#222')
                        .text(val, tableX + 4, tableY + 5, { width: colWidths[i] - 8, align: 'center' });
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
                    row.productName ?? '',
                    row.quantity ?? '0',
                    row.size ?? '',
                    `₹${cleanNumber(row.unitPrice).toFixed(2)}`,
                    `₹${cleanNumber(row.totalPrice).toFixed(2)}`,
                    `₹${cleanNumber(row.gst).toFixed(2)}`,
                    `₹${cleanNumber(row.totalAmountWithGST).toFixed(2)}`
                ];
                values.forEach((val, i) => {
                    doc.rect(prodX, prodY, prodColWidths[i], 20).stroke('#cccccc');
                    doc.font('Helvetica').fontSize(10).fillColor('#222')
                        .text(val, prodX + 4, prodY + 5, { width: prodColWidths[i] - 8, align: 'center' });
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
