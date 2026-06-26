"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { useTable } from "@/app/context/TableContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import { useRestaurant } from "@/app/context/RestaurantContext";
import MenuHeader from "@/app/components/headers/MenuHeader";
import { orderService } from "@/app/services/order.service";
import { ChevronRight, DollarSign, ReceiptText } from "lucide-react";
import { ActiveUser } from "@/app/types/order";

interface SplitPayment {
  id: string;
  status: "pending" | "paid";
  guest_name?: string;
  user_id?: string;
  amount: number;
}

interface SplitStatus {
  split_payments: SplitPayment[];
  is_split_active: boolean;
}

interface ActiveUserWithPayments extends ActiveUser {
  total_paid_individual?: number;
  total_paid_amount?: number;
  total_paid_split?: number;
  display_name?: string;
}

export default function PaymentOptionsPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const { state, setTableNumber, loadTableData } = useTable();
  const { tableNumber, navigateWithTable } = useTableNavigation();
  const { setParams, params: restaurantParams } = useRestaurant();

  const [isLoading, setIsLoading] = useState(true);
  const [splitStatus, setSplitStatus] = useState<SplitStatus | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUserWithPayments[]>([]);

  const loadSplitStatus = async () => {
    if (!state.order?.order_id) return;

    console.log("🔄 Loading split status for order:", state.order.order_id);

    try {
      const response = await orderService.getSplitPaymentStatus(
        state.order.order_id,
      );
      console.log("📡 Split status API response:", response);

      if (response.success && response.data) {
        setSplitStatus(response.data);
        console.log("✅ Split status updated:", response.data);
      } else {
        setSplitStatus(null);
        console.log("❌ Split status API failed:", response);
      }
    } catch (error) {
      console.error("Error loading split status:", error);
      setSplitStatus(null);
    }
  };

  const loadActiveUsersData = async () => {
    if (!state.order?.order_id) return;

    console.log("🔄 Loading active users for order:", state.order.order_id);

    try {
      const response = await orderService.getActiveUsers(state.order.order_id);
      console.log("📡 Active users API response:", response);

      if (response.success && response.data) {
        setActiveUsers(response.data);
        console.log("✅ Active users updated:", response.data);
      } else {
        setActiveUsers([]);
        console.log("❌ Active users API failed:", response);
      }
    } catch (error) {
      console.error("Error loading active users:", error);
      setActiveUsers([]);
    }
  };

  // Establecer restaurantId y branchNumber desde los path params
  useEffect(() => {
    const restaurantId = params?.restaurantId as string;
    const branchNumber = params?.branchNumber as string;

    if (restaurantId && branchNumber) {
      setParams({
        restaurantId,
        branchNumber,
      });
    }
  }, [params, setParams]);

  // Establecer el número de mesa desde los query params
  useEffect(() => {
    const tableParam = searchParams.get("table");
    if (tableParam && tableParam !== state.tableNumber) {
      setTableNumber(tableParam);
    }
  }, [searchParams, setTableNumber, state.tableNumber]);

  useEffect(() => {
    const loadPaymentData = async () => {
      // Verificar que tenemos tableNumber antes de intentar cargar
      if (!tableNumber) {
        console.log("⚠️ Payment options: Waiting for tableNumber...");
        return;
      }

      // Verificar que los params del restaurante estén listos
      if (!restaurantParams?.restaurantId || !restaurantParams?.branchNumber) {
        console.log("⚠️ Payment options: Waiting for restaurant params...");
        return;
      }

      // Si no hay orden, cargarla
      if (!state.order) {
        console.log("🔄 Payment options: Loading table data (no order)");
        setIsLoading(true);
        await loadTableData();
        await loadActiveUsersData();
        await loadSplitStatus();
        setIsLoading(false);
      } else if (state.order?.order_id) {
        // Si hay orden pero no tiene items, recargar
        if (!state.order.items || state.order.items.length === 0) {
          console.log("🔄 Payment options: Loading table data (missing data)");
          setIsLoading(true);
          await loadTableData();
          await loadActiveUsersData();
          await loadSplitStatus();
          setIsLoading(false);
        } else {
          // Ya hay datos completos, solo recargar activeUsers y split status
          console.log(
            "✅ Payment options: Data already loaded, reloading active users and split status",
          );
          await loadActiveUsersData();
          await loadSplitStatus();
          setIsLoading(false);
        }
      }
    };

    loadPaymentData();
  }, [tableNumber, state.order, restaurantParams]);

  if (!tableNumber || isNaN(parseInt(tableNumber))) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4 md:px-6 lg:px-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-medium text-gray-800 mb-4 md:mb-6">
            Mesa Inválida
          </h1>
          <p className="text-gray-600 text-base md:text-lg lg:text-xl">
            Por favor escanee el código QR
          </p>
        </div>
      </div>
    );
  }

  // Calcular totales usando los datos de la orden
  const dishes = state.order?.items || [];

  // Platillos no pagados y pagados
  const unpaidDishes = dishes.filter(
    (dish) => dish.payment_status === "not_paid" || !dish.payment_status,
  );
  const paidDishes = dishes.filter((dish) => dish.payment_status === "paid");

  // Usar los totales de la orden directamente (incluye todos los métodos de pago)
  const tableTotalPrice =
    state.order?.total_amount ||
    dishes.reduce(
      (sum, dish) => sum + (dish.price + dish.extra_price) * dish.quantity,
      0,
    );

  // paid_amount de la orden incluye pagos por todos los métodos
  const paidAmount = state.order?.paid_amount || 0;

  // remaining_amount de la orden es lo que falta por pagar
  const unpaidAmount =
    state.order?.remaining_amount || tableTotalPrice - paidAmount;

  // Obtener usuarios únicos que NO hayan pagado nada
  const uniqueUsers = (() => {
    // Si tenemos activeUsers, usar esa información
    if (activeUsers && activeUsers.length > 0) {
      const usersWithNoPaid = activeUsers
        .filter((user: any) => {
          // amount_paid es el campo de la tabla active_tap_pay_users
          const totalPaid = parseFloat(user.amount_paid) || 0;
          return totalPaid === 0;
        })
        .map((user: any) => user.display_name)
        .filter(Boolean);

      console.log("🔍 Using active_users with NO payments:");
      console.log("- Active users:", activeUsers);
      console.log("- Users with no payments:", usersWithNoPaid);

      return [...new Set(usersWithNoPaid)]; // Asegurar unicidad
    }

    // Si hay split status activo, usar esa información
    if (splitStatus && Array.isArray(splitStatus.split_payments)) {
      const pendingUsers = splitStatus.split_payments
        .filter((payment) => payment.status === "pending")
        .map((payment) => payment.guest_name || payment.user_id)
        .filter((name): name is string => Boolean(name));

      console.log("🔍 Split status active:");
      console.log("- Split payments:", splitStatus.split_payments);
      console.log("- Pending users:", pendingUsers);

      return [...new Set(pendingUsers)]; // Asegurar unicidad
    }

    console.log("🔍 No active users or split status available");
    return [];
  })();

  console.log("👥 Final user counts:");
  console.log("- uniqueUsers:", uniqueUsers, "length:", uniqueUsers.length);

  const handlePayFullBill = () => {
    if (unpaidAmount <= 0) {
      alert("No hay cuenta pendiente por pagar");
      return;
    }

    const queryParams = new URLSearchParams({
      amount: unpaidAmount.toString(),
      type: "full-bill",
    });

    navigateWithTable(`/tip-selection?${queryParams.toString()}`);
  };

  const handleSelectItems = () => {
    if (unpaidDishes.length === 0) {
      alert("No hay platillos pendientes por pagar");
      return;
    }

    const queryParams = new URLSearchParams({
      type: "select-items",
    });

    navigateWithTable(`/tip-selection?${queryParams.toString()}`);
  };

  const handleEqualShares = () => {
    if (unpaidAmount <= 0) {
      alert("No hay cuenta pendiente por pagar");
      return;
    }

    const numberOfPeople = uniqueUsers.length > 0 ? uniqueUsers.length : 1;
    const splitAmount = unpaidAmount / numberOfPeople;

    const queryParams = new URLSearchParams({
      amount: splitAmount.toString(),
      type: "equal-shares",
      numberOfPeople: numberOfPeople.toString(),
    });

    navigateWithTable(`/tip-selection?${queryParams.toString()}`);
  };

  const handleChooseAmount = () => {
    if (unpaidAmount <= 0) {
      alert("No hay cuenta pendiente por pagar");
      return;
    }

    const queryParams = new URLSearchParams({
      type: "choose-amount",
      maxAmount: unpaidAmount.toString(),
    });

    navigateWithTable(`/tip-selection?${queryParams.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-even-evergreen flex flex-col">
        <MenuHeader />

        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
          <div className="left-4 right-4 bg-even-evergreen rounded-t-4xl translate-y-7 z-0">
            <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
              <h1 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 md:leading-9 lg:leading-tight mt-2 md:mt-3 mb-6 md:mb-8">
                Elige cómo quieres pagar la cuenta
              </h1>
            </div>
          </div>

          <div className="flex-1 h-full flex flex-col overflow-hidden relative">
            <div className="bg-white rounded-t-4xl flex-1 z-5 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10 pb-[140px] md:pb-[160px] lg:pb-[180px]">
                <div className="flex flex-col mt-4 md:mt-6 space-y-0">
                  {/* Skeleton para 4 opciones de pago */}
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="w-full bg-white border-b border-stroke animate-pulse"
                    >
                      <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                        <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md bg-gray-200"></div>
                        <div className="flex-1">
                          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                        <div className="size-5 md:size-6 lg:size-7 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skeleton del total */}
              <div className="fixed bottom-0 left-0 right-0 bg-white mx-4 md:mx-6 lg:mx-8 px-6 md:px-8 lg:px-10 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="py-4 md:py-8 lg:py-12 space-y-2 md:space-y-3 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="h-6 bg-gray-200 rounded w-32"></div>
                    <div className="h-6 bg-gray-200 rounded w-24"></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-5 bg-gray-200 rounded w-24"></div>
                    <div className="h-5 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-even-evergreen flex flex-col">
      <MenuHeader />

      <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
        <div className="left-4 right-4 bg-even-evergreen rounded-t-4xl translate-y-7 z-0">
          <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
            <h1 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 md:leading-9 lg:leading-tight mt-2 md:mt-3 mb-6 md:mb-8">
              Elige cómo quieres pagar la cuenta
            </h1>
          </div>
        </div>

        <div className="flex-1 h-full flex flex-col overflow-hidden relative">
          <div className="bg-white rounded-t-4xl flex-1 z-5 flex flex-col overflow-hidden">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10 pb-[140px] md:pb-[160px] lg:pb-[180px]">
              {/* 4 OPCIONES PRINCIPALES DE PAGO */}
              <div className="flex flex-col mt-4 md:mt-6">
                {/* Opción 1: Pagar cuenta completa */}
                {unpaidAmount > 0 && (
                  <button
                    onClick={handlePayFullBill}
                    className="w-full bg-white cursor-pointer border-b border-stroke active:bg-even-grass/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                      <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md border border-black flex items-center justify-center">
                        <ReceiptText
                          className="text-black size-9 md:size-11 lg:size-12"
                          strokeWidth={1}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-black text-base md:text-lg lg:text-xl">
                          Pagar cuenta completa
                        </h3>
                      </div>
                      <div className="text-black">
                        <ChevronRight className="size-5 md:size-6 lg:size-7" />
                      </div>
                    </div>
                  </button>
                )}

                {/* Opción 2: Seleccionar platillos específicos */}
                {unpaidDishes.length > 0 && (
                  <button
                    onClick={handleSelectItems}
                    className="w-full bg-white cursor-pointer border-b border-stroke active:bg-even-grass/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                      <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md border border-black flex items-center justify-center">
                        <img
                          src="/icons/select-items-logo.svg"
                          alt=""
                          className="rounded-sm md:rounded-md"
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-black text-base md:text-lg lg:text-xl">
                          Seleccionar artículos
                        </h3>
                      </div>
                      <div className="text-black">
                        <ChevronRight className="size-5 md:size-6 lg:size-7" />
                      </div>
                    </div>
                  </button>
                )}

                {/* Opción 3: Dividir cuenta */}
                {unpaidAmount > 0 && (
                  <button
                    onClick={handleEqualShares}
                    className="w-full bg-white cursor-pointer border-b border-stroke active:bg-even-grass/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                      <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md border border-black flex items-center justify-center">
                        <img
                          src="/icons/split-bill-logo.png"
                          alt=""
                          className="size-9 md:size-11 lg:size-12"
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-black text-base md:text-lg lg:text-xl">
                          Dividir cuenta
                        </h3>
                        {uniqueUsers.length > 1 && (
                          <p className="text-sm md:text-base lg:text-lg text-gray-600">
                            ${(unpaidAmount / uniqueUsers.length).toFixed(2)}{" "}
                            por persona ({uniqueUsers.length} personas
                            pendientes)
                          </p>
                        )}
                      </div>
                      <div className="text-black">
                        <ChevronRight className="size-5 md:size-6 lg:size-7" />
                      </div>
                    </div>
                  </button>
                )}

                {/* Opción 4: Elegir monto personalizado */}
                {unpaidAmount > 0 && (
                  <button
                    onClick={handleChooseAmount}
                    className="w-full bg-white cursor-pointer active:bg-even-grass/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                      <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md border border-black flex items-center justify-center">
                        <DollarSign
                          className="text-black size-9 md:size-11 lg:size-12"
                          strokeWidth={1}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-black text-base md:text-lg lg:text-xl">
                          Elegir monto
                        </h3>
                      </div>
                      <div className="text-black">
                        <ChevronRight className="size-5 md:size-6 lg:size-7" />
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Total - Fixed to bottom */}
            {unpaidAmount > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white mx-4 md:mx-6 lg:mx-8 px-6 md:px-8 lg:px-10 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="py-4 md:py-8 lg:py-12 space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg md:text-2xl lg:text-3xl font-medium text-black">
                      Total mesa {tableNumber}
                    </span>
                    <span className="text-lg md:text-2xl lg:text-3xl font-medium text-black">
                      ${tableTotalPrice.toFixed(2)}
                    </span>
                  </div>
                  {paidAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-even-shamrock font-medium text-base md:text-xl lg:text-2xl">
                        Pagado:
                      </span>
                      <span className="text-even-shamrock font-medium text-base md:text-xl lg:text-2xl">
                        ${paidAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-even-grass font-medium text-base md:text-xl lg:text-2xl">
                      Restante:
                    </span>
                    <span className="text-even-grass font-medium text-base md:text-xl lg:text-2xl">
                      ${unpaidAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
