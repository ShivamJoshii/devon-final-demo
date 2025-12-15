import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportOrderPDF(customer, products, orderItems, orderDate) {
  const doc = new jsPDF("p", "mm", "letter");

  let y = 10;

  // ---------- LOGO ----------
  try {
    doc.addImage("/turkey-hill-logo.png", "PNG", 10, y, 25, 25);
  } catch (e) {
    // logo optional, fail silently
  }

  // ---------- COMPANY HEADER ----------
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TURKEY HILL SUGARBUSH", 105, y + 6, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("1037 Boul. Industriel, Granby, QC J2J 2B8", 105, y + 12, {
    align: "center",
  });
  doc.text("Tel: 450-539-4822   Website: www.turkeyhill.ca", 105, y + 17, {
    align: "center",
  });
  doc.text("Please send your order to: orders@turkeyhill.ca", 105, y + 22, {
    align: "center",
  });

  y += 32;

  // ---------- TITLE ----------
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CANADIAN WHOLESALE PRICE LIST", 105, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  doc.text(`Date: ${orderDate}`, 14, y);
  y += 6;

  // ---------- SOLD TO / SHIP TO ----------
  const boxTop = y;
  const boxHeight = 34;

  doc.setFont("helvetica", "bold");
  doc.text("Sold to:", 14, boxTop);
  doc.text("Ship to:", 110, boxTop);

  doc.setFont("helvetica", "normal");

  const soldToY = boxTop + 6;

  doc.text(customer.customer_name || "", 14, soldToY);
  doc.text(customer.address || "", 14, soldToY + 6);
  doc.text(customer.postal_code || "", 14, soldToY + 12);
  doc.text(customer.phone || "", 14, soldToY + 18);
  doc.text(customer.email || "", 14, soldToY + 24);

  // mirror ship-to for now
  doc.text(customer.customer_name || "", 110, soldToY);
  doc.text(customer.address || "", 110, soldToY + 6);
  doc.text(customer.postal_code || "", 110, soldToY + 12);
  doc.text(customer.phone || "", 110, soldToY + 18);
  doc.text(customer.email || "", 110, soldToY + 24);

  // Draw boxes
  doc.rect(12, boxTop - 4, 86, boxHeight);
  doc.rect(108, boxTop - 4, 86, boxHeight);

  y = boxTop + boxHeight + 6;

  // ---------- NOTES ----------
  doc.setFont("helvetica", "bold");
  doc.text("NOTES:", 14, y);
  doc.rect(14, y + 2, 180, 12);
  y += 18;

  // ---------- GROUP PRODUCTS BY CATEGORY ----------
  const productsByCategory = {};
  products.forEach((p) => {
    const cat = p.category || "Uncategorized";
    if (!productsByCategory[cat]) productsByCategory[cat] = [];
    productsByCategory[cat].push(p);
  });

  const body = [];

  Object.entries(productsByCategory).forEach(([category, items]) => {
    body.push([
      {
        content: category,
        colSpan: 7,
        styles: {
          fontStyle: "bold",
          fillColor: [230, 230, 230],
        },
      },
    ]);

    items.forEach((p) => {
      const item = orderItems.find((i) => i.product_id === p.id);
      const qty = item?.quantity || "";
      const total =
        qty !== "" ? (qty * Number(p.unit_price)).toFixed(2) : "";

      body.push([
        p.item_code,
        p.description,
        p.grade,
        p.ml,
        Number(p.unit_price).toFixed(2),
        qty,
        total,
      ]);
    });
  });

  // ---------- TABLE ----------
  autoTable(doc, {
    startY: y,
    head: [["Code", "Description", "Grade", "mL", "Unit Price", "Qty", "Total"]],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: 255,
      fontStyle: "bold",
    },
  });

  // ---------- SAVE ----------
  doc.save(`Order-${customer.customer_name}-${orderDate}.pdf`);
}
