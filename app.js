document.addEventListener("DOMContentLoaded", async () => {

  const SUPABASE_URL = "https://natanfcuphvowlbdmgig.supabase.co";
  const SUPABASE_KEY = "sb_publishable_fG_pMsQyfHz4EUnWzwoLmQ_QGOgFPl_";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let products = [];
  let cart = [];

  /* ---------------- LOAD PRODUCTS ---------------- */
  const menuDropdown = document.getElementById("menu-dropdown");

  async function loadProducts() {
    const { data, error } = await supabase.from("products").select("*");
    if (error) {
      console.error(error);
      alert("Product load failed");
      return;
    }
    products = data;
    menuDropdown.innerHTML = "<option value=''>Select item</option>";
    products.forEach(product => {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent = `${product.name} - R${product.price}`;
      menuDropdown.appendChild(option);
    });
  }

  await loadProducts();

  /* ---------------- CART ---------------- */
  const qtyInput = document.getElementById("menu-qty");
  const addBtn = document.getElementById("add-to-cart");
  const cartTable = document.getElementById("cart-items");
  const totalDisplay = document.querySelector(".total");

  addBtn.addEventListener("click", () => {
    const productId = menuDropdown.value;
    const qty = Number(qtyInput.value);
    if (!productId || qty <= 0) {
      alert("Select product and quantity");
      return;
    }
    const product = products.find(p => p.id == productId);
    const existing = cart.find(i => i.id == productId);
    if (existing) existing.quantity += qty;
    else cart.push({ id: product.id, name: product.name, price: product.price, quantity: qty });
    renderCart();
  });

  function renderCart() {
    cartTable.innerHTML = "";
    let total = 0;
    cart.forEach(item => {
      const row = document.createElement("tr");
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      row.innerHTML = `
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>R${itemTotal}</td>
      `;
      cartTable.appendChild(row);
    });
    totalDisplay.textContent = `Total: R${total}`;
  }

  /* ---------------- CHECKOUT ---------------- */
  const checkoutBtn = document.getElementById("checkout");

  checkoutBtn.addEventListener("click", async () => {
    const customerName = document.getElementById("customer-name").value;
    const customerPhone = document.getElementById("customer-phone").value;
    const customerArea = document.getElementById("customer-area").value;

    if (!customerName || !customerPhone || !customerArea) {
      alert("Enter customer details");
      return;
    }

    if (cart.length === 0) {
      alert("Cart empty");
      return;
    }

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("*")
      .eq("cell_number", customerPhone)
      .maybeSingle();

    let customerId;
    if (!existingCustomer) {
      const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert([{ full_name: customerName, cell_number: customerPhone, area: customerArea }])
        .select()
        .single();
      if (error) {
        console.error(error);
        alert("Customer save failed");
        return;
      }
      customerId = newCustomer.id;
    } else customerId = existingCustomer.id;

    const totalAmount = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

    const { error: saleError } = await supabase.from("sales").insert([{
      customer_id: customerId,
      total_amount: totalAmount,
      total_items: totalItems,
      date_time: new Date().toISOString()
    }]);

    if (saleError) {
      console.error(saleError);
      alert("Sale failed");
      return;
    }

    alert("Checkout successful");
    cart = [];
    renderCart();
    loadTotals();
  });

  /* ---------------- EXPENSES ---------------- */
  const expenseBtn = document.getElementById("add-expense");

  expenseBtn.addEventListener("click", async () => {
    const type = document.getElementById("expense-type").value;
    const amount = Number(document.getElementById("expense-amount").value);
    const desc = document.getElementById("expense-description").value;

    if (!type || !amount) {
      alert("Enter expense details");
      return;
    }

    const { error } = await supabase.from("expenses").insert([{
      type,
      amount,
      description: desc,
      date_time: new Date().toISOString()
    }]);

    if (error) {
      console.error(error);
      alert("Expense failed");
      return;
    }

    alert("Expense saved");
    document.getElementById("expense-type").value = "";
    document.getElementById("expense-amount").value = "";
    document.getElementById("expense-description").value = "";
    loadTotals();
  });

  /* ---------------- TOTALS ---------------- */
  const salesTotal = document.querySelector(".sales-total");
  const expensesTotal = document.querySelector(".expenses-total");
  const profitTotal = document.querySelector(".profit-total");

  async function loadTotals() {
    const { data: sales } = await supabase.from("sales").select("*");
    const { data: expenses } = await supabase.from("expenses").select("*");

    const totalSales = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    salesTotal.textContent = `Total Sales: R${totalSales}`;
    expensesTotal.textContent = `Total Expenses: R${totalExpenses}`;
    profitTotal.textContent = `Profit: R${totalSales - totalExpenses}`;
  }

  await loadTotals();

  /* ---------------- DOWNLOAD PDF ---------------- */
  const downloadBtn = document.getElementById("download-report");

  downloadBtn.addEventListener("click", async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const { data: sales } = await supabase.from("sales").select("*");
    const { data: expenses } = await supabase.from("expenses").select("*");

    const totalSales = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = totalSales - totalExpenses;

    doc.setFontSize(16);
    doc.text("Ms Seafood Boil POS Report", 10, 10);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleString()}`, 10, 20);
    doc.text(`Total Sales: R${totalSales}`, 10, 30);
    doc.text(`Total Expenses: R${totalExpenses}`, 10, 40);
    doc.text(`Profit: R${profit}`, 10, 50);

    doc.text("Sales Details:", 10, 60);
    sales.forEach((s, idx) => {
      doc.text(`${idx + 1}. Sale ID: ${s.id}, Total: R${s.total_amount}, Items: ${s.total_items}`, 10, 70 + idx * 10);
    });

    doc.text("Expenses Details:", 10, 80 + sales.length * 10);
    expenses.forEach((e, idx) => {
      doc.text(`${idx + 1}. ${e.type} - R${e.amount} - ${e.description}`, 10, 90 + sales.length * 10 + idx * 10);
    });

    doc.save(`POS_Report_${new Date().toISOString()}.pdf`);
  });

});