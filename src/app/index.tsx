import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { PieChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;
const monthNames = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

type TxType = "income" | "expense" | "savings";
type Transaction = {
  id: string;
  amount: number;
  note: string;
  type: TxType;
  date: string;
};

const STORAGE_KEY = "@budget_data";
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);

export default function App() {
  const isDark = useColorScheme() === "dark";
  const palette = useMemo(
    () => ({
      bg: isDark ? "#0b0d0f" : "#f5f5f4",
      panel: isDark ? "#121416" : "#ffffff",
      panelAlt: isDark ? "#171a1d" : "#f7f7f5",
      panelSoft: isDark ? "#1a1d20" : "#f1f1ef",
      text: isDark ? "#f3f4f6" : "#111827",
      textMuted: isDark ? "#9aa3ad" : "#6b7280",
      border: isDark ? "#2b2f33" : "#e5e7eb",
      income: isDark ? "#6ee7b7" : "#1f9d77",
      expense: isDark ? "#fbbf24" : "#d97706",
      savings: isDark ? "#c4b5fd" : "#7c3aed",
      incomeBg: isDark ? "rgba(31,157,119,0.14)" : "#ecfdf5",
      expenseBg: isDark ? "rgba(217,119,6,0.12)" : "#fff7ed",
      savingsBg: isDark ? "rgba(124,58,237,0.14)" : "#f5f3ff",
      accent: isDark ? "#e5e7eb" : "#111827",
      headerText: "#f3f4f6",
      shadow: isDark ? "rgba(0,0,0,0.24)" : "rgba(17,24,39,0.06)",
      overlay: isDark ? "rgba(5,7,10,0.7)" : "rgba(17,24,39,0.4)",
      tabBar: isDark ? "#101214" : "#ffffff",
    }),
    [isDark],
  );

  // ✨ State สำหรับเปลี่ยนหน้า Tab
  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'history'

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [savingsPercent, setSavingsPercent] = useState("10");
  const [cycleDays, setCycleDays] = useState("7");
  const [dailyQuota, setDailyQuota] = useState(0);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteAnimations = useRef<Record<string, Animated.Value>>({});

  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    buttons: [] as any[],
  });

  const showAlert = (title: string, message: string, buttons: any[]) =>
    setCustomAlert({ visible: true, title, message, buttons });
  const hideAlert = () =>
    setCustomAlert((prev) => ({ ...prev, visible: false }));

  useEffect(() => {
    loadData();
  }, []);
  useEffect(() => {
    saveData(transactions);
  }, [transactions]);

  const years = useMemo(() => {
    if (!transactions.length) return [new Date().getFullYear()];
    return Array.from(
      new Set(transactions.map((tx) => new Date(tx.date).getFullYear())),
    ).sort((a, b) => a - b);
  }, [transactions]);

  useEffect(() => {
    if (!years.includes(selectedYear)) setSelectedYear(years[years.length - 1]);
  }, [selectedYear, years]);

  const filteredTransactions = useMemo(
    () =>
      transactions
        .filter((tx) => {
          const txDate = new Date(tx.date);
          return (
            txDate.getMonth() + 1 === selectedMonth &&
            txDate.getFullYear() === selectedYear
          );
        })
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
    [selectedMonth, selectedYear, transactions],
  );

  const totalIncome = filteredTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = filteredTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalSavings = filteredTransactions
    .filter((tx) => tx.type === "savings")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const chartData = useMemo(() => {
    const data = [];
    if (totalIncome > 0)
      data.push({
        name: "รายรับ",
        amount: totalIncome,
        color: palette.income,
        legendFontColor: palette.text,
        legendFontSize: 13,
      });
    if (totalExpense > 0)
      data.push({
        name: "รายจ่าย",
        amount: totalExpense,
        color: palette.expense,
        legendFontColor: palette.text,
        legendFontSize: 13,
      });
    if (totalSavings > 0)
      data.push({
        name: "เงินออม",
        amount: totalSavings,
        color: palette.savings,
        legendFontColor: palette.text,
        legendFontSize: 13,
      });
    return data;
  }, [palette, totalExpense, totalIncome, totalSavings]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) setTransactions(JSON.parse(savedData));
      const savedQuota = await AsyncStorage.getItem("@lazy_quota");
      if (savedQuota) setDailyQuota(Number(savedQuota));
    } catch (error) {
      console.error("โหลดข้อมูลพลาด:", error);
    }
  };

  const saveData = async (data: Transaction[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {}
  };

  const saveQuota = async (quota: number) => {
    try {
      setDailyQuota(quota);
      await AsyncStorage.setItem("@lazy_quota", String(quota));
    } catch (error) {}
  };

  const clearForm = () => {
    setAmount("");
    setNote("");
    setType("expense");
    setEditingId(null);
  };

  const handleSaveTransaction = () => {
    const cleanedValue = amount.replace(/,/g, "").trim();
    const parsedAmount = Number(cleanedValue);

    if (!cleanedValue || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      showAlert("ข้อมูลไม่ถูกต้อง", "กรุณาใส่จำนวนเงินที่มากกว่า 0 ด้วยนะแก", [
        { text: "ตกลง", style: "default", onPress: hideAlert },
      ]);
      return;
    }

    if (type === "income") {
      const percent = Number(savingsPercent) || 0;
      const days = Number(cycleDays) || 1;
      const savingsAmt = (parsedAmount * percent) / 100;
      const usableAmt = parsedAmount - savingsAmt;
      const calculatedQuota = usableAmt / days;

      showAlert(
        "เป้าหมายรอบนี้ 🎯",
        `รับเงินมา: ฿${formatCurrency(parsedAmount)}\nหักเข้ากระปุก (${percent}%): ฿${formatCurrency(savingsAmt)}\nเงินไว้ใช้: ฿${formatCurrency(usableAmt)}\n\n💡 โควตาวันนี้ใช้ได้: ฿${formatCurrency(calculatedQuota)} /วัน`,
        [
          { text: "ยกเลิก", style: "cancel", onPress: hideAlert },
          {
            text: "บันทึกเลย",
            style: "default",
            onPress: () => {
              hideAlert();
              const now = new Date().toISOString();
              const incomeTx: Transaction = {
                id: Date.now().toString(),
                amount: parsedAmount,
                note: note.trim() || "รายรับ",
                type: "income",
                date: now,
              };
              const newTxs = [incomeTx];
              if (savingsAmt > 0)
                newTxs.push({
                  id: (Date.now() + 1).toString(),
                  amount: savingsAmt,
                  note: "🐷 หักออมอัตโนมัติ",
                  type: "savings",
                  date: now,
                });

              setTransactions((prev) => [...newTxs, ...prev]);
              saveQuota(calculatedQuota);
              clearForm();
              setActiveTab("home"); // เด้งกลับหน้าโฮม
            },
          },
        ],
      );
    } else {
      const data: Transaction = {
        id: editingId ?? Date.now().toString(),
        amount: parsedAmount,
        note: note.trim() || "รายจ่าย",
        type: "expense",
        date: editingId
          ? (transactions.find((tx) => tx.id === editingId)?.date ??
            new Date().toISOString())
          : new Date().toISOString(),
      };
      if (editingId)
        setTransactions((prev) =>
          prev.map((tx) => (tx.id === editingId ? { ...tx, ...data } : tx)),
        );
      else setTransactions((prev) => [data, ...prev]);

      if (type === "expense" && !editingId)
        saveQuota(Math.max(0, dailyQuota - parsedAmount));
      clearForm();
    }
  };

  const handleDeleteTransaction = (id: string) => {
    showAlert("ลบรายการใช่ไหม", "รายการนี้จะถูกลบออกจากประวัติทันที", [
      { text: "ยกเลิก", style: "cancel", onPress: hideAlert },
      {
        text: "ลบเลย",
        style: "destructive",
        onPress: () => {
          hideAlert();
          const animation = ensureDeleteAnimation(id);
          setDeletingId(id);
          Animated.spring(animation, {
            toValue: 1,
            friction: 8,
            tension: 120,
            useNativeDriver: true,
          }).start(() => {
            setTransactions((prev) => {
              const next = prev.filter((tx) => tx.id !== id);
              void saveData(next);
              return next;
            });
            if (editingId === id) clearForm();
            setDeletingId(null);
            animation.setValue(0);
          });
        },
      },
    ]);
  };

  const ensureDeleteAnimation = (id: string) => {
    if (!deleteAnimations.current[id])
      deleteAnimations.current[id] = new Animated.Value(0);
    return deleteAnimations.current[id];
  };

  // ----------------------------------------------------------------
  // 🌟 ส่วนที่ 1: หน้า HOME (แดชบอร์ด + บันทึกเงิน)
  // ----------------------------------------------------------------
  const renderHome = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={[
          styles.headerShell,
          { backgroundColor: palette.panel, shadowColor: palette.shadow },
        ]}
      >
        <Text style={[styles.eyebrow, { color: palette.textMuted }]}>
          LAZY BUDGET
        </Text>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: palette.textMuted }]}>
              โควตาวันนี้ใช้ได้
            </Text>
            <Text
              style={[
                styles.headerAmount,
                { color: dailyQuota >= 0 ? palette.text : "#ef4444" },
              ]}
            >
              ฿{formatCurrency(dailyQuota)}
            </Text>
          </View>
          <View
            style={[
              styles.headerPill,
              {
                backgroundColor: palette.panelSoft,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.headerPillText, { color: palette.textMuted }]}>
              ออม
            </Text>
            <Text style={[styles.headerPillValue, { color: palette.savings }]}>
              ฿{formatCurrency(totalSavings)}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.panel, shadowColor: palette.shadow },
        ]}
      >
        <View
          style={[styles.typeSelector, { backgroundColor: palette.panelSoft }]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.typeBtn,
              type === "expense" && { backgroundColor: palette.expense },
              { transform: [{ scale: pressed ? 0.985 : 1 }] },
            ]}
            onPress={() => setType("expense")}
          >
            <Text
              style={[
                styles.typeBtnText,
                { color: type === "expense" ? "#ffffff" : palette.textMuted },
              ]}
            >
              จ่ายออก
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.typeBtn,
              type === "income" && { backgroundColor: palette.income },
              { transform: [{ scale: pressed ? 0.985 : 1 }] },
            ]}
            onPress={() => setType("income")}
          >
            <Text
              style={[
                styles.typeBtnText,
                { color: type === "income" ? "#ffffff" : palette.textMuted },
              ]}
            >
              รับเงิน
            </Text>
          </Pressable>
        </View>

        <TextInput
          style={[
            styles.input,
            styles.amountInput,
            {
              backgroundColor: palette.panelAlt,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          placeholderTextColor={palette.textMuted}
          returnKeyType="done"
        />

        {type === "income" && (
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: palette.textMuted,
                  marginBottom: 4,
                  marginLeft: 4,
                }}
              >
                หักออม (%)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.panelAlt,
                    borderColor: palette.border,
                    color: palette.text,
                    marginBottom: 0,
                  },
                ]}
                keyboardType="numeric"
                value={savingsPercent}
                onChangeText={setSavingsPercent}
                placeholderTextColor={palette.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: palette.textMuted,
                  marginBottom: 4,
                  marginLeft: 4,
                }}
              >
                ใช้กี่วัน? (วัน)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.panelAlt,
                    borderColor: palette.border,
                    color: palette.text,
                    marginBottom: 0,
                  },
                ]}
                keyboardType="numeric"
                value={cycleDays}
                onChangeText={setCycleDays}
                placeholderTextColor={palette.textMuted}
              />
            </View>
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: palette.panelAlt,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
          placeholder={
            type === "income"
              ? "เช่น แม่โอนค่าขนมให้"
              : "เช่น ค่าข้าว, ค่าเดินทาง"
          }
          value={note}
          onChangeText={setNote}
          placeholderTextColor={palette.textMuted}
          returnKeyType="done"
        />

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: palette.accent, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleSaveTransaction}
        >
          <Text style={styles.saveBtnText}>
            {type === "income" ? "คำนวณและบันทึก" : "บันทึกรายจ่าย"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.spacer} />
    </ScrollView>
  );

  // ----------------------------------------------------------------
  // 🌟 ส่วนที่ 2: หน้า HISTORY (ประวัติและกราฟ)
  // ----------------------------------------------------------------
  const renderHistory = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.filterSection,
          {
            backgroundColor: palette.panel,
            shadowColor: palette.shadow,
            borderColor: palette.border,
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: palette.textMuted }]}>
          เลือกเดือน
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {monthNames.map((month, index) => {
            const active = selectedMonth === index + 1;
            return (
              <Pressable
                key={month}
                onPress={() => setSelectedMonth(index + 1)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: active
                      ? palette.accent
                      : palette.panelSoft,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: active
                        ? isDark
                          ? "#111827"
                          : "#ffffff"
                        : palette.textMuted,
                    },
                  ]}
                >
                  {month}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.summaryGrid}>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: palette.incomeBg, shadowColor: palette.shadow },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: palette.income }]}>
            เงินเข้า
          </Text>
          <Text style={[styles.summaryValue, { color: palette.text }]}>
            ฿{formatCurrency(totalIncome)}
          </Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: palette.expenseBg, shadowColor: palette.shadow },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: palette.expense }]}>
            จ่ายออก
          </Text>
          <Text style={[styles.summaryValue, { color: palette.text }]}>
            ฿{formatCurrency(totalExpense)}
          </Text>
        </View>
      </View>

      {chartData.length > 0 && (
        <View
          style={[
            styles.chartCard,
            { backgroundColor: palette.panel, shadowColor: palette.shadow },
          ]}
        >
          <Text style={[styles.chartTitle, { color: palette.text }]}>
            สัดส่วนการเงินเดือนนี้
          </Text>
          <PieChart
            data={chartData}
            width={screenWidth - 48}
            height={180}
            chartConfig={{ color: () => palette.textMuted }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="10"
            absolute
          />
        </View>
      )}

      <Text style={[styles.historyTitle, { color: palette.text }]}>
        รายการทั้งหมด ({filteredTransactions.length})
      </Text>
      {filteredTransactions.length === 0 ? (
        <View
          style={[
            styles.emptyState,
            { backgroundColor: palette.panel, borderColor: palette.border },
          ]}
        >
          <Ionicons
            name="receipt-outline"
            size={40}
            color={palette.textMuted}
          />
          <Text style={[styles.emptyStateText, { color: palette.textMuted }]}>
            ยังไม่มีรายการในเดือนนี้
          </Text>
        </View>
      ) : (
        filteredTransactions.map((tx) => {
          const progress = ensureDeleteAnimation(tx.id);
          const isDeleting = deletingId === tx.id;
          let badgeColor = palette.expenseBg;
          let iconColor = palette.expense;
          let iconName = "arrow-up-circle";
          let prefix = "-";
          if (tx.type === "income") {
            badgeColor = palette.incomeBg;
            iconColor = palette.income;
            iconName = "arrow-down-circle";
            prefix = "+";
          } else if (tx.type === "savings") {
            badgeColor = palette.savingsBg;
            iconColor = palette.savings;
            iconName = "cube";
            prefix = "+";
          }

          return (
            <Animated.View
              key={tx.id}
              style={[
                styles.historyItem,
                {
                  backgroundColor: palette.panel,
                  shadowColor: palette.shadow,
                  borderColor: palette.border,
                  opacity: isDeleting
                    ? progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      })
                    : 1,
                  transform: [
                    {
                      scale: isDeleting
                        ? progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 0.96],
                          })
                        : 1,
                    },
                    {
                      translateX: isDeleting
                        ? progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -18],
                          })
                        : 0,
                    },
                  ],
                },
              ]}
            >
              <View style={styles.historyMain}>
                <View
                  style={[styles.historyBadge, { backgroundColor: badgeColor }]}
                >
                  <Ionicons
                    name={iconName as any}
                    size={20}
                    color={iconColor}
                  />
                </View>
                <View style={styles.historyTextWrap}>
                  <Text style={[styles.historyNote, { color: palette.text }]}>
                    {tx.note}
                  </Text>
                  <Text
                    style={[styles.historyDate, { color: palette.textMuted }]}
                  >
                    {new Date(tx.date).toLocaleDateString("th-TH")}
                  </Text>
                </View>
              </View>
              <View style={styles.historyActions}>
                <Text style={[styles.historyAmount, { color: iconColor }]}>
                  {prefix}฿{formatCurrency(tx.amount)}
                </Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => handleDeleteTransaction(tx.id)}
                    style={({ pressed }) => [
                      styles.iconButton,
                      {
                        opacity: pressed ? 0.6 : 1,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          );
        })
      )}
      <View style={styles.spacer} />
    </ScrollView>
  );

  // ----------------------------------------------------------------
  // 🌟 MAIN RENDER
  // ----------------------------------------------------------------
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={palette.bg}
      />

      {/* Modal */}
      <Modal transparent visible={customAlert.visible} animationType="fade">
        <View
          style={[styles.modalOverlay, { backgroundColor: palette.overlay }]}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: palette.panel,
                shadowColor: palette.shadow,
                borderColor: palette.border,
              },
            ]}
          >
            <View
              style={[
                styles.modalIconWrapper,
                { backgroundColor: palette.panelSoft },
              ]}
            >
              <Ionicons
                name={
                  customAlert.buttons.some((b) => b.style === "destructive")
                    ? "warning"
                    : "information-circle"
                }
                size={28}
                color={
                  customAlert.buttons.some((b) => b.style === "destructive")
                    ? "#ef4444"
                    : palette.text
                }
              />
            </View>
            <Text style={[styles.modalTitle, { color: palette.text }]}>
              {customAlert.title}
            </Text>
            <Text style={[styles.modalMessage, { color: palette.textMuted }]}>
              {customAlert.message}
            </Text>
            <View style={styles.modalButtonContainer}>
              {customAlert.buttons.map((btn, index) => {
                const isCancel = btn.style === "cancel";
                const isDestructive = btn.style === "destructive";
                return (
                  <Pressable
                    key={index}
                    onPress={btn.onPress}
                    style={({ pressed }) => [
                      styles.modalButton,
                      {
                        flex: customAlert.buttons.length === 2 ? 1 : undefined,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                      index > 0 && { marginLeft: 10 },
                      isCancel
                        ? { backgroundColor: palette.panelSoft }
                        : isDestructive
                          ? { backgroundColor: "#111827" }
                          : { backgroundColor: palette.panelSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        { color: isCancel ? palette.text : palette.text },
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Render หน้าตาม Tab ที่เลือก */}
        {activeTab === "home" && renderHome()}
        {activeTab === "history" && renderHistory()}

        {/* 🌟 BOTTOM NAVIGATION BAR สุดคูล 🌟 */}
        <View
          style={[
            styles.bottomNav,
            {
              backgroundColor: palette.tabBar,
              borderTopColor: palette.border,
              shadowColor: palette.shadow,
            },
          ]}
        >
          <Pressable
            style={styles.tabItem}
            onPress={() => setActiveTab("home")}
          >
            <Ionicons
              name={activeTab === "home" ? "home" : "home-outline"}
              size={22}
              color={activeTab === "home" ? palette.text : palette.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "home" ? palette.text : palette.textMuted,
                },
              ]}
            >
              หน้าหลัก
            </Text>
          </Pressable>
          <Pressable
            style={styles.tabItem}
            onPress={() => setActiveTab("history")}
          >
            <Ionicons
              name={activeTab === "history" ? "pie-chart" : "pie-chart-outline"}
              size={22}
              color={activeTab === "history" ? palette.text : palette.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "history" ? palette.text : palette.textMuted,
                },
              ]}
            >
              ประวัติ
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  contentContainer: { paddingTop: 16, paddingBottom: 20 },
  headerShell: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: { fontSize: 14, marginBottom: 4 },
  headerAmount: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  headerPill: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: "flex-end",
  },
  headerPillText: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  headerPillValue: { fontSize: 15, fontWeight: "700" },
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  typeSelector: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBtnText: { fontWeight: "700", fontSize: 15 },
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  amountInput: { fontSize: 24, fontWeight: "bold", textAlign: "right" },
  saveBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#ffffff", fontSize: 17, fontWeight: "bold" },
  filterSection: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    borderWidth: 1,
  },
  filterChip: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  filterChipText: { fontWeight: "700", fontSize: 14 },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 20,
    padding: 18,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  summaryLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  summaryValue: { fontSize: 22, fontWeight: "800" },
  chartCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  chartTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  historyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
    marginLeft: 4,
  },
  emptyState: {
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  emptyStateText: { marginTop: 12, fontSize: 15, fontWeight: "600" },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  historyMain: { flexDirection: "row", alignItems: "center", flex: 1 },
  historyTextWrap: { flexShrink: 1 },
  historyBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  historyNote: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  historyDate: { fontSize: 13 },
  historyActions: { alignItems: "flex-end", minWidth: 80 },
  historyAmount: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.1)",
  },
  spacer: { height: 80 }, // เผื่อพื้นที่ให้ Bottom Nav ไม่ทับเนื้อหาด้านล่างสุด

  // Custom Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    width: "100%",
    borderRadius: 26,
    padding: 22,
    elevation: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    alignItems: "center",
    borderWidth: 1,
  },
  modalIconWrapper: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
  },
  modalButtonText: { fontSize: 15, fontWeight: "700" },

  // ✨ สไตล์สำหรับ Bottom Navigation
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? 22 : 10,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
