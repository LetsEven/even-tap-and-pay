"use client";

import { useSearchParams, useParams } from "next/navigation";
import { useTable } from "@/app/context/TableContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import { useRestaurant } from "@/app/context/RestaurantContext";
import { usePayment } from "@/app/context/PaymentContext";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useGuest } from "@/app/context/GuestContext";
import MenuHeader from "@/app/components/headers/MenuHeader";
import OrderAnimation from "@/app/components/UI/OrderAnimation";
import { paymentService } from "@/app/services/payment.service";
import { Plus, Trash2, Loader2, CircleAlert, X } from "lucide-react";
import { getCardTypeIcon } from "@/app/utils/cardIcons";

export default function CardSelectionPage() {
  const { state, setTableNumber, loadTableData } = useTable();
  const { navigateWithTable, tableNumber } = useTableNavigation();
  const searchParams = useSearchParams();
  const params = useParams();
  const { setParams, params: restaurantParams } = useRestaurant();
  const { hasPaymentMethods, paymentMethods, deletePaymentMethod } =
    usePayment();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { guestId } = useGuest();

  // Tarjeta por defecto del sistema
  const defaultSystemCard = {
    id: "system-default-card",
    lastFourDigits: "1234",
    cardBrand: "amex",
    cardType: "credit",
    isDefault: true,
    isSystemCard: true,
  };

  const allPaymentMethods = [defaultSystemCard, ...paymentMethods];

  const paymentType = searchParams.get("type") || "full-bill";
  const totalAmountCharged = parseFloat(searchParams.get("amount") || "0");
  const baseAmount = parseFloat(searchParams.get("baseAmount") || "0");
  const tipAmount = parseFloat(searchParams.get("tipAmount") || "0");
  const ivaTip = parseFloat(searchParams.get("ivaTip") || "0");
  const evenCommissionClient = parseFloat(
    searchParams.get("evenCommissionClient") || "0",
  );
  const ivaEvenClient = parseFloat(searchParams.get("ivaEvenClient") || "0");
  const evenCommissionRestaurant = parseFloat(
    searchParams.get("evenCommissionRestaurant") || "0",
  );
  const evenCommissionTotal = parseFloat(
    searchParams.get("evenCommissionTotal") || "0",
  );
  const selectedItemsParam = searchParams.get("selectedItems");

  const evenClientCharge = evenCommissionClient + ivaEvenClient;
  const ivaEvenRestaurant = evenCommissionRestaurant * 0.16;
  const evenRestaurantCharge = evenCommissionRestaurant + ivaEvenRestaurant;
  const subtotalForCommission = baseAmount + tipAmount;
  const evenRateApplied =
    subtotalForCommission > 0
      ? (evenCommissionTotal / subtotalForCommission) * 100
      : 0;

  // Get name from profile or localStorage for guests
  const effectiveName =
    (profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile?.firstName || "") ||
    (typeof window !== "undefined"
      ? localStorage.getItem("even-guest-name") || ""
      : "");

  const [name, setName] = useState(effectiveName);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [showPaymentAnimation, setShowPaymentAnimation] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [showTotalModal, setShowTotalModal] = useState(false);
  const [showPaymentOptionsModal, setShowPaymentOptionsModal] = useState(false);
  const [selectedMSI, setSelectedMSI] = useState<number | null>(null);
  const [pendingPaymentData, setPendingPaymentData] = useState<{
    paymentId: string;
    amount: number;
    paymentType: string;
  } | null>(null);

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
    const newName =
      (profile?.firstName && profile?.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : profile?.firstName || "") || "";
    if (newName && newName !== name) {
      setName(newName);
    }

    if (paymentType === "select-items" && selectedItemsParam) {
      setSelectedItems(
        selectedItemsParam.split(",").filter((item) => item.trim() !== ""),
      );
    }
  }, [profile, paymentType, selectedItemsParam]);

  // Cargar datos de la mesa
  useEffect(() => {
    const loadData = async () => {
      if (!tableNumber) {
        console.log("⚠️ Card selection: Waiting for tableNumber...");
        return;
      }

      if (!restaurantParams?.restaurantId || !restaurantParams?.branchNumber) {
        console.log("⚠️ Card selection: Waiting for restaurant params...");
        return;
      }

      if (!state.order) {
        console.log("🔄 Card selection: Loading table data (no order)");
        await loadTableData();
      } else if (state.order?.order_id) {
        if (!state.order.items || state.order.items.length === 0) {
          console.log("🔄 Card selection: Loading table data (missing data)");
          await loadTableData();
        } else {
          console.log("✅ Card selection: Data already loaded");
        }
      }
    };
    loadData();
  }, [tableNumber, state.order, restaurantParams]);

  const dishes = state.order?.items || [];
  const unpaidDishes = dishes.filter(
    (dish) => dish.payment_status === "not_paid" || !dish.payment_status,
  );

  useEffect(() => {
    if (!selectedPaymentMethodId && allPaymentMethods.length > 0) {
      const defaultMethod =
        allPaymentMethods.find((pm) => pm.isDefault) || allPaymentMethods[0];
      setSelectedPaymentMethodId(defaultMethod.id);
      console.log("💳 Auto-seleccionando tarjeta:", defaultMethod.id);
    }
    setIsLoadingInitial(false);
  }, [allPaymentMethods.length]);

  // Calcular el total a mostrar según la opción MSI seleccionada
  const getDisplayTotal = () => {
    if (selectedMSI === null) {
      return totalAmountCharged;
    }

    // Obtener el tipo de tarjeta seleccionada
    const selectedMethod = allPaymentMethods.find(
      (pm) => pm.id === selectedPaymentMethodId,
    );
    const cardBrand = selectedMethod?.cardBrand;

    // Configuración de MSI según el tipo de tarjeta
    const msiOptions =
      cardBrand === "amex"
        ? [
            { months: 3, rate: 3.25 },
            { months: 6, rate: 6.25 },
            { months: 9, rate: 8.25 },
            { months: 12, rate: 10.25 },
            { months: 15, rate: 13.25 },
            { months: 18, rate: 15.25 },
            { months: 21, rate: 17.25 },
            { months: 24, rate: 19.25 },
          ]
        : [
            { months: 3, rate: 3.5 },
            { months: 6, rate: 5.5 },
            { months: 9, rate: 8.5 },
            { months: 12, rate: 11.5 },
            { months: 18, rate: 15.0 },
          ];

    // Encontrar la opción seleccionada
    const selectedOption = msiOptions.find((opt) => opt.months === selectedMSI);
    if (!selectedOption) return totalAmountCharged;

    // Calcular comisión e IVA
    const commission = totalAmountCharged * (selectedOption.rate / 100);
    const ivaCommission = commission * 0.16;
    return totalAmountCharged + commission + ivaCommission;
  };

  const displayTotal = getDisplayTotal();

  // Esta función se ejecuta DESPUÉS de que expira el período de cancelación (4 segundos)
  // Es cuando realmente se procesa el pago en el servidor
  const handleConfirmPayment = async () => {
    if (!pendingPaymentData) {
      console.error("❌ No hay datos de pago pendientes");
      return;
    }

    const { paymentId, amount, paymentType } = pendingPaymentData;

    try {
      console.log("✅ Procesando pago confirmado (después de 4 seg)...");

      const realPaymentMethodId =
        selectedPaymentMethodId === "system-default-card"
          ? null
          : selectedPaymentMethodId;

      // Obtener guest_id del contexto o de localStorage
      let currentGuestId = guestId;
      if (!currentGuestId && !user?.id) {
        currentGuestId = localStorage.getItem("even-guest-id");
      }

      // guest_name debe contener el nombre visible, sea invitado o usuario registrado
      const displayName = user?.id
        ? `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() ||
          "Usuario"
        : name.trim() || "Invitado";

      // Ejecutar el pago según el tipo (incluyendo tarjeta del sistema)
      if (paymentType === "select-items") {
        await paymentService.paySelectedDishes({
          dishIds: selectedItems,
          paymentMethodId: realPaymentMethodId,
          userId: user?.id,
          guestId: !user?.id ? currentGuestId : null,
          guestName: displayName,
        });
      } else if (paymentType === "equal-shares") {
        await paymentService.paySplitAmount({
          orderId: state.order?.order_id!,
          userId: user?.id,
          guestId: !user?.id ? currentGuestId : null,
          guestName: displayName,
          paymentMethodId: realPaymentMethodId,
        });
      } else if (
        paymentType === "full-bill" ||
        paymentType === "choose-amount"
      ) {
        // Asegurarse de que tenemos todos los parámetros requeridos
        if (!baseAmount || baseAmount <= 0) {
          console.error("❌ baseAmount inválido:", baseAmount);
          throw new Error("El monto del pago debe ser mayor a 0");
        }

        console.log("💰 Parámetros del pago:", {
          orderId: state.order?.order_id,
          amount: baseAmount,
          userId: user?.id,
          guestId: !user?.id ? currentGuestId : null,
          guestName: displayName,
          paymentMethodId: realPaymentMethodId,
        });

        await paymentService.payOrderAmount({
          orderId: state.order?.order_id!,
          amount: baseAmount,
          userId: user?.id,
          guestId: !user?.id ? currentGuestId : null,
          guestName: displayName,
          paymentMethodId: realPaymentMethodId,
        });
      }

      // Guardar datos del pago para payment-success
      const selectedMethod = allPaymentMethods.find(
        (pm) => pm.id === selectedPaymentMethodId,
      );

      const paymentData = {
        paymentId: paymentId,
        transactionId: paymentId,
        amount: amount,
        totalAmountCharged: totalAmountCharged,
        baseAmount: baseAmount,
        tipAmount: tipAmount,
        ivaTip: ivaTip,
        evenCommissionClient: evenCommissionClient,
        evenCommissionRestaurant: evenCommissionRestaurant,
        ivaEvenClient: ivaEvenClient,
        ivaEvenRestaurant: ivaEvenRestaurant,
        paymentType: paymentType,
        userName: profile?.firstName || name,
        cardLast4: selectedMethod?.lastFourDigits,
        cardBrand: selectedMethod?.cardBrand,
        items:
          paymentType === "select-items"
            ? unpaidDishes.filter((d) => selectedItems.includes(d.id))
            : unpaidDishes,
        selectedItems:
          paymentType === "select-items" ? selectedItems : undefined,
      };

      // Guardar en localStorage
      localStorage.setItem(
        "even-completed-payment",
        JSON.stringify(paymentData),
      );
      console.log("💾 Payment data saved to localStorage");

      // Operaciones en segundo plano
      const backgroundOperations = async () => {
        try {
          console.log("🔄 Reloading table data after payment (background)...");
          await loadTableData();

          // Registrar transacción de pago
          console.log("📊 Recording payment transaction (background)");

          const transactionPaymentMethodId =
            selectedPaymentMethodId === "system-default-card"
              ? null
              : selectedPaymentMethodId;

          await paymentService.recordPaymentTransaction({
            payment_method_id: transactionPaymentMethodId,
            restaurant_id: parseInt(restaurantParams?.restaurantId!),
            id_tap_pay_order: state.order?.order_id || null,
            base_amount: baseAmount,
            tip_amount: tipAmount,
            iva_tip: ivaTip,
            even_commission_total: evenCommissionTotal,
            even_commission_client: evenCommissionClient,
            even_commission_restaurant: evenCommissionRestaurant,
            iva_even_client: ivaEvenClient,
            iva_even_restaurant: ivaEvenRestaurant,
            even_client_charge: evenClientCharge,
            even_restaurant_charge: evenRestaurantCharge,
            even_rate_applied: evenRateApplied,
            total_amount_charged: totalAmountCharged,
            subtotal_for_commission: subtotalForCommission,
            currency: "MXN",
          });
          console.log(
            "✅ Payment transaction recorded successfully (background)",
          );
        } catch (transactionError) {
          console.error("❌ Error in background operations:", transactionError);
        }
      };

      backgroundOperations();
    } catch (error) {
      console.error("❌ Error in handleConfirmPayment:", error);
      setShowPaymentAnimation(false);
      setIsProcessing(false);
      setIsAnimatingOut(false);
      setPendingPaymentData(null);
      alert("Error al procesar el pago. Por favor intenta de nuevo.");
    }
  };

  const handlePayment = async () => {
    if (isProcessing) return;

    if (!selectedPaymentMethodId) {
      alert("Por favor selecciona un método de pago");
      return;
    }

    console.log("💳 Iniciando proceso de pago...");
    setIsProcessing(true);

    try {
      // Si se seleccionó la tarjeta del sistema, procesar pago directamente
      if (selectedPaymentMethodId === "system-default-card") {
        console.log(
          "💳 Sistema: Procesando pago con tarjeta del sistema (sin cargo real)",
        );

        const mockPaymentId = `system-payment-${Date.now()}`;

        setPendingPaymentData({
          paymentId: mockPaymentId,
          amount: totalAmountCharged,
          paymentType,
        });

        setShowPaymentAnimation(true);
        return;
      }

      // Para tarjetas reales de usuario
      const mockPaymentId = `payment-${Date.now()}`;

      setPendingPaymentData({
        paymentId: mockPaymentId,
        amount: totalAmountCharged,
        paymentType,
      });

      setShowPaymentAnimation(true);
    } catch (error) {
      console.error("Error al preparar pago:", error);
      setIsProcessing(false);
      alert("Error al procesar el pago. Por favor intenta de nuevo.");
    }
  };

  const handleAddCard = (): void => {
    const queryParams = new URLSearchParams({
      amount: totalAmountCharged.toString(),
      baseAmount: baseAmount.toString(),
      tipAmount: tipAmount.toString(),
      ivaTip: ivaTip.toString(),
      evenCommissionClient: evenCommissionClient.toString(),
      ivaEvenClient: ivaEvenClient.toString(),
      evenCommissionRestaurant: evenCommissionRestaurant.toString(),
      evenCommissionTotal: evenCommissionTotal.toString(),
      type: paymentType,
    });

    navigateWithTable(`/add-card?${queryParams.toString()}`);
  };

  const handleDeleteCard = async (cardId: string) => {
    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar este método de pago? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }

    setDeletingCardId(cardId);
    try {
      await deletePaymentMethod(cardId);
      if (selectedPaymentMethodId === cardId) {
        setSelectedPaymentMethodId(null);
      }
    } catch (error) {
      console.error("Error al eliminar tarjeta:", error);
      alert("Error al eliminar el método de pago");
    } finally {
      setDeletingCardId(null);
    }
  };

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

  if (isLoadingInitial || authLoading) {
    return (
      <div className="min-h-dvh bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
        <div
          className="fixed top-0 left-0 right-0 z-50"
          style={{ zIndex: 999 }}
        >
          <MenuHeader />
        </div>
        <div className="h-20"></div>
        <div className="w-full flex-1 flex items-center justify-center">
          <Loader2 className="size-10 text-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* OrderAnimation se renderiza encima del contenido */}
      {showPaymentAnimation && (
        <OrderAnimation
          userName={profile?.firstName || name}
          orderedItems={
            paymentType === "select-items"
              ? unpaidDishes.filter((d) => selectedItems.includes(d.id))
              : unpaidDishes
          }
          onContinue={() => {
            navigateWithTable(
              `/payment-success?paymentId=${pendingPaymentData?.paymentId || Date.now()}&amount=${totalAmountCharged}`,
            );
          }}
          onCancel={() => {
            setShowPaymentAnimation(false);
            setIsProcessing(false);
            setIsAnimatingOut(false);
            setPendingPaymentData(null);
            console.log("❌ Payment cancelled by user");
          }}
          onConfirm={handleConfirmPayment}
        />
      )}

      <div className="min-h-dvh bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
        {/* Fixed Header */}
        <div
          className="fixed top-0 left-0 right-0 z-50"
          style={{ zIndex: 999 }}
        >
          <div className={isAnimatingOut ? "animate-fade-out" : ""}>
            <MenuHeader />
          </div>
        </div>

        {/* Spacer for fixed header */}
        <div className="h-20"></div>

        <div
          className={`w-full flex-1 flex flex-col justify-end ${isAnimatingOut ? "animate-slide-down" : ""}`}
        >
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
            <div className="flex flex-col relative mx-4 md:mx-6 lg:mx-8 w-full">
              <div className="left-4 right-4 bg-linear-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
                <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
                  <h1 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 md:leading-9 lg:leading-tight mt-2 md:mt-3 mb-6 md:mb-8">
                    Selecciona tu método de pago
                  </h1>
                </div>
              </div>

              <div className="bg-white rounded-t-4xl relative z-10 flex flex-col px-6 md:px-8 lg:px-10 flex-1 py-8 md:py-10 lg:py-12">
                {/* Payment Summary */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                        Total a pagar
                      </span>
                      <CircleAlert
                        className="size-4 cursor-pointer text-gray-500"
                        strokeWidth={2.3}
                        onClick={() => setShowTotalModal(true)}
                      />
                    </div>
                    <div className="text-right">
                      {selectedMSI !== null ? (
                        <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                          ${(displayTotal / selectedMSI).toFixed(2)} MXN x{" "}
                          {selectedMSI} meses
                        </span>
                      ) : (
                        <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                          ${displayTotal.toFixed(2)} MXN
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payment Options - Solo mostrar si es tarjeta de crédito */}
                  {(() => {
                    const selectedMethod = allPaymentMethods.find(
                      (pm) => pm.id === selectedPaymentMethodId,
                    );
                    return selectedMethod?.cardType === "credit" ? (
                      <div
                        className="py-2 cursor-pointer"
                        onClick={() => setShowPaymentOptionsModal(true)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                            Pago a meses
                          </span>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedMSI !== null
                                ? "border-[#eab3f4] bg-[#eab3f4]"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedMSI !== null && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Saved Cards List */}
                <div>
                  <div className="space-y-2.5 mb-2.5">
                    {allPaymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`flex items-center py-1.5 px-5 pl-10 border rounded-full transition-colors ${
                          selectedPaymentMethodId === method.id
                            ? "border-teal-500 bg-teal-50"
                            : "border-black/50 bg-[#f9f9f9]"
                        }`}
                      >
                        <div
                          onClick={() => setSelectedPaymentMethodId(method.id)}
                          className="flex items-center justify-center gap-3 mx-auto cursor-pointer text-base md:text-lg lg:text-xl"
                        >
                          <div>{getCardTypeIcon(method.cardBrand)}</div>
                          <div>
                            <p className="text-black">
                              **** **** **** {method.lastFourDigits}
                            </p>
                          </div>
                        </div>

                        <div
                          onClick={() => setSelectedPaymentMethodId(method.id)}
                          className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                            selectedPaymentMethodId === method.id
                              ? "border-teal-500 bg-teal-500"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedPaymentMethodId === method.id && (
                            <div className="w-full h-full rounded-full bg-white scale-50"></div>
                          )}
                        </div>

                        {/* Delete Button - No mostrar para tarjeta del sistema */}
                        {!method.isSystemCard && (
                          <button
                            onClick={() => handleDeleteCard(method.id)}
                            disabled={deletingCardId === method.id}
                            className="pl-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Eliminar tarjeta"
                          >
                            {deletingCardId === method.id ? (
                              <Loader2 className="size-5 animate-spin" />
                            ) : (
                              <Trash2 className="size-5" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Method Section */}
                <div>
                  <button
                    onClick={handleAddCard}
                    className="border border-black/50 flex justify-center items-center gap-1 w-full text-black py-3 rounded-full cursor-pointer transition-colors bg-[#f9f9f9] hover:bg-gray-100 text-base md:text-lg lg:text-xl"
                  >
                    <Plus className="size-5" />
                    Agregar método de pago
                  </button>
                </div>

                {/* Bottom section with button */}
                <div className="pt-4">
                  {/* Pay Button */}
                  <button
                    onClick={handlePayment}
                    disabled={isProcessing || !selectedPaymentMethodId}
                    className={`w-full text-white py-3 rounded-full cursor-pointer transition-colors text-base md:text-lg lg:text-xl active:scale-90 ${
                      isProcessing || !selectedPaymentMethodId
                        ? "bg-linear-to-r from-[#34808C] to-[#173E44] opacity-50 cursor-not-allowed"
                        : "bg-linear-to-r from-[#34808C] to-[#173E44] animate-pulse-button"
                    }`}
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center gap-2 md:gap-3">
                        <Loader2 className="size-5 animate-spin" />
                        <span>Procesando...</span>
                      </div>
                    ) : !selectedPaymentMethodId ? (
                      "Selecciona una tarjeta"
                    ) : (
                      "Pagar"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de resumen del total */}
        {showTotalModal && (
          <div
            className="fixed inset-0 flex items-end justify-center backdrop-blur-sm"
            style={{ zIndex: 99999 }}
          >
            {/* Fondo */}
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setShowTotalModal(false)}
            ></div>

            {/* Modal */}
            <div className="relative bg-white rounded-t-4xl w-full mx-4">
              {/* Titulo */}
              <div className="px-6 pt-4">
                <div className="flex items-center justify-between pb-4 border-b border-[#8e8e8e]">
                  <h3 className="text-lg font-semibold text-black">
                    Resumen del total
                  </h3>
                  <button
                    onClick={() => setShowTotalModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="size-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="px-6 py-4">
                <p className="text-black mb-4">
                  El total se obtiene de la suma de:
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-black font-medium">+ Consumo</span>
                    <span className="text-black font-medium">
                      ${baseAmount.toFixed(2)} MXN
                    </span>
                  </div>
                  {tipAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-black font-medium">+ Propina</span>
                      <span className="text-black font-medium">
                        ${tipAmount.toFixed(2)} MXN
                      </span>
                    </div>
                  )}
                  {evenCommissionClient + ivaEvenClient > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-black font-medium">
                        + Comisión de servicio
                      </span>
                      <span className="text-black font-medium">
                        ${(evenCommissionClient + ivaEvenClient).toFixed(2)} MXN
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de opciones de pago */}
        {showPaymentOptionsModal && (
          <div
            className="fixed inset-0 flex items-end justify-center backdrop-blur-sm"
            style={{ zIndex: 99999 }}
          >
            {/* Fondo */}
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setShowPaymentOptionsModal(false)}
            ></div>

            {/* Modal */}
            <div className="relative bg-white rounded-t-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              {/* Titulo */}
              <div className="px-6 pt-4 sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between pb-4 border-b border-[#8e8e8e]">
                  <h3 className="text-lg font-semibold text-black">
                    Opciones de pago
                  </h3>
                  <button
                    onClick={() => setShowPaymentOptionsModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="size-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="px-6 py-4">
                {(() => {
                  const selectedMethod = allPaymentMethods.find(
                    (pm) => pm.id === selectedPaymentMethodId,
                  );
                  const cardBrand = selectedMethod?.cardBrand;

                  // Configuración de MSI según el tipo de tarjeta
                  const msiOptions =
                    cardBrand === "amex"
                      ? [
                          { months: 3, rate: 3.25, minAmount: 0 },
                          { months: 6, rate: 6.25, minAmount: 0 },
                          { months: 9, rate: 8.25, minAmount: 0 },
                          { months: 12, rate: 10.25, minAmount: 0 },
                          { months: 15, rate: 13.25, minAmount: 0 },
                          { months: 18, rate: 15.25, minAmount: 0 },
                          { months: 21, rate: 17.25, minAmount: 0 },
                          { months: 24, rate: 19.25, minAmount: 0 },
                        ]
                      : [
                          // Visa/Mastercard
                          { months: 3, rate: 3.5, minAmount: 300 },
                          { months: 6, rate: 5.5, minAmount: 600 },
                          { months: 9, rate: 8.5, minAmount: 900 },
                          { months: 12, rate: 11.5, minAmount: 1200 },
                          { months: 18, rate: 15.0, minAmount: 1800 },
                        ];

                  return (
                    <div className="space-y-2.5">
                      {/* Opción: Pago completo */}
                      <div
                        onClick={() => setSelectedMSI(null)}
                        className={`py-2 px-5 border rounded-full cursor-pointer transition-colors ${
                          selectedMSI === null
                            ? "border-teal-500 bg-teal-50"
                            : "border-black/50 bg-[#f9f9f9] hover:border-gray-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-black text-base md:text-lg">
                              Pago completo
                            </p>
                            <p className="text-xs md:text-sm text-gray-600">
                              ${totalAmountCharged.toFixed(2)} MXN
                            </p>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedMSI === null
                                ? "border-teal-500 bg-teal-500"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedMSI === null && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Separador */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">
                            Pago a meses
                          </span>
                        </div>
                      </div>

                      {/* Opciones MSI */}
                      {(() => {
                        const availableOptions = msiOptions.filter(
                          (option) => totalAmountCharged >= option.minAmount,
                        );
                        const hasUnavailableOptions =
                          availableOptions.length < msiOptions.length;
                        const minAmountNeeded = msiOptions[0]?.minAmount || 0;

                        return (
                          <>
                            {availableOptions.map((option) => {
                              // Calcular comisión e IVA
                              const commission =
                                totalAmountCharged * (option.rate / 100);
                              const ivaCommission = commission * 0.16;
                              const totalWithCommission =
                                totalAmountCharged + commission + ivaCommission;
                              const monthlyPayment =
                                totalWithCommission / option.months;

                              return (
                                <div
                                  key={option.months}
                                  onClick={() => setSelectedMSI(option.months)}
                                  className={`py-2 px-5 border rounded-full cursor-pointer transition-colors ${
                                    selectedMSI === option.months
                                      ? "border-teal-500 bg-teal-50"
                                      : "border-black/50 bg-[#f9f9f9] hover:border-gray-400"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-black text-base md:text-lg">
                                        {option.months} meses
                                      </p>
                                      <p className="text-xs md:text-sm text-gray-600">
                                        ${monthlyPayment.toFixed(2)} MXN
                                        mensuales · Total $
                                        {totalWithCommission.toFixed(2)} MXN
                                      </p>
                                    </div>
                                    <div
                                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                        selectedMSI === option.months
                                          ? "border-teal-500 bg-teal-500"
                                          : "border-gray-300"
                                      }`}
                                    >
                                      {selectedMSI === option.months && (
                                        <div className="w-full h-full rounded-full bg-white scale-50"></div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {hasUnavailableOptions &&
                              totalAmountCharged < minAmountNeeded && (
                                <p className="text-xs md:text-sm text-gray-500 text-center mt-2">
                                  Monto mínimo ${minAmountNeeded.toFixed(2)} MXN
                                  para pagos a meses
                                </p>
                              )}
                          </>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>

              {/* Footer con botón de confirmar */}
              <div className="px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
                <button
                  onClick={() => setShowPaymentOptionsModal(false)}
                  className="w-full bg-linear-to-r from-[#34808C] to-[#173E44] text-white py-3 rounded-full cursor-pointer transition-colors text-base"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
