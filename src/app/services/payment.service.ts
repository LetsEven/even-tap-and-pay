import { requestWithAuth } from "@/app/services/request-helper";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    type?: string;
    message: string;
    details?: any;
  };
}

export interface PaymentMethod {
  id: string;
  lastFourDigits: string;
  cardBrand: string;
  cardType: string;
  expiryMonth?: number;
  expiryYear?: number;
  cardholderName?: string;
  isDefault: boolean;
  isSystemCard?: boolean;
  createdAt?: string;
}

export interface AddPaymentMethodRequest {
  fullName: string;
  cardNumber: string;
  expDate: string;
  cvv: string;
}

export interface ProcessPaymentRequest {
  paymentMethodId: string;
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  roomNumber: string;
  restaurantId: string;
}

export interface PaymentHistory {
  id: string;
  amount: number;
  date: string;
  status: string;
}

export interface MsiOption {
  months: number;
  rate: number;
  minAmount: number;
  fixedInstallments: boolean;
}

export interface MsiConfig {
  isActive: boolean;
  visaMc: MsiOption[];
  amex: MsiOption[];
}

class PaymentService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<ApiResponse<T>> {
    // Usar el helper con refresh automático
    const result = await requestWithAuth<T>(endpoint, options);

    // Adaptar el formato de error al esperado por PaymentService
    if (!result.success && result.error && typeof result.error === "string") {
      return {
        success: false,
        error: {
          type: "api_error",
          message: result.error,
        },
      };
    }

    return result as ApiResponse<T>;
  }

  // Añadir método de pago
  async addPaymentMethod(
    paymentData: AddPaymentMethodRequest,
  ): Promise<ApiResponse<{ paymentMethod: PaymentMethod }>> {
    return this.request("/payment-methods", {
      method: "POST",
      body: JSON.stringify(paymentData),
    });
  }

  // Obtener métodos de pago del usuario
  async getPaymentMethods(): Promise<
    ApiResponse<{ paymentMethods: PaymentMethod[] }>
  > {
    return this.request("/payment-methods", {
      method: "GET",
    });
  }

  // Eliminar método de pago
  async deletePaymentMethod(
    paymentMethodId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/payment-methods/${paymentMethodId}`, {
      method: "DELETE",
    });
  }

  // Establecer método de pago como predeterminado
  async setDefaultPaymentMethod(
    paymentMethodId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/payment-methods/${paymentMethodId}/default`, {
      method: "PUT",
    });
  }

  // Procesar pago
  async processPayment(
    paymentData: ProcessPaymentRequest,
  ): Promise<ApiResponse<any>> {
    return this.request("/payments", {
      method: "POST",
      body: JSON.stringify(paymentData),
    });
  }

  // Obtener historial de pagos
  async getPaymentHistory(): Promise<ApiResponse<PaymentHistory[]>> {
    return this.request("/payments/history", {
      method: "GET",
    });
  }

  // Migrar métodos de pago de guest a usuario autenticado
  async migrateGuestPaymentMethods(
    guestId: string,
  ): Promise<ApiResponse<{ migratedCount: number }>> {
    return this.request("/payment-methods/migrate-from-guest", {
      method: "POST",
      body: JSON.stringify({ guestId }),
    });
  }

  async getMsiConfiguration(): Promise<ApiResponse<MsiConfig>> {
    return this.request("/payments/installment-config", { method: "GET" });
  }

  async createApplePayOrder(params: {
    amount: number;
    currency: string;
    tableNumber?: string;
    restaurantId?: string;
    baseAmount?: number;
    tipAmount?: number;
  }): Promise<ApiResponse<{ orderId: string }>> {
    return this.request("/payments/apple-pay/order", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async createGooglePayOrder(params: {
    amount: number;
    currency: string;
    tableNumber?: string;
    restaurantId?: string;
    baseAmount?: number;
    tipAmount?: number;
  }): Promise<ApiResponse<{ orderId: string }>> {
    return this.request("/payments/google-pay/order", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Pagar un platillo individual
  async payDishOrder(params: {
    dishId: string;
    paymentMethodId: string | null;
    userId?: string;
    guestId?: string | null;
    guestName?: string | null;
  }): Promise<ApiResponse<any>> {
    return this.request(`/tap-pay/dishes/${params.dishId}/pay`, {
      method: "POST",
      body: JSON.stringify({
        paymentMethodId: params.paymentMethodId,
        userId: params.userId,
        guestId: params.guestId,
        guestName: params.guestName,
      }),
    });
  }

  // Pagar platillos seleccionados (itera sobre cada uno)
  async paySelectedDishes(params: {
    dishIds: string[];
    paymentMethodId: string | null;
    userId?: string;
    guestId?: string | null;
    guestName?: string | null;
  }): Promise<ApiResponse<any>> {
    for (const dishId of params.dishIds) {
      try {
        await this.payDishOrder({
          dishId,
          paymentMethodId: params.paymentMethodId,
          userId: params.userId,
          guestId: params.guestId,
          guestName: params.guestName,
        });
      } catch (error) {
        console.error(`Error paying dish ${dishId}:`, error);
        throw error;
      }
    }
    return { success: true, data: { paidCount: params.dishIds.length } };
  }

  // Pagar monto de la orden
  // NOTA: No se envía paymentMethodId - solo registra que se pagó el monto
  async payOrderAmount(params: {
    orderId: string;
    amount: number;
    userId?: string;
    guestId?: string | null;
    guestName?: string | null;
    paymentMethodId: string | null;
  }): Promise<ApiResponse<any>> {
    return this.request(`/tap-pay/orders/${params.orderId}/pay-amount`, {
      method: "POST",
      body: JSON.stringify({
        amount: params.amount,
        userId: params.userId,
        guestId: params.guestId,
        guestName: params.guestName,
      }),
    });
  }

  // Pagar monto de split
  // NOTA: No se envía paymentMethodId - solo registra el pago de la división
  async paySplitAmount(params: {
    orderId: string;
    userId?: string;
    guestId?: string | null;
    guestName?: string | null;
    paymentMethodId: string | null;
  }): Promise<ApiResponse<any>> {
    return this.request(`/tap-pay/orders/${params.orderId}/pay-split`, {
      method: "POST",
      body: JSON.stringify({
        userId: params.userId,
        guestId: params.guestId,
        guestName: params.guestName,
      }),
    });
  }

  // Registrar transacción de pago
  async recordPaymentTransaction(params: {
    payment_method_id: string | null;
    restaurant_id: number;
    id_tap_pay_order: string | null; // Para Tap & Pay (tap_pay_orders)
    base_amount: number;
    tip_amount: number;
    iva_tip: number;
    even_commission_total: number;
    even_commission_client: number;
    even_commission_restaurant: number;
    iva_even_client: number;
    iva_even_restaurant: number;
    even_client_charge: number;
    even_restaurant_charge: number;
    even_rate_applied: number;
    total_amount_charged: number;
    subtotal_for_commission: number;
    currency: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/payment-transactions", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }
}

export const paymentService = new PaymentService();
