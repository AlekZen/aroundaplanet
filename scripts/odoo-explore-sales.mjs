/**
 * odoo-explore-sales.mjs
 * Exploracion de datos de ordenes de venta en Odoo 18 para trips de AroundaPlanet.
 * Research only — sin modificaciones a la BD.
 */

import xmlrpc from 'xmlrpc';
import { writeFileSync } from 'fs';
import { promisify } from 'util';

// Credenciales
const URL    = 'https://aroundaplanet.odoo.com';
const DB     = 'aroundaplanet';
const USER   = 'noelnumata@gmail.com';
const APIKEY = 'bd9e865a66e12c855f050521cfe2ef00bb1df7ad';

// Helpers para xmlrpc promisificado
function createClient(path) {
  return xmlrpc.createSecureClient({
    host: 'aroundaplanet.odoo.com',
    port: 443,
    path,
  });
}

function callMethod(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

async function authenticate() {
  const common = createClient('/xmlrpc/2/common');
  const uid = await callMethod(common, 'authenticate', [DB, USER, APIKEY, {}]);
  if (!uid) throw new Error('Autenticacion fallida');
  console.log(`[OK] Autenticado — UID: ${uid}`);
  return uid;
}

function createModels() {
  return createClient('/xmlrpc/2/object');
}

async function execute(models, uid, model, method, args, kwargs = {}) {
  return callMethod(models, 'execute_kw', [DB, uid, APIKEY, model, method, args, kwargs]);
}

// Obtener fields_get resumido (solo nombre, tipo, string)
async function getFieldsSummary(models, uid, modelName) {
  console.log(`\n  Obteniendo fields_get para ${modelName}...`);
  const fields = await execute(models, uid, modelName, 'fields_get', [], {
    attributes: ['string', 'type', 'relation', 'required', 'readonly'],
  });
  // Convertir a array ordenado
  return Object.entries(fields).map(([name, info]) => ({
    name,
    string: info.string,
    type: info.type,
    relation: info.relation || null,
    required: info.required || false,
    readonly: info.readonly || false,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const results = {
    timestamp: new Date().toISOString(),
    saleOrderFields: [],
    saleOrderLineFields: [],
    targetProduct: null,
    orderLinesFound: 0,
    orders: [],
    summary: {
      totalOrders: 0,
      uniqueStates: [],
      uniquePaymentStates: [],
      uniqueInvoiceStatuses: [],
      sampleOrders: [],
    },
  };

  try {
    // 1. Autenticar
    const uid = await authenticate();
    const models = createModels();

    // 2. Fields_get de sale.order
    console.log('\n[PASO 1] Obteniendo estructura de modelos...');
    results.saleOrderFields = await getFieldsSummary(models, uid, 'sale.order');
    console.log(`  sale.order: ${results.saleOrderFields.length} campos`);

    // 3. Fields_get de sale.order.line
    results.saleOrderLineFields = await getFieldsSummary(models, uid, 'sale.order.line');
    console.log(`  sale.order.line: ${results.saleOrderLineFields.length} campos`);

    // 4. Encontrar el producto con mas ventas
    // "CHEPE ENERO 2026" con sales_count=33 segun exploracion previa
    console.log('\n[PASO 2] Buscando productos con ventas...');
    const candidatos = [
      'CHEPE ENERO 2026',
      'ARGENTINA Y BRASIL AGOSTO 2025',
      'VUELTA AL MUNDO',
    ];

    let targetProductId = null;
    let targetProductName = null;

    for (const nombre of candidatos) {
      const productos = await execute(models, uid, 'product.template', 'search_read', [
        [['name', 'ilike', nombre]],
      ], {
        fields: ['id', 'name', 'list_price', 'sales_count', 'type'],
        limit: 3,
      });
      if (productos.length > 0) {
        console.log(`  Encontrado: ${productos[0].name} (ID: ${productos[0].id}, sales_count: ${productos[0].sales_count})`);
        if (!targetProductId) {
          targetProductId = productos[0].id;
          targetProductName = productos[0].name;
          results.targetProduct = productos[0];
        }
        break;
      }
    }

    // Si no encontramos ninguno de los candidatos, buscar el de mayor sales_count
    if (!targetProductId) {
      console.log('  Buscando producto con mayor sales_count...');
      const topProductos = await execute(models, uid, 'product.template', 'search_read', [
        [
          ['list_price', '>=', 5000],
          ['type', '=', 'service'],
          ['name', 'ilike', '202'],
        ],
      ], {
        fields: ['id', 'name', 'list_price', 'sales_count'],
        limit: 10,
        order: 'sales_count desc',
      });
      console.log('  Top productos por ventas:');
      topProductos.forEach(p => {
        console.log(`    - ${p.name} | precio: ${p.list_price} | ventas: ${p.sales_count}`);
      });
      if (topProductos.length > 0) {
        targetProductId = topProductos[0].id;
        targetProductName = topProductos[0].name;
        results.targetProduct = topProductos[0];
      }
    }

    if (!targetProductId) {
      throw new Error('No se encontro ningun producto para analizar');
    }

    console.log(`\n  Producto objetivo: "${targetProductName}" (ID: ${targetProductId})`);

    // 5. Obtener product.product IDs relacionados con el template
    console.log('\n[PASO 3] Obteniendo variantes de producto...');
    const productVariants = await execute(models, uid, 'product.product', 'search_read', [
      [['product_tmpl_id', '=', targetProductId]],
    ], {
      fields: ['id', 'name', 'product_tmpl_id'],
    });
    console.log(`  Variantes encontradas: ${productVariants.length}`);
    const variantIds = productVariants.map(v => v.id);
    console.log(`  Variant IDs: ${variantIds.join(', ')}`);

    // 6. Buscar sale.order.line via product_template_id y product_id
    console.log('\n[PASO 4] Buscando sale.order.line ligadas al producto...');

    // Buscar por product_template_id (relacion directa con template)
    let orderLineIds = [];

    // Intentar con product_template_id
    try {
      const linesByTemplate = await execute(models, uid, 'sale.order.line', 'search', [
        [['product_template_id', '=', targetProductId]],
      ], { limit: 200 });
      console.log(`  Lines por product_template_id: ${linesByTemplate.length}`);
      orderLineIds = [...new Set([...orderLineIds, ...linesByTemplate])];
    } catch (e) {
      console.log(`  product_template_id no disponible en sale.order.line: ${e.message}`);
    }

    // Intentar con product_id (variante)
    if (variantIds.length > 0) {
      try {
        const linesByProduct = await execute(models, uid, 'sale.order.line', 'search', [
          [['product_id', 'in', variantIds]],
        ], { limit: 200 });
        console.log(`  Lines por product_id: ${linesByProduct.length}`);
        orderLineIds = [...new Set([...orderLineIds, ...linesByProduct])];
      } catch (e) {
        console.log(`  Error buscando por product_id: ${e.message}`);
      }
    }

    console.log(`  Total order line IDs unicos: ${orderLineIds.length}`);
    results.orderLinesFound = orderLineIds.length;

    if (orderLineIds.length === 0) {
      console.log('  Sin order lines, buscando directamente en sale.order...');
      // Intentar buscar ordenes directamente - buscar todos y ver estructura
    }

    // 7. Leer las order lines para obtener order_id
    console.log('\n[PASO 5] Leyendo detalles de order lines...');
    const orderLines = orderLineIds.length > 0
      ? await execute(models, uid, 'sale.order.line', 'read', [
          orderLineIds.slice(0, 100), // max 100
        ], {
          fields: [
            'order_id', 'product_id', 'product_template_id',
            'name', 'product_uom_qty', 'price_unit', 'price_subtotal',
            'price_total', 'state', 'qty_invoiced', 'qty_delivered',
          ],
        })
      : [];

    // Extraer order IDs unicos
    const orderIds = [...new Set(orderLines.map(l => l.order_id[0]))];
    console.log(`  Orders unicos encontrados: ${orderIds.length}`);

    // 8. Leer los sale.order completos
    console.log('\n[PASO 6] Leyendo sale.order completos...');

    // Determinar que campos existen en sale.order
    const saleOrderFieldNames = results.saleOrderFields.map(f => f.name);

    // Campos de interes
    const camposDeseados = [
      'name', 'state', 'date_order', 'amount_total', 'amount_tax', 'amount_untaxed',
      'partner_id', 'partner_invoice_id', 'partner_shipping_id',
      'invoice_status', 'payment_status', 'payment_term_id',
      'user_id', 'team_id', 'currency_id', 'company_id',
      'note', 'client_order_ref', 'origin',
      'invoice_count', 'delivery_count',
      'commitment_date', 'expected_date', 'effective_date',
      'opportunity_id', 'campaign_id', 'source_id', 'medium_id',
    ];

    const camposDisponibles = camposDeseados.filter(c => saleOrderFieldNames.includes(c));
    console.log(`  Campos disponibles para leer: ${camposDisponibles.length} de ${camposDeseados.length}`);

    const missingFields = camposDeseados.filter(c => !saleOrderFieldNames.includes(c));
    if (missingFields.length > 0) {
      console.log(`  Campos NO encontrados: ${missingFields.join(', ')}`);
    }

    // Leer las ordenes
    const orders = orderIds.length > 0
      ? await execute(models, uid, 'sale.order', 'read', [
          orderIds.slice(0, 100),
        ], {
          fields: camposDisponibles,
        })
      : [];

    console.log(`  Ordenes leidas: ${orders.length}`);
    results.orders = orders;

    // 9. Si no hay ordenes via order lines, buscar directamente en sale.order
    if (orders.length === 0) {
      console.log('\n  [ALTERNATIVA] Buscando ordenes con cualquier producto del tipo "Viaje"...');

      // Buscar las 20 ordenes mas recientes para ver estructura
      const sampleOrders = await execute(models, uid, 'sale.order', 'search_read', [
        [['state', 'in', ['sale', 'done']]],
      ], {
        fields: camposDisponibles,
        limit: 20,
        order: 'date_order desc',
      });
      console.log(`  Ordenes de muestra: ${sampleOrders.length}`);
      results.orders = sampleOrders;
    }

    // 10. Leer datos del partner para cada orden (email, phone)
    console.log('\n[PASO 7] Enriqueciendo datos de clientes...');
    const partnerIds = [...new Set(results.orders.map(o => o.partner_id?.[0]).filter(Boolean))];
    const partners = partnerIds.length > 0
      ? await execute(models, uid, 'res.partner', 'read', [
          partnerIds,
        ], {
          fields: ['id', 'name', 'email', 'phone', 'mobile', 'street', 'city', 'country_id'],
        })
      : [];
    const partnerMap = Object.fromEntries(partners.map(p => [p.id, p]));

    // 11. Construir resumen
    console.log('\n[PASO 8] Construyendo resumen...');
    const ordersWithPartner = results.orders.map(order => ({
      ...order,
      partner_detail: partnerMap[order.partner_id?.[0]] || null,
    }));

    const uniqueStates = [...new Set(results.orders.map(o => o.state).filter(Boolean))];
    const uniquePaymentStates = [...new Set(results.orders.map(o => o.payment_status).filter(Boolean))];
    const uniqueInvoiceStatuses = [...new Set(results.orders.map(o => o.invoice_status).filter(Boolean))];

    results.summary = {
      totalOrders: results.orders.length,
      uniqueStates,
      uniquePaymentStates,
      uniqueInvoiceStatuses,
      sampleOrders: ordersWithPartner.slice(0, 5).map(order => ({
        name: order.name,
        state: order.state,
        date_order: order.date_order,
        amount_total: order.amount_total,
        invoice_status: order.invoice_status,
        payment_status: order.payment_status,
        customer_name: order.partner_id?.[1] || 'N/A',
        customer_email: partnerMap[order.partner_id?.[0]]?.email || 'N/A',
        customer_phone: partnerMap[order.partner_id?.[0]]?.phone || partnerMap[order.partner_id?.[0]]?.mobile || 'N/A',
        customer_city: partnerMap[order.partner_id?.[0]]?.city || 'N/A',
      })),
    };

    // Agregar ordenes completas enriquecidas
    results.ordersEnriched = ordersWithPartner;

    // 12. Explorar adicionalmente: ver que valores tiene 'state' en general
    console.log('\n[PASO 9] Explorando estados de sale.order en toda la BD (muestra)...');
    const estadosMuestra = await execute(models, uid, 'sale.order', 'read_group', [
      [],
      ['state'],
      ['state'],
    ], {});
    console.log('  Distribucion de estados en TODAS las ordenes:');
    estadosMuestra.forEach(g => {
      console.log(`    ${g.state}: ${g.state_count} ordenes`);
    });
    results.allOrderStateDistribution = estadosMuestra;

    // 13. Si hay campo payment_status, ver distribucion
    if (saleOrderFieldNames.includes('payment_status')) {
      try {
        const paymentMuestra = await execute(models, uid, 'sale.order', 'read_group', [
          [],
          ['payment_status'],
          ['payment_status'],
        ], {});
        console.log('\n  Distribucion de payment_status en TODAS las ordenes:');
        paymentMuestra.forEach(g => {
          console.log(`    ${g.payment_status}: ${g.payment_status_count} ordenes`);
        });
        results.allPaymentStatusDistribution = paymentMuestra;
      } catch (e) {
        console.log(`  Error en read_group payment_status: ${e.message}`);
      }
    }

    // 14. Explorar campos de pago especificos en las ordenes
    console.log('\n[PASO 10] Explorando campos financieros de sale.order.line...');
    // Ver primeras 5 order lines del producto objetivo con todos sus campos
    if (orderLineIds.length > 0) {
      const sampleLines = await execute(models, uid, 'sale.order.line', 'read', [
        orderLineIds.slice(0, 5),
      ], {});
      results.sampleOrderLines = sampleLines;
      console.log(`  Sample de ${sampleLines.length} order lines con todos los campos`);
    }

    // Imprimir resumen final
    console.log('\n' + '='.repeat(60));
    console.log('RESUMEN FINAL');
    console.log('='.repeat(60));
    console.log(`Producto analizado: ${results.targetProduct?.name || 'N/A'}`);
    console.log(`Order lines encontradas: ${results.orderLinesFound}`);
    console.log(`Ordenes unicas: ${results.summary.totalOrders}`);
    console.log(`Estados unicos: ${results.summary.uniqueStates.join(', ')}`);
    console.log(`Payment status unicos: ${results.summary.uniquePaymentStates.join(', ')}`);
    console.log(`Invoice status unicos: ${results.summary.uniqueInvoiceStatuses.join(', ')}`);
    console.log('\nMuestra de 5 ordenes:');
    results.summary.sampleOrders.forEach((o, i) => {
      console.log(`  ${i + 1}. ${o.name} | ${o.customer_name} | ${o.date_order} | $${o.amount_total} | ${o.state} | ${o.payment_status || 'sin payment_status'}`);
    });

    // Guardar resultados
    const outputPath = './scripts/odoo-explore-sales.json';
    writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n[OK] Resultados guardados en ${outputPath}`);

  } catch (err) {
    console.error('\n[ERROR]', err.message);
    results.error = err.message;
    writeFileSync('./scripts/odoo-explore-sales.json', JSON.stringify(results, null, 2), 'utf-8');
    process.exit(1);
  }
}

main();
