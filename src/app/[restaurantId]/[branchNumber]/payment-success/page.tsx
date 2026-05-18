"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useTable } from "@/app/context/TableContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import { useRestaurant } from "@/app/context/RestaurantContext";
import {
  Receipt,
  X,
  Calendar,
  Utensils,
  CircleAlert,
  LogIn,
  UserCircle2,
} from "lucide-react";
import { getCardTypeIcon } from "@/app/utils/cardIcons";
import { useAuth } from "@/app/context/AuthContext";

export default function PaymentSuccessPage() {
  const { restaurant, setParams } = useRestaurant();
  const { user } = useAuth();

  const { state } = useTable();
  const { navigateWithTable, tableNumber } = useTableNavigation();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

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

  // Get payment details from URL or localStorage
  const paymentId =
    searchParams.get("paymentId") || searchParams.get("orderId");
  const urlAmount = parseFloat(searchParams.get("amount") || "0");

  // Try to get stored payment details
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [rating, setRating] = useState(0); // Rating de 1 a 5 (solo enteros)
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const [hasRated, setHasRated] = useState(false); // Track if user has already rated
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(!user);

  // Handler for sign up navigation
  const handleSignUp = () => {
    // Save the current URL to redirect back after registration
    const currentUrl = window.location.pathname + window.location.search;
    sessionStorage.setItem("even-post-auth-redirect", currentUrl);

    // Navigate to auth page
    navigateWithTable("/auth");
  };

  // Bloquear scroll cuando los modales están abiertos
  useEffect(() => {
    if (isTicketModalOpen || isBreakdownModalOpen || isRegisterModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isTicketModalOpen, isBreakdownModalOpen, isRegisterModalOpen]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log(
        "📦 Payment success page - checking storage for payment data",
      );

      // Get payment ID from URL to identify this specific payment
      const urlPaymentId = paymentId || searchParams.get("transactionId");

      let storedPayment = null;
      let storageKey = "";
      let fromSession = true;

      // First, try to find the current payment key reference
      const currentKeyRef = sessionStorage.getItem("even-current-payment-key");
      if (currentKeyRef) {
        storedPayment = sessionStorage.getItem(currentKeyRef);
        storageKey = currentKeyRef;
        console.log("📦 Found payment via current-payment-key:", currentKeyRef);
      }

      // If not found, search all sessionStorage keys for payment success data
      if (!storedPayment) {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith("even-payment-success-")) {
            storedPayment = sessionStorage.getItem(key);
            storageKey = key;
            console.log("📦 Found payment via sessionStorage search:", key);
            break;
          }
        }
      }

      // If still not found, check localStorage (first time)
      if (!storedPayment) {
        fromSession = false;

        // Check for completed payment first (most recent flow)
        storedPayment = localStorage.getItem("even-completed-payment");
        storageKey = "even-completed-payment";

        // Check for pending payment (EcartPay redirect flow)
        if (!storedPayment) {
          storedPayment = localStorage.getItem("even-pending-payment");
          storageKey = "even-pending-payment";
        }

        // Check for payment intent (SDK flow)
        if (!storedPayment) {
          storedPayment = localStorage.getItem("even-payment-intent");
          storageKey = "even-payment-intent";
        }
      }

      console.log("📦 Found payment data in:", storageKey);
      console.log("📦 Raw stored data:", storedPayment);

      if (storedPayment) {
        try {
          const parsed = JSON.parse(storedPayment);
          console.log("📦 Parsed payment details:", parsed);
          setPaymentDetails(parsed);

          // If from localStorage (first time), save to sessionStorage for persistence
          if (!fromSession) {
            // Save with unique key based on payment/transaction ID
            const paymentIdentifier =
              parsed.paymentId ||
              parsed.transactionId ||
              urlPaymentId ||
              Date.now().toString();
            const uniqueKey = `even-payment-success-${paymentIdentifier}`;

            sessionStorage.setItem(uniqueKey, storedPayment);

            // Also save the current payment key reference
            sessionStorage.setItem("even-current-payment-key", uniqueKey);

            // Clean up localStorage
            localStorage.removeItem("even-pending-payment");
            localStorage.removeItem("even-payment-intent");
            localStorage.removeItem("even-completed-payment");
          }
        } catch (e) {
          console.error("Failed to parse stored payment details:", e);
        }
      } else {
        console.log("📦 No payment data found in storage");
      }
    }
  }, [paymentId, searchParams]);

  // Calculate total amount charged to client
  const amount =
    paymentDetails?.totalAmountCharged || paymentDetails?.amount || urlAmount;

  // Get payment type from paymentDetails
  const paymentType = paymentDetails?.paymentType || "";

  // Get dish orders from paymentDetails based on payment type
  const getDisplayedDishOrders = () => {
    const allDishOrders = paymentDetails?.items || [];

    if (paymentType === "select-items") {
      // For select-items, filter only the selected items
      const selectedItemIds = paymentDetails?.selectedItems || [];
      return allDishOrders.filter((dish: any) =>
        selectedItemIds.includes(dish.id?.toString()),
      );
    } else if (paymentType === "full-bill") {
      // For full-bill, show all orders
      return allDishOrders;
    } else {
      // For equal-shares and choose-amount, don't show individual items
      return [];
    }
  };

  const dishOrders = getDisplayedDishOrders();

  const handleBackToMenu = () => {
    // Clear payment success data from sessionStorage
    const currentKey = sessionStorage.getItem("even-current-payment-key");
    if (currentKey) {
      sessionStorage.removeItem(currentKey);
      sessionStorage.removeItem("even-current-payment-key");
    }
    // Fallback: also remove generic key
    sessionStorage.removeItem("even-payment-success");

    // Since session is cleared, redirect to home page to select table again
    router.push("/");
  };

  const handleGoHome = () => {
    // Clear payment success data from sessionStorage
    const currentKey = sessionStorage.getItem("even-current-payment-key");
    if (currentKey) {
      sessionStorage.removeItem(currentKey);
      sessionStorage.removeItem("even-current-payment-key");
    }
    // Fallback: also remove generic key
    sessionStorage.removeItem("even-payment-success");

    // Complete exit - go back to order page
    navigateWithTable("/order");
  };

  // Handle rating selection
  const handleRatingClick = (starRating: number) => {
    if (hasRated) {
      console.log("⚠️ User has already rated");
      return;
    }
    setRating(starRating);
  };

  // Handle rating submission
  const handleSubmitRating = async () => {
    if (hasRated || rating === 0) {
      return;
    }

    if (!restaurant?.id) {
      console.error("❌ No restaurant ID available");
      return;
    }

    try {
      console.log("🔍 Submitting restaurant review:", {
        restaurant_id: restaurant.id,
        rating: rating,
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/restaurants/restaurant-reviews`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            restaurant_id: restaurant.id,
            rating: rating,
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        console.log("✅ Restaurant review submitted successfully");
        setHasRated(true);
      } else {
        console.error("❌ Failed to submit restaurant review:", data.message);
      }
    } catch (error) {
      console.error("❌ Error submitting restaurant review:", error);
    }
  };

  return (
    <div className="min-h-dvh bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
      {/* Success Icon */}
      <div className="flex-1 flex justify-center items-center">
        <img
          src="/logos/logo-short-green.webp"
          alt="Even Logo"
          className="size-20 md:size-28 lg:size-32 animate-logo-fade-in"
        />
      </div>

      {/* Bottom Container */}
      <div className="px-4 md:px-6 lg:px-8 w-full animate-slide-up">
        <div className="flex-1 flex flex-col">
          {/* Header con gradiente */}
          <div className="left-4 right-4 bg-linear-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
            <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center items-center mb-6 md:mb-8 lg:mb-10 mt-2 md:mt-4 lg:mt-6 gap-2 md:gap-3 lg:gap-4">
              <h1 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 md:leading-9 lg:leading-tight">
                ¡Gracias por tu pago!
              </h1>
              <p className="text-white text-base md:text-lg lg:text-xl">
                Hemos recibido tu pago con éxito.
              </p>
            </div>
          </div>

          {/* Contenedor blanco fijo al bottom */}
          <div className="bg-white rounded-t-4xl relative z-10 flex flex-col min-h-80 justify-center px-6 md:px-8 lg:px-10 flex-1 py-8 md:py-10 lg:py-12">
            {/* Rating Prompt */}
            <div className="text-center mb-8 md:mb-10 lg:mb-12">
              <p className="text-xl md:text-2xl lg:text-3xl font-medium text-black mb-2 md:mb-3 lg:mb-4">
                {hasRated
                  ? "¡Gracias por tu calificación!"
                  : "Califica tu experiencia en el restaurante"}
              </p>
              <div className="flex flex-col items-center gap-3 md:gap-3.5 lg:gap-4">
                {/* Stars container */}
                <div className="flex gap-1 md:gap-1.5 lg:gap-2">
                  {[1, 2, 3, 4, 5].map((starIndex) => {
                    const currentRating = hoveredRating || rating;
                    const isFilled = currentRating >= starIndex;

                    return (
                      <div
                        key={starIndex}
                        className={`relative ${
                          hasRated ? "cursor-default" : "cursor-pointer"
                        }`}
                        onMouseEnter={() =>
                          !hasRated && setHoveredRating(starIndex)
                        }
                        onMouseLeave={() => !hasRated && setHoveredRating(0)}
                        onClick={() =>
                          !hasRated && handleRatingClick(starIndex)
                        }
                      >
                        {/* Estrella */}
                        <svg
                          className={`size-8 md:size-10 lg:size-12 transition-all ${
                            isFilled ? "text-yellow-400" : "text-white"
                          }`}
                          fill="currentColor"
                          stroke={isFilled ? "#facc15" : "black"}
                          strokeWidth="1"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </div>
                    );
                  })}
                </div>

                {/* Submit button - appears when a rating is selected */}
                {rating > 0 && !hasRated && (
                  <button
                    onClick={handleSubmitRating}
                    className="px-5 md:px-6 py-1.5 md:py-2 bg-linear-to-r from-[#34808C] to-[#173E44] hover:from-[#2a6d77] hover:to-[#12323a] text-white text-sm md:text-base font-medium rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg animate-fade-in"
                    aria-label="Enviar calificación"
                  >
                    Enviar
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div
              className="space-y-3 md:space-y-4 lg:space-y-5"
              style={{
                paddingBottom: "max(0rem, env(safe-area-inset-bottom))",
              }}
            >
              <button
                onClick={handleGoHome}
                className="w-full text-white py-3 md:py-4 lg:py-5 rounded-full cursor-pointer transition-colors bg-linear-to-r from-[#34808C] to-[#173E44] text-base md:text-lg lg:text-xl"
              >
                Volver a la orden
              </button>

              {/* Ticket btn */}
              <button
                onClick={() => setIsTicketModalOpen(true)}
                className="text-base md:text-lg lg:text-xl w-full flex items-center justify-center gap-2 md:gap-3 lg:gap-4 text-black border border-black py-3 md:py-4 lg:py-5 rounded-full cursor-pointer transition-colors bg-white hover:bg-stone-100"
              >
                <Receipt
                  className="size-5 md:size-6 lg:size-7"
                  strokeWidth={1.5}
                />
                Ver ticket de compra
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Modal */}
      {isTicketModalOpen && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-xs z-999 flex items-center justify-center"
          onClick={() => setIsTicketModalOpen(false)}
        >
          <div
            className="bg-[#173E44]/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] w-full mx-4 md:mx-12 lg:mx-28 rounded-4xl z-999 max-h-[77vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Fixed */}
            <div className="shrink-0">
              <div className="w-full flex justify-end">
                <button
                  onClick={() => setIsTicketModalOpen(false)}
                  className="p-2 md:p-3 lg:p-4 hover:bg-white/10 rounded-lg md:rounded-xl transition-colors justify-end flex items-end mt-3 md:mt-4 lg:mt-5 mr-3 md:mr-4 lg:mr-5"
                >
                  <X className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-white" />
                </button>
              </div>

              <div className="px-6 md:px-8 lg:px-10 flex items-center justify-center mb-4 md:mb-5 lg:mb-6">
                <div className="flex flex-col justify-center items-center gap-3 md:gap-4 lg:gap-5">
                  {restaurant?.logo_url ? (
                    <img
                      src={restaurant.logo_url}
                      alt={restaurant.name}
                      className="size-20 md:size-24 lg:size-28 object-cover rounded-lg md:rounded-xl"
                    />
                  ) : (
                    <Receipt className="size-20 md:size-24 lg:size-28 text-white" />
                  )}
                  <div className="flex flex-col items-center justify-center">
                    <h2 className="text-xl md:text-2xl lg:text-3xl text-white font-bold">
                      {restaurant?.name || "Restaurante"}
                    </h2>
                    <p className="text-sm md:text-base lg:text-lg text-white/80">
                      Mesa {tableNumber || "N/A"}
                    </p>
                    <p className="text-xs md:text-sm text-white/70 mt-1">
                      {new Date().toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Content - Detalles del pago + Items de la orden */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10">
              {/* Order Info */}
              <div className="border-t border-white/20 pt-4 md:pt-5 lg:pt-6">
                <h3 className="font-medium text-xl md:text-2xl lg:text-3xl text-white mb-3 md:mb-4 lg:mb-5">
                  Detalles del pago
                </h3>
                <div className="space-y-2 md:space-y-3 lg:space-y-4">
                  {paymentDetails?.userName && (
                    <div className="flex items-center gap-2 md:gap-3 lg:gap-4 text-white/90">
                      <div className="bg-orange-100 p-2 md:p-2.5 lg:p-3 rounded-xl flex items-center justify-center">
                        <Utensils className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-orange-600" />
                      </div>
                      <span className="text-sm md:text-base lg:text-lg">
                        {paymentDetails.userName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 md:gap-3 lg:gap-4 text-white/90">
                    <div className="bg-blue-100 p-2 md:p-2.5 lg:p-3 rounded-xl flex items-center justify-center">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-blue-600" />
                    </div>
                    <span className="text-sm md:text-base lg:text-lg">
                      {new Date()
                        .toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })
                        .replace(/\//g, "/")}
                    </span>
                  </div>

                  {paymentDetails?.cardLast4 && (
                    <div className="flex items-center gap-2 md:gap-3 lg:gap-4 text-white/90">
                      <div className="bg-green-100 p-2 md:p-2.5 lg:p-3 rounded-xl flex items-center justify-center">
                        <div className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 flex items-center justify-center">
                          {getCardTypeIcon(
                            paymentDetails.cardBrand || "unknown",
                            "small",
                          )}
                        </div>
                      </div>
                      <span className="text-sm md:text-base lg:text-lg">
                        *** {paymentDetails.cardLast4.slice(-3)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              {(dishOrders.length > 0 ||
                paymentType === "choose-amount" ||
                paymentType === "equal-shares") && (
                <div className="border-t border-white/20 pt-4 md:pt-5 lg:pt-6 mt-4 md:mt-5 lg:mt-6">
                  <h3 className="font-medium text-xl md:text-2xl lg:text-3xl text-white mb-3 md:mb-4 lg:mb-5">
                    Items de la orden
                  </h3>
                  <div className="space-y-3 md:space-y-4 lg:space-y-5 pb-4 md:pb-5 lg:pb-6">
                    {/* Show individual items for full-bill and select-items */}
                    {dishOrders.length > 0 &&
                      dishOrders.map((dish: any, index: number) => (
                        <div
                          key={dish.id || index}
                          className="flex justify-between items-center gap-3 md:gap-4 lg:gap-5"
                        >
                          {/* Image */}
                          <img
                            src={
                              dish.images?.[0] || "/logos/logo-short-green.webp"
                            }
                            alt={dish.item}
                            className="size-14 md:size-16 lg:size-20 object-cover rounded-lg md:rounded-xl shrink-0"
                          />
                          <div className="flex-1">
                            <p className="text-white font-medium text-base md:text-lg lg:text-xl">
                              {dish.quantity}x {dish.item}
                            </p>
                            {dish.guest_name && (
                              <p className="text-xs md:text-sm lg:text-base text-white/60 uppercase">
                                {dish.guest_name}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-white font-medium text-base md:text-lg lg:text-xl">
                              $
                              {(
                                dish.total_price ||
                                (dish.price + (dish.extra_price || 0)) *
                                  dish.quantity
                              ).toFixed(2)}{" "}
                              MXN
                            </p>
                          </div>
                        </div>
                      ))}

                    {/* Show consumo for choose-amount and equal-shares */}
                    {(paymentType === "choose-amount" ||
                      paymentType === "equal-shares") &&
                      paymentDetails?.baseAmount > 0 && (
                        <div className="flex justify-between items-start gap-3 md:gap-4 lg:gap-5">
                          <div className="flex-1">
                            <p className="text-white font-medium text-base md:text-lg lg:text-xl">
                              Consumo
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-medium text-base md:text-lg lg:text-xl">
                              ${paymentDetails.baseAmount.toFixed(2)} MXN
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Propina como item */}
                    {paymentDetails?.tipAmount > 0 && (
                      <div className="flex justify-between items-start gap-3 md:gap-4 lg:gap-5 pt-3 md:pt-4 lg:pt-5">
                        <div className="flex-1">
                          <p className="text-white font-medium text-base md:text-lg lg:text-xl">
                            Propina
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium text-base md:text-lg lg:text-xl">
                            ${paymentDetails.tipAmount.toFixed(2)} MXN
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Total Summary - Fixed at bottom */}
            <div className="shrink-0 px-6 md:px-8 lg:px-10">
              <div className="flex justify-between items-center border-t border-white/20 pt-4 md:pt-5 lg:pt-6 pb-6 md:pb-8 lg:pb-10">
                <div className="flex items-center gap-2 md:gap-3 lg:gap-4">
                  <span className="text-lg md:text-xl lg:text-2xl font-medium text-white">
                    Total
                  </span>
                  <button
                    onClick={() => setIsBreakdownModalOpen(true)}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    aria-label="Ver desglose"
                  >
                    <CircleAlert
                      className="size-4 md:size-5 lg:size-6 cursor-pointer text-white/70"
                      strokeWidth={2.3}
                    />
                  </button>
                </div>
                <span className="text-lg md:text-xl lg:text-2xl font-medium text-white">
                  ${amount.toFixed(2)} MXN
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown Modal */}
      {isBreakdownModalOpen && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 99999 }}
        >
          {/* Fondo */}
          <div
            className="absolute inset-0 bg-black/25"
            onClick={() => setIsBreakdownModalOpen(false)}
          ></div>

          {/* Modal */}
          <div className="relative bg-white rounded-t-4xl w-full mx-4 md:mx-6 lg:mx-8">
            {/* Titulo */}
            <div className="px-6 md:px-8 lg:px-10 pt-4 md:pt-6 lg:pt-8">
              <div className="flex items-center justify-between pb-4 md:pb-5 lg:pb-6 border-b border-[#8e8e8e]">
                <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-black">
                  Desglose del pago
                </h3>
                <button
                  onClick={() => setIsBreakdownModalOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <X className="size-5 md:size-6 lg:size-7 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div className="px-6 md:px-8 lg:px-10 py-4 md:py-6 lg:py-8">
              <p className="text-black text-base md:text-lg lg:text-xl mb-4 md:mb-5 lg:mb-6">
                El total se obtiene de la suma de:
              </p>
              <div className="space-y-3 md:space-y-4 lg:space-y-5">
                {paymentDetails?.baseAmount && (
                  <div className="flex justify-between items-center">
                    <span className="text-black font-medium text-base md:text-lg lg:text-xl">
                      + Consumo
                    </span>
                    <span className="text-black font-medium text-base md:text-lg lg:text-xl">
                      ${paymentDetails.baseAmount.toFixed(2)} MXN
                    </span>
                  </div>
                )}

                {paymentDetails?.tipAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-black font-medium text-base md:text-lg lg:text-xl">
                      + Propina
                    </span>
                    <span className="text-black font-medium text-base md:text-lg lg:text-xl">
                      ${paymentDetails.tipAmount.toFixed(2)} MXN
                    </span>
                  </div>
                )}

                {(paymentDetails?.evenCommissionClient || 0) +
                  (paymentDetails?.ivaEvenClient || 0) >
                  0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-black font-medium text-base md:text-lg lg:text-xl">
                      + Comisión de servicio
                    </span>
                    <span className="text-black font-medium text-base md:text-lg lg:text-xl">
                      $
                      {(
                        (paymentDetails?.evenCommissionClient || 0) +
                        (paymentDetails?.ivaEvenClient || 0)
                      ).toFixed(2)}{" "}
                      MXN
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {isRegisterModalOpen && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-xs z-999 flex items-center justify-center animate-fade-in"
          onClick={() => setIsRegisterModalOpen(false)}
        >
          <div
            className="bg-[#173E44]/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] w-full mx-4 md:mx-12 lg:mx-28 rounded-4xl z-999 flex flex-col justify-center py-12 md:py-16 lg:py-20 min-h-[70vh] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <div className="absolute top-3 md:top-4 lg:top-5 right-3 md:right-4 lg:right-5">
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-2 md:p-3 lg:p-4 hover:bg-white/10 rounded-lg md:rounded-xl transition-colors"
              >
                <X className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-white" />
              </button>
            </div>

            {/* Logo */}
            <div className="px-6 md:px-8 lg:px-10 flex items-center justify-center mb-6 md:mb-8 lg:mb-10">
              <img
                src="/logos/logo-short-white.webp"
                alt="Even Logo"
                className="size-20 md:size-24 lg:size-28"
              />
            </div>

            {/* Title */}
            <div className="px-6 md:px-8 lg:px-10 text-center mb-6 md:mb-8 lg:mb-10">
              <h1 className="text-white text-xl md:text-2xl lg:text-3xl font-medium mb-2 md:mb-3 lg:mb-4">
                ¡Tu pago fue procesado con éxito!
              </h1>
              <p className="text-white/80 text-sm md:text-base lg:text-lg">
                Crea una cuenta para hacer pedidos más rápido la próxima vez
              </p>
            </div>

            {/* Options */}
            <div className="px-6 md:px-8 lg:px-10 space-y-3 md:space-y-4 lg:space-y-5">
              {/* Sign Up Option */}
              <button
                onClick={handleSignUp}
                className="w-full bg-white hover:bg-gray-50 text-black py-4 md:py-5 lg:py-6 px-4 md:px-5 lg:px-6 rounded-xl md:rounded-2xl transition-all duration-200 flex items-center gap-3 md:gap-4 lg:gap-5 active:scale-95"
              >
                <div className="bg-linear-to-r from-[#34808C] to-[#173E44] p-2 md:p-2.5 lg:p-3 rounded-full group-hover:scale-110 transition-transform">
                  <LogIn className="size-5 md:size-6 lg:size-7 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h2 className="text-base md:text-lg lg:text-xl font-medium mb-0.5 md:mb-1">
                    Crear cuenta
                  </h2>
                  <p className="text-xs md:text-sm lg:text-base text-gray-600">
                    Regístrate y ahorra tiempo en futuros pagos
                  </p>
                </div>
              </button>

              {/* Continue as Guest Option */}
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="w-full bg-white/10 hover:bg-white/20 border-2 border-white text-white py-4 md:py-5 lg:py-6 px-4 md:px-5 lg:px-6 rounded-xl md:rounded-2xl transition-all duration-200 flex items-center gap-3 md:gap-4 lg:gap-5 group active:scale-95"
              >
                <div className="bg-white/20 p-2 md:p-2.5 lg:p-3 rounded-full group-hover:scale-110 transition-transform">
                  <UserCircle2 className="size-5 md:size-6 lg:size-7 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h2 className="text-base md:text-lg lg:text-xl font-medium mb-0.5 md:mb-1">
                    Continuar sin registrarme
                  </h2>
                  <p className="text-xs md:text-sm lg:text-base text-white/80">
                    Ver los detalles de mi pago
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
