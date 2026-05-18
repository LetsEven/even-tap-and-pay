"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Phone, User, ChevronDown } from "lucide-react";
import Flag from "react-world-flags";
import { authService } from "@/app/services/auth.service";
import { useRestaurant } from "@/app/context/RestaurantContext";
import { useAuth } from "@/app/context/AuthContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import { orderService } from "@/app/services/order.service";
import { useTable } from "@/app/context/TableContext";

type Step = "phone" | "verify" | "profile";

interface Country {
  code: string;
  flag: string;
  name: string;
}

const countries: Country[] = [
  { code: "+52", flag: "MX", name: "México" },
  { code: "+1", flag: "US", name: "Estados Unidos" },
  { code: "+34", flag: "ES", name: "España" },
  { code: "+54", flag: "AR", name: "Argentina" },
  { code: "+57", flag: "CO", name: "Colombia" },
  { code: "+58", flag: "VE", name: "Venezuela" },
];

export default function AuthPage() {
  const router = useRouter();
  const { navigateWithTable } = useTableNavigation();
  const params = useParams();
  const searchParams = useSearchParams();
  const {
    verifyOTP,
    createOrUpdateProfile: updateProfile,
    refreshProfile,
    user,
    profile,
  } = useAuth();
  const { state } = useTable();

  const restaurantId = params?.restaurantId as string;
  const branchNumber = params?.branchNumber as string;
  const tableNumber = searchParams.get("table");

  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+52");
  const [phoneNumber, setPhoneNumber] = useState(""); // Solo números sin formato
  const [phoneNumberDisplay, setPhoneNumberDisplay] = useState(""); // Con formato para mostrar
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const authCompletedRef = useRef(false);

  // Formatear número de teléfono para mostrar
  const formatPhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber) return "";

    const cleaned = phoneNumber.replace(/\D/g, "");

    // Sin código de país - solo 10 dígitos
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }

    // Con código de país
    if (cleaned.length > 10) {
      const countryCode = cleaned.slice(0, cleaned.length - 10);
      const areaCode = cleaned.slice(-10, -7);
      const firstPart = cleaned.slice(-7, -4);
      const lastPart = cleaned.slice(-4);
      return `+${countryCode} (${areaCode}) ${firstPart}-${lastPart}`;
    }

    return phoneNumber;
  };

  // Formatear número mientras se escribe (para el input)
  const formatPhoneInput = (value: string) => {
    const cleaned = value.replace(/\D/g, "");

    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    } else if (cleaned.length <= 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }

    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".country-selector")) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Clean up session storage when leaving page without completing auth
  useEffect(() => {
    const cleanup = () => {
      if (!authCompletedRef.current) {
        sessionStorage.removeItem("authFromPaymentFlow");
        sessionStorage.removeItem("authFromMenu");
        sessionStorage.removeItem("even-post-auth-redirect");
        sessionStorage.removeItem("pendingTableRedirect");
        sessionStorage.removeItem("pendingRestaurantId");
      }
    };

    // Push a state to intercept back navigation (only if not already added)
    if (!window.history.state?.evenAuth) {
      window.history.pushState({ evenAuth: true }, "");
    }

    const handlePopState = () => {
      cleanup();
      // Remove listener to prevent loop, then complete the back navigation
      window.removeEventListener("popstate", handlePopState);
      // Check if there's history to go back to, otherwise go to menu
      if (window.history.length > 2) {
        window.history.back();
      } else {
        // No previous history, navigate to menu
        router.replace(
          `/${restaurantId}/${branchNumber}/menu${tableNumber ? `?table=${tableNumber}` : ""}`,
        );
      }
    };

    // For browser back/forward navigation
    window.addEventListener("popstate", handlePopState);
    // For page unload (close tab, refresh)
    window.addEventListener("beforeunload", cleanup);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", cleanup);
    };
  }, []);

  // Helper function to handle post-auth redirects
  const handleAuthRedirect = () => {
    // Mark auth as completed so cleanup doesn't remove session items
    authCompletedRef.current = true;

    const postAuthRedirect = sessionStorage.getItem("even-post-auth-redirect");

    if (postAuthRedirect) {
      sessionStorage.removeItem("even-post-auth-redirect");
      // Navigate directly to the saved URL
      router.push(postAuthRedirect);
      return;
    }

    const authFromPaymentFlow = sessionStorage.getItem("authFromPaymentFlow");
    const authFromMenu = sessionStorage.getItem("authFromMenu");

    // Clear all session flags
    sessionStorage.removeItem("pendingTableRedirect");
    sessionStorage.removeItem("pendingRestaurantId");
    sessionStorage.removeItem("authFromPaymentFlow");
    sessionStorage.removeItem("authFromMenu");
    sessionStorage.removeItem("even-post-auth-redirect");

    if (authFromMenu && tableNumber) {
      // User signed in from MenuView settings, redirect to dashboard
      navigateWithTable("/dashboard");
    } else if (authFromPaymentFlow && tableNumber) {
      // User signed up during payment flow, redirect to payment-options
      navigateWithTable("/card-selection");
    } else {
      // Default redirect to menu
      navigateWithTable("/menu");
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const fullPhone = countryCode + phoneNumber;
      setPhone(fullPhone);

      const response = await authService.sendOTPCode(fullPhone);

      if (response.success) {
        setStep("verify");
        setCountdown(60);
      } else {
        setError(response.error || "Error al enviar el código");
      }
    } catch (err) {
      setError("Error al enviar el código OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (otp.length !== 6) {
      setError("El código debe tener 6 dígitos");
      setLoading(false);
      return;
    }

    try {
      const response = await verifyOTP(phone, otp);

      if (response.success) {
        // Check if profile exists
        const profileResponse = await authService.getMyProfile();

        if (profileResponse.success && profileResponse.data) {
          // Handle nested data structure: data.data.profile or data.profile or data
          const responseData = profileResponse.data as any;
          const profile =
            responseData.data?.profile ||
            responseData.profile ||
            responseData.data ||
            responseData;

          console.log("👤 profile object:", profile);
          console.log("👤 profile.firstName:", profile.firstName);

          // If profile has firstName, redirect based on context
          if (profile.firstName) {
            await refreshProfile();
            handleAuthRedirect();
          } else {
            // Profile exists but incomplete, go to profile step
            setStep("profile");
          }
        } else {
          // No profile, go to profile step
          setStep("profile");
        }
      } else {
        setError(response.error || "Código inválido");
      }
    } catch (err) {
      console.error("❌ Error in handleVerifyOTP:", err);
      setError("Error al verificar el código");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setError("");
    setLoading(true);

    try {
      const response = await authService.sendOTPCode(phone);

      if (response.success) {
        setCountdown(60);
      } else {
        setError(response.error || "Error al reenviar el código");
      }
    } catch (err) {
      setError("Error al reenviar el código");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await updateProfile({
        firstName,
        lastName,
        birthDate,
        gender: gender as "male" | "female" | "other",
      });

      if (response.success) {
        // Refresh profile data to get the updated information
        await refreshProfile();

        // Redirect based on context
        handleAuthRedirect();
      } else {
        setError(response.error || "Error al guardar el perfil");
      }
    } catch (err) {
      setError("Error al guardar el perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-new bg-linear-to-br from-[#0a8b9b] to-[#153f43] flex flex-col justify-center items-center px-4">
      {/* Back Button */}
      <button
        onClick={() => {
          if (step === "verify") {
            setStep("phone");
            setOtp("");
            setError("");
          } else if (step === "profile") {
            // Can't go back from profile, user is already authenticated
            return;
          } else {
            sessionStorage.removeItem("authFromPaymentFlow");
            sessionStorage.removeItem("authFromMenu");
            sessionStorage.removeItem("even-post-auth-redirect");
            sessionStorage.removeItem("pendingTableRedirect");
            sessionStorage.removeItem("pendingRestaurantId");
            router.back();
          }
        }}
        disabled={step === "profile"}
        className={`absolute top-4 md:top-6 lg:top-8 left-4 md:left-6 lg:left-8 p-2 md:p-3 text-white rounded-full transition-all active:bg-white/10 z-20 ${
          step === "profile"
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-white/10"
        }`}
      >
        <ArrowLeft className="size-5 md:size-6 lg:size-7" />
      </button>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img
            src="/logos/logo-short-green.webp"
            alt="Even Logo"
            className="size-18 mx-auto mb-4"
          />
          <h1 className="text-2xl font-medium text-white">
            {step === "phone"
              ? "Ingresa tu número"
              : step === "verify"
                ? "Verifica tu código"
                : "Completa tu perfil"}
          </h1>
          <p className="text-gray-200 mt-2">
            {step === "phone"
              ? "Te enviaremos un código de verificación para tu registro"
              : step === "verify"
                ? `Enviamos un código al ${formatPhoneNumber(phone)}`
                : "Cuéntanos un poco más sobre ti"}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-white text-sm">
            {error}
          </div>
        )}

        {/* Phone Input Step */}
        {step === "phone" && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-3">
                {/* Country Code Selector */}
                <div className="relative country-selector">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="h-[48px] w-[90px] px-3 text-gray-700 font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] focus:border-transparent cursor-pointer hover:border-gray-400 transition-colors flex items-center justify-between gap-1.5"
                    disabled={loading}
                  >
                    <div className="flex items-center gap-1.5">
                      <Flag
                        code={
                          countries.find((c) => c.code === countryCode)?.flag ||
                          "MX"
                        }
                        style={{ width: 20, height: 15, borderRadius: 2 }}
                      />
                      <span className="text-sm">{countryCode}</span>
                    </div>
                    <ChevronDown className="size-3 text-gray-500 shrink-0" />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 overflow-hidden">
                      {countries.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => {
                            setCountryCode(country.code);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-100 transition-colors text-left"
                        >
                          <Flag
                            code={country.flag}
                            style={{ width: 20, height: 15, borderRadius: 2 }}
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {country.code}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone Number Input */}
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                  <input
                    required
                    type="tel"
                    value={phoneNumberDisplay}
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/\D/g, "");
                      setPhoneNumber(value);
                      setPhoneNumberDisplay(formatPhoneInput(value));
                    }}
                    className="h-[48px] w-full pl-10 pr-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] focus:border-transparent"
                    placeholder="Número de teléfono"
                    disabled={loading}
                    maxLength={14}
                  />
                </div>
              </div>
              <p className="text-gray-300 text-xs">
                Ejemplo:{" "}
                {countryCode === "+52"
                  ? "500 555 0006"
                  : countryCode === "+1"
                    ? "500 555 0006"
                    : "123 456 789"}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !phoneNumber || phoneNumber.length < 8}
              className="w-full bg-black hover:bg-stone-950 text-white py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        )}

        {/* OTP Verification Step */}
        {step === "verify" && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full px-3 py-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] text-center tracking-widest text-2xl"
              required
              disabled={loading}
              autoFocus
              autoComplete="one-time-code"
            />

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-black hover:bg-stone-950 text-white py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Verificando..." : "Verificar código"}
            </button>

            {/* Resend Button */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={countdown > 0 || loading}
                className={`text-sm underline transition-colors ${
                  countdown > 0
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-white hover:text-gray-200 cursor-pointer"
                }`}
              >
                {countdown > 0
                  ? `Reenviar código en ${countdown}s`
                  : "¿No recibiste el código? Reenviar"}
              </button>
            </div>

            {/* Change Number */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setError("");
                }}
                className="text-sm text-white hover:text-gray-200 underline"
              >
                Cambiar número
              </button>
            </div>
          </form>
        )}

        {/* Profile Completion Step */}
        {step === "profile" && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nombre"
                  className="h-[48px] w-full pl-10 pr-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] appearance-none"
                  required
                  disabled={loading}
                />
              </div>

              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Apellido"
                className="h-[48px] w-full px-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] appearance-none"
                required
                disabled={loading}
              />
            </div>

            {/* Birth Date */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="h-[48px] w-full px-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] appearance-none"
                disabled={loading}
                required
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Género
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="h-[48px] w-full px-3 text-gray-600 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a8b9b] cursor-pointer appearance-none"
                disabled={loading}
                required
              >
                <option value="">Selecciona...</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                loading || !firstName || !lastName || !birthDate || !gender
              }
              className="w-full bg-black hover:bg-stone-950 text-white py-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? "Guardando..." : "Continuar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
