import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../theme";
import { setTokens } from "../lib/auth";

const BLUE = colors.primary[600];
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

type Step = "phone" | "otp";

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);

  const isPhoneValid = /^[6-9]\d{9}$/.test(phone);

  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!isPhoneValid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+91${phone}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send OTP");
      setStep("otp");
      startResendTimer();
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+91${phone}`, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid OTP");
      setTokens(data.accessToken, data.refreshToken);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Verification failed. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-advance to next input
    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (text && index === 5 && newOtp.every((d) => d)) {
      setTimeout(() => handleVerifyOtp(), 100);
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        {/* Logo / Brand */}
        <View style={styles.brandSection}>
          <Text style={styles.logo}>CliniqAI</Text>
          <Text style={styles.tagline}>AI-Powered Clinic Management</Text>
        </View>

        {step === "phone" ? (
          <View style={styles.formSection}>
            <Text style={styles.heading}>Doctor Login</Text>
            <Text style={styles.subheading}>Enter your registered mobile number</Text>

            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="10-digit mobile number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, !isPhoneValid && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={!isPhoneValid || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formSection}>
            <Text style={styles.heading}>Verify OTP</Text>
            <Text style={styles.subheading}>
              Enter the 6-digit code sent to +91 {phone}
            </Text>

            {/* OTP Boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { otpRefs.current[i] = ref; }}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, i)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  autoFocus={i === 0}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, otp.some((d) => !d) && styles.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={otp.some((d) => !d) || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Verify & Login</Text>
              )}
            </TouchableOpacity>

            {/* Resend */}
            <View style={styles.resendRow}>
              {resendTimer > 0 ? (
                <Text style={styles.resendTimer}>Resend in {resendTimer}s</Text>
              ) : (
                <TouchableOpacity onPress={handleSendOtp}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setStep("phone"); setOtp(["", "", "", "", "", ""]); }}>
                <Text style={styles.changePhone}>Change number</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.footer}>By continuing, you agree to CliniqAI&apos;s Terms of Service</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  brandSection: { alignItems: "center", marginBottom: 40 },
  logo: { fontSize: 36, fontWeight: "800", color: BLUE },
  tagline: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  formSection: {},
  heading: { fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 4 },
  subheading: { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  phoneRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  countryCode: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  countryCodeText: { fontSize: 16, color: "#374151", fontWeight: "600" },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: "#111827",
    letterSpacing: 1,
  },
  primaryBtn: {
    backgroundColor: BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  otpBoxFilled: { borderColor: BLUE },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  resendTimer: { fontSize: 13, color: "#9ca3af" },
  resendLink: { fontSize: 13, color: BLUE, fontWeight: "600" },
  changePhone: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  footer: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 32,
  },
});
