import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportOrderPDF(customer, products, orderItems, orderDate) {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text(`Order Sheet — ${customer.customer_name}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Date: ${orderDate}`, 14, 22);

  const rows = [];

  products.forEach((p) => {
    const item = orderItems.find((i) => i.product_id === p.id);
    const qty = item?.quantity || 0;
    const total = qty * Number(p.unit_price);

    rows.push([
      p.item_code,
      p.description,
      p.grade,
      p.ml,
      p.unit_price,
      qty,
      total.toFixed(2),
    ]);
  });

  autoTable(doc, {
    head: [["Code", "Description", "Grade", "mL", "Unit Price", "Qty", "Total"]],
    body: rows,
    startY: 30,
  });

  doc.save(`Order-${customer.customer_name}-${orderDate}.pdf`);
}

