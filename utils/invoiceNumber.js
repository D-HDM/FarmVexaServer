function generateInvoiceNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const time = Date.now().toString().slice(-4);
    return `FVX-${year}${month}${day}-${time}${random}`;
}

module.exports = { generateInvoiceNumber };