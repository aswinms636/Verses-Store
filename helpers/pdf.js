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
        doc.text(`Total GST: ₹${data.periodSales.gst}`);
        doc.text(`Total Amount (with GST): ₹${data.periodSales.totalAmountWithGST}`);
        doc.text(`Total Orders: ${data.periodSales.orders}`);
        doc.text(`Total Items Sold: ${data.periodSales.items}`);
        doc.moveDown();

        // Add daily sales table
        doc.fontSize(14).text('Daily Sales Breakdown');
        doc.moveDown();

        // Table headers
        const tableTop = doc.y;
        const tableHeaders = ['Date', 'Sales (₹)', 'GST (₹)', 'Total Amount (₹)', 'Orders', 'Items'];
        const columnWidth = 90;

        tableHeaders.forEach((header, i) => {
            doc.font('Helvetica-Bold').text(header, 50 + (i * columnWidth), tableTop);
        });

        let rowTop = tableTop + 20;
        if (data.dailySales && data.dailySales.length > 0) {
            data.dailySales.forEach(day => {
                doc.font('Helvetica').text(day._id, 50, rowTop);
                doc.text(day.dailyTotal.toString(), 50 + columnWidth, rowTop);
                doc.text(day.gst.toString(), 50 + (2 * columnWidth), rowTop);
                doc.text(day.totalAmountWithGST.toString(), 50 + (3 * columnWidth), rowTop);
                doc.text(day.orderCount.toString(), 50 + (4 * columnWidth), rowTop);
                doc.text(day.items.toString(), 50 + (5 * columnWidth), rowTop);
                rowTop += 20;
            });
        } else {
            doc.font('Helvetica').text('No daily sales data', 50, rowTop);
            rowTop += 20;
        }

        doc.moveDown(2);

        // Product Sales Table
        doc.fontSize(14).text('Product Sales Report');
        doc.moveDown(0.5);

        // Product table headers
        const prodTableTop = doc.y;
        const prodHeaders = ['Product Name', 'Quantity', 'Size', 'Unit Price', 'GST (₹)', 'Total Amount (₹)']; // Removed 'Total Price'
        const prodColWidths = [120, 60, 60, 80, 70, 90]; // Adjusted widths

        let x = 50;
        prodHeaders.forEach((header, i) => {
            doc.font('Helvetica-Bold').text(header, x, prodTableTop);
            x += prodColWidths[i];
        });

        let prodRowTop = prodTableTop + 20;
        if (data.productSales && data.productSales.length > 0) {
            data.productSales.forEach(row => {
                let x = 50;
                doc.font('Helvetica').text(row.productName, x, prodRowTop, { width: prodColWidths[0] });
                x += prodColWidths[0];
                doc.text(row.quantity, x, prodRowTop, { width: prodColWidths[1], align: 'right' });
                x += prodColWidths[1];
                doc.text(row.size || '', x, prodRowTop, { width: prodColWidths[2], align: 'center' });
                x += prodColWidths[2];
                doc.text(row.unitPrice ? `₹${Number(row.unitPrice).toFixed(2)}` : '', x, prodRowTop, { width: prodColWidths[3], align: 'right' });
                x += prodColWidths[3];
                doc.text(row.gst ? `₹${Number(row.gst).toFixed(2)}` : '', x, prodRowTop, { width: prodColWidths[4], align: 'right' });
                x += prodColWidths[4];
                doc.text(row.totalAmountWithGST ? `₹${Number(row.totalAmountWithGST).toFixed(2)}` : '', x, prodRowTop, { width: prodColWidths[5], align: 'right' });
                prodRowTop += 20;
            });
        } else {
            doc.font('Helvetica').text('No product sales data', 50, prodRowTop);
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