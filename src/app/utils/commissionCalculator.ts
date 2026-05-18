export interface CommissionRates {
  evenTotal: number; // % total Even
  clientPays: number; // % que paga el cliente
  restaurantPays: number; // % que paga el restaurante
}

export interface CommissionBreakdown {
  // Montos base
  baseAmount: number;
  tipAmount: number;
  ivaTip: number;

  // Subtotal para cálculo de comisiones
  subtotalForCommission: number;

  // Comisiones Even (sin IVA)
  evenCommissionTotal: number;
  evenCommissionClient: number;
  evenCommissionRestaurant: number;

  // IVA sobre comisiones Even
  ivaEvenTotal: number;
  ivaEvenClient: number;
  ivaEvenRestaurant: number;

  // Comisión Even con IVA (lo que realmente se cobra/paga)
  evenClientCharge: number; // Lo que paga el cliente (comisión + IVA)
  evenRestaurantCharge: number; // Lo que paga el restaurante (comisión + IVA)

  // Total cobrado al cliente
  totalAmountCharged: number;

  // Metadata
  rates: CommissionRates;
}

/**
 * Tasas de comisión según el monto de la transacción:
 *
 * - $20-$30: Even 11.0% (Cliente 9.0%, Restaurante 2.0%)
 * - $31-$49: Even 8.0% (Cliente 6.0%, Restaurante 2.0%)
 * - $50-$100: Even 5.8% (Cliente 3.8%, Restaurante 2.0%)
 * - $100-$150: Even 4.2% (Cliente 2.2%, Restaurante 2.0%)
 * - > $150: Even 4.0% (Cliente 2.0%, Restaurante 2.0%)
 */
export function getCommissionRates(amount: number): CommissionRates {
  if (amount >= 20 && amount <= 30) {
    return {
      evenTotal: 11.0,
      clientPays: 9.0,
      restaurantPays: 2.0,
    };
  } else if (amount >= 31 && amount <= 49) {
    return {
      evenTotal: 8.0,
      clientPays: 6.0,
      restaurantPays: 2.0,
    };
  } else if (amount >= 50 && amount <= 100) {
    return {
      evenTotal: 5.8,
      clientPays: 3.8,
      restaurantPays: 2.0,
    };
  } else if (amount >= 101 && amount <= 150) {
    return {
      evenTotal: 4.2,
      clientPays: 2.2,
      restaurantPays: 2.0,
    };
  } else if (amount > 150) {
    return {
      evenTotal: 4.0,
      clientPays: 2.0,
      restaurantPays: 2.0,
    };
  } else {
    return {
      evenTotal: 11.0,
      clientPays: 9.0,
      restaurantPays: 2.0,
    };
  }
}

export function calculateCommissions(
  baseAmount: number,
  tipAmount: number,
): CommissionBreakdown {
  // IVA de propina (NO pagado por cliente)
  const ivaTip = tipAmount * 0.16;

  // Subtotal para cálculo de comisión Even
  const subtotalForCommission = baseAmount + tipAmount;

  // Obtener tasas según el monto
  const rates = getCommissionRates(subtotalForCommission);

  // Comisiones Even (sin IVA)
  const evenCommissionTotal = subtotalForCommission * (rates.evenTotal / 100);
  const evenCommissionClient = subtotalForCommission * (rates.clientPays / 100);
  const evenCommissionRestaurant =
    subtotalForCommission * (rates.restaurantPays / 100);

  // IVA sobre comisiones Even (16%)
  const ivaEvenTotal = evenCommissionTotal * 0.16;
  const ivaEvenClient = evenCommissionClient * 0.16;
  const ivaEvenRestaurant = evenCommissionRestaurant * 0.16;

  // Comisión Even con IVA incluido
  const evenClientCharge = evenCommissionClient + ivaEvenClient;
  const evenRestaurantCharge = evenCommissionRestaurant + ivaEvenRestaurant;

  // Total cobrado al cliente
  const totalAmountCharged = baseAmount + tipAmount + evenClientCharge;

  return {
    baseAmount,
    tipAmount,
    ivaTip,
    subtotalForCommission,
    evenCommissionTotal,
    evenCommissionClient,
    evenCommissionRestaurant,
    ivaEvenTotal,
    ivaEvenClient,
    ivaEvenRestaurant,
    evenClientCharge,
    evenRestaurantCharge,
    totalAmountCharged,
    rates,
  };
}

export function formatMXN(amount: number): string {
  return `$${amount.toFixed(2)} MXN`;
}
