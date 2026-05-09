/**
 * odoo-build-sales-json.mjs
 * Genera el JSON final de resultados de la exploracion de sales orders.
 */

import { writeFileSync } from 'fs';

const results = {
  timestamp: new Date().toISOString(),
  researchGoal: 'Explorar estructura de datos de ventas en Odoo 18 para trips de AroundaPlanet',

  // Estructura de modelos
  modelosTotalCampos: {
    'sale.order': 160,
    'sale.order.line': 107,
    'account.move': 244,
    'account.payment': 100,
  },

  // Producto analizado
  productoObjetivo: {
    id: 1545,
    name: 'CHEPE ENERO 2026',
    variantId: 1452,
    salesCount: 33,
  },

  // Estructura de sale.order (campos clave encontrados)
  saleOrderCamposClave: {
    identificacion: ['id', 'name', 'state', 'type_name'],
    fechas: ['create_date', 'date_order', 'expected_date', 'commitment_date'],
    cliente: ['partner_id', 'partner_invoice_id', 'partner_shipping_id'],
    montos: ['amount_untaxed', 'amount_tax', 'amount_total', 'amount_paid', 'amount_invoiced', 'amount_to_invoice'],
    facturacion: ['invoice_status', 'invoice_ids', 'invoice_count'],
    vendedor: ['user_id', 'team_id'],
    IMPORTANTE: 'payment_status NO existe en sale.order — el estado de pago real esta en account.move.payment_state',
  },

  // Estructura de account.move (invoice)
  accountMoveCamposClave: {
    identificacion: ['id', 'name', 'state', 'move_type'],
    fechas: ['invoice_date', 'invoice_date_due', 'date'],
    cliente: ['partner_id', 'commercial_partner_id'],
    montos: ['amount_untaxed', 'amount_tax', 'amount_total', 'amount_residual'],
    pago: ['payment_state', 'status_in_payment', 'payment_count'],
    pagosDetalle: ['matched_payment_ids', 'reconciled_payment_ids', 'invoice_payments_widget'],
    origen: ['invoice_origin'],
    IMPORTANTE: 'invoice_payments_widget es un JSON con array content[] de pagos parciales aplicados a la factura',
  },

  // Valores de payment_state en account.move (distribucion real en toda la BD)
  paymentStateDistribucion: {
    paid: 1903,
    partial: 461,
    not_paid: 141,
    in_payment: 121,
    descripcion: {
      paid: 'Factura completamente pagada',
      partial: 'Factura parcialmente pagada (hay saldo pendiente)',
      not_paid: 'Factura sin ningun pago registrado',
      in_payment: 'Pago registrado pero en proceso de conciliacion bancaria',
    },
  },

  // Distribucion de estados en TODA la BD de sale.order
  saleOrderEstadosTodos: {
    draft: 9611,
    sale: 2563,
    cancel: 61,
    nota: 'draft = cotizacion sin confirmar, sale = orden confirmada, done = bloqueada/cerrada',
  },

  // Estructura de account.payment
  accountPaymentCamposClave: {
    identificacion: ['id', 'name', 'state'],
    fecha: ['date'],
    monto: ['amount', 'amount_signed', 'currency_id'],
    tipo: ['payment_type', 'partner_type', 'payment_method_id'],
    relaciones: ['invoice_ids', 'reconciled_invoice_ids', 'journal_id', 'partner_id'],
    memo: ['memo', 'payment_reference'],
    estadosPosibles: 'paid | draft | cancel | posted',
    nota: 'payment_type: inbound (cliente paga a empresa) | outbound (empresa paga a proveedor)',
  },

  // Ejemplo real de flujo completo orden -> factura -> pagos
  ejemploFlujoCompleto: {
    orden: {
      name: 'S11673',
      state: 'sale',
      date_order: '2025-12-29 18:09:53',
      partner_id: [3836, 'ALEXANDER RUBIO ARIZAGA'],
      amount_total: 15500,
      invoice_status: 'invoiced',
      user_id: [25, 'GRUPOS'],
      team_id: [50, 'ISAIAS GODINEZ OROZCO'],
      invoice_ids: [9794],
    },
    factura: {
      name: 'INV/2025/01284',
      state: 'posted',
      payment_state: 'paid',
      amount_total: 15500,
      amount_residual: 0,
      invoice_origin: 'S11673',
      invoice_payments_widget_content: [
        { amount: 10000, date: '2025-12-27', journal_name: 'Bank', payment_method_name: 'Manual', account_payment_id: 6875 },
        { amount: 5500, date: '2026-01-06', journal_name: 'Bank', payment_method_name: 'Manual', account_payment_id: 6956 },
      ],
    },
    pagos: [
      {
        id: 6875,
        name: 'PBNK1/2025/03385',
        amount: 10000,
        date: '2025-12-27',
        payment_method_id: [1, 'Manual'],
        l10n_mx_edi_payment_method_id: [3, 'Transferencia electronica de fondos'],
        journal_id: [13, 'Bank'],
        state: 'paid',
        memo: 'INV/2025/01284',
      },
      {
        id: 6956,
        name: 'PBNK1/2026/00046',
        amount: 5500,
        date: '2026-01-06',
        payment_method_id: [1, 'Manual'],
        l10n_mx_edi_payment_method_id: [1, 'Efectivo'],
        journal_id: [13, 'Bank'],
        state: 'paid',
        memo: 'INV/2025/01284',
      },
    ],
  },

  // Resumen de las 33 ordenes de CHEPE ENERO 2026
  resumenChepeEnero2026: {
    totalOrdenes: 33,
    totalFacturado: 573300,
    totalCobrado: 532800,
    totalPendiente: 40500,
    distribucionPaymentState: {
      paid: 25,
      partial: 4,
      in_payment: 4,
    },
    distribucionInvoiceStatus: {
      invoiced: 33,
    },
    observaciones: [
      'Todas las 33 ordenes estan completamente facturadas (invoice_status=invoiced)',
      'El 76% (25 de 33) estan completamente pagadas',
      '4 tienen pago parcial con un total de $40,500 pendiente',
      '4 estan en proceso de conciliacion bancaria (in_payment)',
      'Multiples pagos parciales por cliente son la norma: 3-5 abonos por orden',
      'Los montos por persona varian: $15,500 a $20,000 MXN',
      'Precio base tipico: $17,500 MXN por persona para CHEPE ENERO 2026',
      'La nota del pedido contiene las instrucciones de pago (clabe bancaria) en HTML',
      'team_id referencia al equipo de ventas (agente vendedor), ej: ISAIAS GODINEZ OROZCO',
    ],
    muestraOrdenes: [
      { name: 'S11673', cliente: 'ALEXANDER RUBIO ARIZAGA', total: 15500, paymentState: 'paid', abonos: [10000, 5500], pendiente: 0 },
      { name: 'S11672', cliente: 'CINDY ARIZAGA GARCIA', total: 17500, paymentState: 'paid', abonos: [6500, 10000, 1000], pendiente: 0 },
      { name: 'S11322', cliente: 'MARIA ELENA BARRIOS CRUZ', total: 17500, paymentState: 'partial', abonos: [4000], pendiente: 13500 },
      { name: 'S11323', cliente: 'ELIZABETH ALEJANDRA RODRIGUEZ', total: 17500, paymentState: 'partial', abonos: [4000], pendiente: 13500 },
      { name: 'S11224', cliente: 'GERARDO HERNANDEZ ZARAGOZA', total: 20000, paymentState: 'in_payment', abonos: [10000, 10000], pendiente: 0 },
    ],
  },

  // Patron de query recomendado para integrar en la app
  patronesQueryRecomendados: {
    obtenerOrdenesDeUnViaje: {
      paso1: 'sale.order.line search con product_template_id = <trip_template_id>',
      paso2: 'sale.order read con order_ids obtenidos y campos clave',
      paso3: 'account.move read con invoice_ids de cada orden para payment_state y pagos detalle',
      camposMinimos: {
        saleOrder: ['name', 'state', 'date_order', 'amount_total', 'invoice_status', 'invoice_ids', 'partner_id', 'user_id', 'team_id', 'amount_paid', 'amount_invoiced', 'amount_to_invoice'],
        accountMove: ['name', 'state', 'payment_state', 'amount_total', 'amount_residual', 'invoice_date', 'invoice_payments_widget'],
      },
      alternativa: 'Para solo el estado sin detalle de pagos: solo leer sale.order + account.move con payment_state y amount_residual',
    },
    obtenerEstadoPago: 'account.move.payment_state: paid | partial | not_paid | in_payment',
    obtenerPagosDetalle: 'account.move.invoice_payments_widget (campo binary/JSON) -> .content[] con { amount, date, journal_name, account_payment_id }',
    obtenerMetodoPago: 'account.payment.l10n_mx_edi_payment_method_id -> metodo SAT (Efectivo, Transferencia, etc)',
    filtrarOrdenesConfirmadas: 'sale.order state = sale (no draft, no cancel)',
    filtrarFacturasPostadas: 'account.move state = posted AND move_type = out_invoice',
  },

  // Relacion entre modelos (mapa)
  relacionModelos: {
    saleOrder: {
      model: 'sale.order',
      conPartner: 'sale.order.partner_id -> res.partner (nombre, email, phone, ciudad)',
      conAgente: 'sale.order.team_id -> crm.team (nombre del agente/equipo)',
      conLineas: 'sale.order.order_line -> sale.order.line (productos)',
      conFacturas: 'sale.order.invoice_ids -> account.move (facturas/pagos)',
    },
    saleOrderLine: {
      model: 'sale.order.line',
      conTemplate: 'sale.order.line.product_template_id -> product.template (trip)',
      conVariant: 'sale.order.line.product_id -> product.product',
      conOrden: 'sale.order.line.order_id -> sale.order',
    },
    accountMove: {
      model: 'account.move',
      conPagos: 'account.move.matched_payment_ids | reconciled_payment_ids -> account.payment',
      conOrden: 'account.move.invoice_origin = sale.order.name (texto, no FK)',
      campoEstadoPago: 'account.move.payment_state -> paid | partial | not_paid | in_payment',
    },
    accountPayment: {
      model: 'account.payment',
      conFactura: 'account.payment.reconciled_invoice_ids -> account.move',
      campoMetodo: 'account.payment.l10n_mx_edi_payment_method_id -> metodo SAT',
    },
  },

  // Campos especiales de contexto Mexico (l10n_mx)
  camposMexico: {
    saleOrder: {
      'l10n_mx_edi_payment_method_id': 'Forma de pago SAT (Por definir, Efectivo, Transferencia...)',
      'l10n_mx_edi_usage': 'Uso del CFDI (G03 = Gastos en general)',
    },
    accountMove: {
      'l10n_mx_edi_cfdi_state': 'Estado del CFDI (None, Sent, Cancelled...)',
      'l10n_mx_edi_cfdi_uuid': 'UUID fiscal (folio fiscal del SAT)',
      'l10n_mx_edi_payment_method_id': 'Forma de pago SAT',
      'l10n_mx_edi_payment_policy': 'Politica: PUE (pago unico exigible) | PPD (pago en parcialidades)',
    },
    accountPayment: {
      'l10n_mx_edi_payment_method_id': 'Metodo de pago real (Efectivo, Transferencia electronica, etc)',
    },
  },
};

const outputPath = './scripts/odoo-explore-sales.json';
writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
console.log('[OK] Resultados guardados en', outputPath);
console.log('Tamano:', JSON.stringify(results).length, 'chars');
