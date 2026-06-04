// TRANSLATE 3D Inventory System - Google Apps Script Integration
// NO Commission (Internal Control Only)

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbytEHxRNsow825U2-h5yvmqTrr3OVoMl9GU7DkZlqVSundQnWEEX6p53ag9XfX4DO7D4A/exec';
const COMMISSION_RATE = 0.00; // NO commission

let products = [];
let salesData = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadProductsFromAppsScript();
  loadSalesFromLocalStorage();
  renderProductGrid();
  updateDailySummary();
});

// Fetch products from Google Apps Script
async function loadProductsFromAppsScript() {
  try {
    const response = await fetch(APPS_SCRIPT_URL);
    const result = await response.json();
    
    if (result.success && result.data) {
      // Skip header row and parse products
      // Column mapping: A=Categoria, B=Producto, C=Precio, D=Cantidad, E=vendidos, F=venta
      products = result.data.slice(1).map((row, index) => ({
        id: index,
        name: row[1] || 'Unknown',           // Producto (column B)
        price: parseFloat(row[2]) || 0,      // Precio (column C)
        quantity: parseInt(row[3]) || 0,     // Cantidad (column D)
        category: row[0] || 'General',       // Categoria (column A)
        description: ''
      }));
      
      console.log('✅ Products loaded from Apps Script:', products.length);
      renderProductGrid();
    } else {
      console.error('Invalid response from Apps Script:', result);
      alert('Error loading products. Check console.');
    }
  } catch (error) {
    console.error('Error loading products from Apps Script:', error);
    alert('Error loading products. Check your connection.');
  }
}

