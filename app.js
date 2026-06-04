// TRANSLATE 3D - GitHub Pages Version
// Inventory and sales management system
// Reads from Google Sheets, saves to LocalStorage and Google Sheets

const SPREADSHEET_ID = '1rRIjAJY9NT5d4NfdL5wyHjKXiSjnFHli5tJnB73wvMo';
const API_KEY = 'AIzaSyDGfNsMn-X_a6kgDmQeN7O7nT5YpqxlR0c';
const RANGE = 'INVENTARIO!A:F';

let products = [];
let salesData = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadProductsFromSheets();
  loadSalesFromLocalStorage();
  updateSummary();
});

// Load products from Google Sheets
function loadProductsFromSheets() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
  
  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.values) {
        products = [];
        // Skip header row
        for (let i = 1; i < data.values.length; i++) {
          const row = data.values[i];
          if (row[0] && row[1]) { // Categoria and Producto
            products.push({
              id: i - 1,
              categoria: String(row[0]).trim(),
              producto: String(row[1]).trim(),
              precio: parseInt(row[2]) || 0,
              cantidad: parseInt(row[3]) || 0,
              vendidos: parseInt(row[4]) || 0,
              venta: parseInt(row[5]) || 0
            });
          }
        }
        displayProducts(products);
        populateCategories();
      }
    })
    .catch(error => {
      console.error('Error loading products:', error);
      showError('Error cargando productos del Sheet');
    });
}

// Display products
function displayProducts(productsToShow) {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';

  if (productsToShow.length === 0) {
    grid.innerHTML = '<div class="loading">No hay productos</div>';
    return;
  }

  productsToShow.forEach((product, index) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    if (product.cantidad > 0) {
      card.onclick = () => openSaleModal(index);
    }

    const stockClass = product.cantidad <= 0 ? 'out' : product.cantidad <= 3 ? 'low' : '';
    const stockText = product.cantidad <= 0 ? 'Agotado' : product.cantidad + ' unidades';

    card.innerHTML = `
      <span class="product-category">${product.categoria}</span>
      <div class="product-name">${product.producto}</div>
      <div class="product-price">$${product.precio}</div>
      <div class="product-stock ${stockClass}">Disponible: ${stockText}</div>
      <button class="btn btn-primary" ${product.cantidad <= 0 ? 'disabled' : ''}>
        ${product.cantidad <= 0 ? 'Agotado' : 'Registrar Venta'}
      </button>
    `;
    grid.appendChild(card);
  });

  document.getElementById('productCount').textContent = productsToShow.length + ' productos';
}

// Populate categories
function populateCategories() {
  const categories = [...new Set(products.map(p => p.categoria).filter(c => c))];
  const select = document.getElementById('categoryFilter');
  
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
}

// Filter products
function filterProducts() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('categoryFilter').value;

  const filtered = products.filter(p => {
    const matchSearch = p.producto.toLowerCase().includes(search);
    const matchCategory = !category || p.categoria === category;
    return matchSearch && matchCategory;
  });

  displayProducts(filtered);
}

// Open sale modal
function openSaleModal(productIndex) {
  const product = products[productIndex];
  if (product.cantidad <= 0) return;

  window.currentProductIndex = productIndex;
  document.getElementById('modalProductName').textContent = product.producto;
  document.getElementById('modalProductCategory').textContent = product.categoria;
  document.getElementById('modalProductPrice').textContent = '$' + product.precio;
  document.getElementById('modalProductStock').textContent = product.cantidad + ' unidades';
  document.getElementById('saleQuantity').value = 1;
  document.getElementById('saleQuantity').max = product.cantidad;
  calculateTotal();
  document.getElementById('saleModal').classList.add('active');
}

// Close sale modal
function closeSaleModal() {
  document.getElementById('saleModal').classList.remove('active');
  window.currentProductIndex = null;
}

// Calculate total
function calculateTotal() {
  if (window.currentProductIndex === null) return;
  const product = products[window.currentProductIndex];
  const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
  const total = product.precio * quantity;
  document.getElementById('saleTotal').textContent = '$' + total;
}

// Record sale
function recordSale() {
  const product = products[window.currentProductIndex];
  const quantity = parseInt(document.getElementById('saleQuantity').value);

  if (quantity <= 0 || quantity > product.cantidad) {
    alert('Cantidad inválida');
    return;
  }

  const total = product.precio * quantity;

  // Save to LocalStorage
  const sale = {
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().split(' ')[0],
    producto: product.producto,
    cantidad: quantity,
    precio: product.precio,
    total: total
  };

  salesData.push(sale);
  localStorage.setItem('translate3d_sales', JSON.stringify(salesData));

  // Update product stock locally
  product.cantidad -= quantity;
  product.vendidos += quantity;
  product.venta += total;

  alert('✅ Venta registrada correctamente');
  closeSaleModal();
  displayProducts(products);
  updateSummary();
}

// Load sales from LocalStorage
function loadSalesFromLocalStorage() {
  const saved = localStorage.getItem('translate3d_sales');
  if (saved) {
    salesData = JSON.parse(saved);
  }
}

// Update summary
function updateSummary() {
  const totalSale = salesData.reduce((sum, sale) => sum + sale.total, 0);
  const totalQuantity = salesData.reduce((sum, sale) => sum + sale.cantidad, 0);

  document.getElementById('totalSale').textContent = '$' + totalSale.toFixed(2);
  document.getElementById('totalQuantity').textContent = totalQuantity;
}

// Export to CSV
function exportToCSV() {
  if (salesData.length === 0) {
    alert('No hay ventas para exportar');
    return;
  }

  let csv = 'Fecha,Hora,Producto,Cantidad,Precio Unitario,Total\n';
  salesData.forEach(sale => {
    csv += `${sale.fecha},${sale.hora},${sale.producto},${sale.cantidad},${sale.precio},${sale.total}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'translate3d_ventas_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
}

// Show error
function showError(message) {
  const errorContainer = document.getElementById('errorContainer');
  errorContainer.innerHTML = '<div class="error">' + message + '</div>';
}

// Clear all sales
function clearAllSales() {
  if (confirm('¿Estás seguro de que quieres borrar todas las ventas?')) {
    salesData = [];
    localStorage.removeItem('translate3d_sales');
    updateSummary();
    alert('✅ Ventas borradas');
  }
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', filterProducts);
document.getElementById('categoryFilter').addEventListener('change', filterProducts);
document.getElementById('saleQuantity').addEventListener('input', calculateTotal);