// Render product grid
function renderProductGrid() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  
  if (products.length === 0) {
    grid.innerHTML = '<div class="loading">No products found. Check your Google Sheet.</div>';
    return;
  }
  
  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <h3>${product.name}</h3>
      <p class="price">$${product.price.toFixed(2)}</p>
      <p class="quantity">Stock: ${product.quantity}</p>
      <p class="category">${product.category}</p>
      <button onclick="openSaleModal(${product.id})" ${product.quantity <= 0 ? 'disabled' : ''}>Record Sale</button>
    `;
    grid.appendChild(card);
  });
}

// Open sale recording modal
function openSaleModal(productId) {
  const product = products[productId];
  if (product.quantity <= 0) return;
  
  document.getElementById('modalProductName').textContent = product.name;
  document.getElementById('modalProductPrice').textContent = `$${product.price.toFixed(2)}`;
  document.getElementById('saleQuantity').value = 1;
  document.getElementById('saleQuantity').max = product.quantity;
  document.getElementById('saleModal').style.display = 'flex';
  document.getElementById('saleModal').dataset.productId = productId;
  
  // Trigger calculation update
  document.getElementById('saleQuantity').dispatchEvent(new Event('input'));
}

// Close modal
function closeModal() {
  document.getElementById('saleModal').style.display = 'none';
}

// Calculate total
function calculateTotal() {
  const productId = parseInt(document.getElementById('saleModal').dataset.productId);
  const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
  const product = products[productId];
  const total = product.price * quantity;
  document.getElementById('saleTotal').textContent = `$${total.toFixed(2)}`;
}

// Record sale
function recordSale() {
  const productId = parseInt(document.getElementById('saleModal').dataset.productId);
  const quantity = parseInt(document.getElementById('saleQuantity').value);
  const product = products[productId];
  
  if (quantity <= 0 || quantity > product.quantity) {
    alert('Invalid quantity');
    return;
  }
  
  const totalSale = product.price * quantity;
  const commission = totalSale * COMMISSION_RATE;
  const deliveryAmount = totalSale - commission;
  
  const sale = {
    id: Date.now(),
    productId: productId,
    productName: product.name,
    quantity: quantity,
    unitPrice: product.price,
    totalSale: totalSale,
    commission: commission,
    deliveryAmount: deliveryAmount,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString()
  };
  
  salesData.push(sale);
  saveSalesToLocalStorage();
  
  // Update product stock locally
  product.quantity -= quantity;
  
  // Send to Apps Script
  sendSaleToAppsScript(sale);
  
  updateDailySummary();
  renderProductGrid();
  closeModal();
  
  // Show confirmation
  alert(`✅ Sale recorded!\nProduct: ${product.name}\nQuantity: ${quantity}\nTotal: $${totalSale.toFixed(2)}`);
}

// Send sale to Apps Script
async function sendSaleToAppsScript(sale) {
  try {
    const payload = {
      fecha: sale.date,
      hora: new Date(sale.timestamp).toLocaleTimeString(),
      producto: sale.productName,
      cantidad: sale.quantity,
      precioUnitario: sale.unitPrice,
      total: sale.totalSale,
      venta: 'VENTA'
    };
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('✅ Sale sent to Google Sheet');
    } else {
      console.error('Error sending sale:', result);
    }
  } catch (error) {
    console.error('Error sending sale to Apps Script:', error);
  }
}

// Save sales to LocalStorage
function saveSalesToLocalStorage() {
  localStorage.setItem('translate3d_sales', JSON.stringify(salesData));
}

// Load sales from LocalStorage
function loadSalesFromLocalStorage() {
  const saved = localStorage.getItem('translate3d_sales');
  if (saved) {
    salesData = JSON.parse(saved);
  }
}

// Update daily summary
function updateDailySummary() {
  const today = new Date().toLocaleDateString();
  const todaySales = salesData.filter(sale => sale.date === today);
  
  const totalSale = todaySales.reduce((sum, sale) => sum + sale.totalSale, 0);
  const totalQuantity = todaySales.reduce((sum, sale) => sum + sale.quantity, 0);
  
  document.getElementById('totalSale').textContent = `$${totalSale.toFixed(2)}`;
  document.getElementById('totalQuantity').textContent = totalQuantity;
  
  renderSalesTable(todaySales);
}

// Render sales table
function renderSalesTable(sales) {
  const tbody = document.getElementById('salesTableBody');
  tbody.innerHTML = '';
  
  if (sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">No sales recorded yet</td></tr>';
    return;
  }
  
  sales.forEach(sale => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${sale.productName}</td>
      <td>${sale.quantity}</td>
      <td>$${sale.unitPrice.toFixed(2)}</td>
      <td>$${sale.totalSale.toFixed(2)}</td>
      <td>${new Date(sale.timestamp).toLocaleTimeString()}</td>
      <td><button onclick="deleteSale(${sale.id})" class="delete-btn">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}

// Delete sale
function deleteSale(saleId) {
  if (confirm('Are you sure you want to delete this sale?')) {
    salesData = salesData.filter(sale => sale.id !== saleId);
    saveSalesToLocalStorage();
    updateDailySummary();
  }
}

// Export to CSV
function exportToCSV() {
  const today = new Date().toLocaleDateString();
  const todaySales = salesData.filter(sale => sale.date === today);
  
  if (todaySales.length === 0) {
    alert('No sales to export for today');
    return;
  }
  
  let csv = 'Product Name,Quantity,Unit Price,Total Sale,Timestamp\n';
  
  todaySales.forEach(sale => {
    csv += `"${sale.productName}",${sale.quantity},$${sale.unitPrice.toFixed(2)},$${sale.totalSale.toFixed(2)},"${sale.timestamp}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TRANSLATE3D_Sales_${today}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Clear all sales for the day
function clearDailySales() {
  if (confirm('Are you sure you want to clear all sales for today? This cannot be undone.')) {
    const today = new Date().toLocaleDateString();
    salesData = salesData.filter(sale => sale.date !== today);
    saveSalesToLocalStorage();
    updateDailySummary();
  }
}

// Event listeners
document.getElementById('saleQuantity').addEventListener('input', calculateTotal);
