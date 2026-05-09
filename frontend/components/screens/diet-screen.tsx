import { useState, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { analyzeDiet, analyzeDietByText } from "@/lib/api/diet";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BottomNav } from "@/components/ui/navigation-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollHeader } from "@/components/ui/scroll-header";
import { useScrollHeader } from "@/hooks/use-scroll-header";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Camera,
  ArrowLeft,
  Upload,
  Scan,
  Utensils,
  Flame,
  Wheat,
  Beef,
  Droplet,
  ChevronRight,
  X,
  PencilLine,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DietEntry } from "@/lib/types";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type AnalysisState = "idle" | "uploading" | "analyzing" | "complete";

const mealTypeLabels: Record<MealType, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
};

// 영양소별 팔레트
const NUTRIENT_COLORS = {
  calories: { bg: "#FFF9D6", icon: "#D97706", bar: "#F5C842", text: "#8C6010" },
  carbs: { bg: "#E8F9D6", icon: "#3E8C28", bar: "#87D57B", text: "#3E8C28" },
  protein: { bg: "#D6EEFF", icon: "#2878B0", bar: "#5BB8E0", text: "#2878B0" },
  fat: { bg: "#FFE4ED", icon: "#C0305A", bar: "#F09BB0", text: "#C0305A" },
};

export function DietScreen() {
  const {
    userProfile,
    setScreen,
    dietEntries,
    addDietEntry,
    removeDietEntry,
    completeMission,
    updateMissionProgress,
    missions,
  } = useAppStore();

  const { toast } = useToast();
  const isScrolled = useScrollHeader();

  const [viewMode, setViewMode] = useState<"main" | "detail">("main");

  const [selectedMeal, setSelectedMeal] = useState<MealType>("lunch");
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisResult, setAnalysisResult] = useState<DietEntry | null>(null);

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualFoodName, setManualFoodName] = useState("");

  const [selectedEntry, setSelectedEntry] = useState<DietEntry | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ── ML API 추가 필드 ── */
  const [apiExtra, setApiExtra] = useState<{
    food_name: string;
    diet_score: number;
    highlight: "calories" | "protein" | "carbs";
    health_notes: string[];
    healthier_alternative: { name: string; reason: string } | null;
    confidence: number;
    alternatives: { name: string; confidence: number }[];
  } | null>(null);

  const todayEntries = dietEntries.filter(
    (e) => new Date(e.timestamp).toDateString() === new Date().toDateString(),
  );

  const totalCalories = todayEntries.reduce((sum, e) => sum + e.calories, 0);
  const totalCarbs = todayEntries.reduce((sum, e) => sum + e.carbs, 0);
  const totalProtein = todayEntries.reduce((sum, e) => sum + e.protein, 0);
  const totalFat = todayEntries.reduce((sum, e) => sum + e.fat, 0);

  // 일일 권장 칼로리 (Mifflin-St Jeor)
  let dailyCalories = 2000;
  if (userProfile?.height && userProfile?.weight && userProfile?.age) {
    let bmr =
      10 * userProfile.weight + 6.25 * userProfile.height - 5 * userProfile.age;
    bmr += userProfile.gender === "male" ? 5 : -161;
    let activityMultiplier = 1.2;
    if (userProfile.physicalActivity === "11-20") activityMultiplier = 1.375;
    if (userProfile.physicalActivity === "21-30") activityMultiplier = 1.55;
    dailyCalories = Math.round(bmr * activityMultiplier);
  }

  const dailyGoal = {
    calories: dailyCalories,
    carbs: Math.round((dailyCalories * 0.5) / 4),
    protein: Math.round((dailyCalories * 0.3) / 4),
    fat: Math.round((dailyCalories * 0.2) / 9),
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 같은 파일 재선택 가능하도록 초기화
    e.target.value = "";

    // 기존 미리보기 URL 해제 후 새로 생성
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setAnalysisState("uploading");
    setApiExtra(null);
    setAnalysisResult(null);

    try {
      setAnalysisState("analyzing");
      const data = await analyzeDiet(file);

      const entry: DietEntry = {
        id: String(data.diet_id ?? crypto.randomUUID()),
        mealType: selectedMeal,
        calories: data.calories,
        carbs: data.carbs,
        protein: data.protein,
        fat: 0, // 백엔드 응답에 fat 없음 → 0으로 처리
        feedback: data.health_notes?.[0] ?? "",
        timestamp: new Date(),
      };
      setAnalysisResult(entry);
      setApiExtra({
        food_name: data.food_name,
        diet_score: data.diet_score,
        highlight: data.highlight as "calories" | "protein" | "carbs",
        health_notes: data.health_notes ?? [],
        healthier_alternative: data.healthier_alternative ?? null,
        confidence: data.classification?.confidence ?? 1,
        alternatives: data.classification?.alternatives ?? [],
      });
      setAnalysisState("complete");
    } catch (err: any) {
      setAnalysisState("idle");
      toast({
        title: "분석 실패",
        description:
          err?.message ?? "사진 분석에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  const handleManualSubmit = async () => {
    if (!manualFoodName.trim()) return;
    const foodName = manualFoodName.trim();
    setShowManualModal(false);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAnalysisState("analyzing");
    setManualFoodName("");
    try {
      const data = await analyzeDietByText(foodName);
      const entry: DietEntry = {
        id: String(data.diet_id ?? crypto.randomUUID()),
        mealType: selectedMeal,
        calories: data.calories,
        carbs: data.carbs,
        protein: data.protein,
        fat: 0,
        feedback: data.health_notes?.[0] ?? "",
        timestamp: new Date(),
      };
      setAnalysisResult(entry);
      setApiExtra({
        food_name: data.food_name,
        diet_score: data.diet_score,
        highlight: data.highlight as "calories" | "protein" | "carbs",
        health_notes: data.health_notes ?? [],
        healthier_alternative: data.healthier_alternative ?? null,
        confidence: data.classification?.confidence ?? 1,
        alternatives: data.classification?.alternatives ?? [],
      });
      setAnalysisState("complete");
    } catch (err: any) {
      setAnalysisState("idle");
      toast({
        title: "분석 실패",
        description: err?.message ?? "음식 분석에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const checkDietMissions = (analysisData: {
    calories: number;
    carbs: number;
    protein: number;
  }) => {
    const newlyAchieved: string[] = [];
    missions.forEach((mission) => {
      if (mission.completed) return;
      const isCountingMission =
        mission.category === "diet" &&
        mission.type === "auto" &&
        (mission.title.includes("기록") ||
          mission.title.includes("분석") ||
          mission.title.includes("조절"));
      if (isCountingMission) {
        const next = mission.current + 1;
        if (next >= mission.target) {
          completeMission(mission.id);
          newlyAchieved.push(mission.title);
        } else updateMissionProgress(mission.id, next);
      } else if (
        mission.title.includes("저칼로리") &&
        analysisData.calories <= 500
      ) {
        completeMission(mission.id);
        newlyAchieved.push(mission.title);
      } else if (
        mission.title.includes("저탄수화물") &&
        analysisData.carbs <= 50
      ) {
        completeMission(mission.id);
        newlyAchieved.push(mission.title);
      } else if (
        mission.title.includes("단백질") &&
        analysisData.protein >= 30
      ) {
        const next = mission.current + 1;
        if (next >= mission.target) {
          completeMission(mission.id);
          newlyAchieved.push(mission.title);
        } else updateMissionProgress(mission.id, next);
      }
    });
    if (newlyAchieved.length > 0) {
      toast({
        title: "🎉 식단 미션 자동 달성!",
        description: newlyAchieved.map((m) => `• ${m}`).join("\n"),
      });
    }
  };

  const handleSaveEntry = () => {
    if (analysisResult) {
      const entryToSave = {
        ...analysisResult,
        ...(apiExtra && {
          food_name: apiExtra.food_name,
          health_notes: apiExtra.health_notes,
          healthier_alternative: apiExtra.healthier_alternative,
        }),
      };
      addDietEntry(entryToSave);
      checkDietMissions({
        calories: analysisResult.calories,
        carbs: analysisResult.carbs,
        protein: analysisResult.protein,
      });
      toast({
        title: "저장 완료",
        description: "식단이 성공적으로 기록되었습니다.",
      });
      setAnalysisResult(null);
      setApiExtra(null);
      setAnalysisState("idle");
    }
  };

  const handleDeleteEntry = () => {
    if (selectedEntry) {
      removeDietEntry(selectedEntry.id);
      setViewMode("main");
      setSelectedEntry(null);
      toast({
        title: "삭제 완료",
        description: "식단 기록이 삭제되었습니다.",
        variant: "destructive",
      });
    }
  };

  const openDetailView = (entry: DietEntry, keepPhoto = false) => {
    if (!keepPhoto) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
    setSelectedEntry(entry);
    setViewMode("detail");
  };

  // ─── 영양소 프로그레스 바 ───────────────────────────
  const NutrientBar = ({
    label,
    amount,
    minTarget,
    maxTarget,
    barColor,
  }: {
    label: string;
    amount: number;
    minTarget: number;
    maxTarget: number;
    barColor: string;
  }) => {
    const isLacking = amount < minTarget;
    const isExcess = amount > maxTarget;
    const status = isLacking ? "부족" : isExcess ? "과다" : "적정";
    const statusStyle =
      isLacking || isExcess
        ? { bg: "#FFE4ED", color: "#C0305A" }
        : { bg: "#E8F9D6", color: "#3E8C28" };

    const maxValue = Math.max(maxTarget * 1.5, amount * 1.2, 1);
    const fillPct = Math.min((amount / maxValue) * 100, 100);
    const targetLeft = (minTarget / maxValue) * 100;
    const targetW = ((maxTarget - minTarget) / maxValue) * 100;

    return (
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2.5">
          <h4 className="text-[15px] font-bold text-[#3C3C3C]">
            {label}
            <span
              className="ml-1.5 text-[15px] font-black"
              style={{ color: barColor }}
            >
              {amount}g
            </span>
          </h4>
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.color,
            }}
          >
            {status}
          </span>
        </div>
        <div
          className="relative h-3.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "#F0F0F0" }}
        >
          {/* 목표 범위 영역 */}
          <div
            className="absolute h-full z-10"
            style={{
              left: `${targetLeft}%`,
              width: `${targetW}%`,
              backgroundColor: `${barColor}30`,
              borderLeft: `1.5px dashed ${barColor}80`,
              borderRight: `1.5px dashed ${barColor}80`,
            }}
          />
          {/* 실제 채움 바 */}
          <div
            className="absolute h-full rounded-full transition-all duration-700 z-20"
            style={{ width: `${fillPct}%`, backgroundColor: barColor }}
          />
        </div>
        <div className="relative h-4 mt-1 text-[11px] font-medium text-[#9B9B9B]">
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${targetLeft}%` }}
          >
            {minTarget}
          </span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${targetLeft + targetW}%` }}
          >
            {maxTarget}
          </span>
        </div>
      </div>
    );
  };

  // ─── 상세 화면 ────────────────────────────────────────
  if (viewMode === "detail" && selectedEntry) {
    const score = 68;
    const mealCarbs = dailyGoal.carbs / 3;
    const mealProtein = dailyGoal.protein / 3;
    const mealFat = dailyGoal.fat / 3;
    const targetCarbsMin = Math.round(mealCarbs * 0.85);
    const targetCarbsMax = Math.round(mealCarbs * 1.15);
    const targetProteinMin = Math.round(mealProtein * 0.85);
    const targetProteinMax = Math.round(mealProtein * 1.15);
    const targetFatMin = Math.round(mealFat * 0.85);
    const targetFatMax = Math.round(mealFat * 1.15);

    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="min-h-screen bg-[#FFFFFF] pb-32 flex flex-col">
        {/* ── 스크롤 시 나타나는 컴팩트 헤더 ── */}
        <ScrollHeader
          title={`${mealTypeLabels[selectedEntry.mealType]} 식단 분석`}
          onBack={() => setViewMode("main")}
          visible={isScrolled}
        />

        {/* ── 기본 헤더 (default) ── */}
        <div className="bg-white border-b border-black/[0.06]">
          <div className="flex items-center gap-1 px-4 pt-12 pb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("main")}
              className="shrink-0 text-[#3C3C3C]"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="ms-1 flex-1">
              <h1 className="text-[18px] font-bold text-[#3C3C3C] leading-snug">
                {mealTypeLabels[selectedEntry.mealType]} 식단 분석
              </h1>
              <p className="text-[13px] text-[#7A7A7A] font-medium">
                AI 영양소 분석 결과
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-[#C0305A] hover:bg-[#FFE4ED]"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="size-5" />
            </Button>
          </div>
        </div>

        {/* 음식 사진 / 아이콘 */}
        <div className="aspect-video mx-5 mt-4 rounded-2xl border border-black/[0.06] shadow-[0_1px_6px_rgba(0,0,0,0.04)] overflow-hidden bg-[#F9FFEF] flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="분석된 음식 사진"
              className="w-full h-full object-cover"
            />
          ) : (
            <Utensils className="size-16 text-[#CBF891]" />
          )}
        </div>

        {/* 점수 요약 */}
        <div className="flex flex-col items-center pt-8 pb-7 px-6 border-b border-black/[0.06]">
          <div className="relative w-36 h-36 mb-5 flex items-center justify-center">
            <svg
              className="w-full h-full -rotate-90 absolute"
              viewBox="0 0 128 128"
            >
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke="#CBF891"
                strokeWidth="10"
              />
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke="#3E8C28"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-[38px] font-black text-[#3E8C28] leading-none">
                {score}
              </span>
              <span className="text-[13px] font-bold text-[#3E8C28]">점</span>
            </div>
          </div>
          <h2 className="text-[18px] font-bold text-[#3C3C3C] mb-2">
            영양소가 조금 부족해요!
          </h2>
          <p className="text-[13px] text-[#7A7A7A] text-center leading-relaxed px-2">
            {selectedEntry.feedback}
          </p>
        </div>

        {/* 영양소 칩 요약 */}
        <div className="grid grid-cols-3 gap-2.5 mx-5 mt-5">
          {[
            {
              label: "탄수화물",
              value: `${selectedEntry.carbs}g`,
              ...NUTRIENT_COLORS.carbs,
            },
            {
              label: "단백질",
              value: `${selectedEntry.protein}g`,
              ...NUTRIENT_COLORS.protein,
            },
            {
              label: "지방",
              value: `${selectedEntry.fat}g`,
              ...NUTRIENT_COLORS.fat,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl py-3.5 flex flex-col items-center gap-1 border border-white"
              style={{ backgroundColor: item.bg }}
            >
              <p
                className="text-[18px] font-black leading-none"
                style={{ color: item.icon }}
              >
                {item.value}
              </p>
              <p
                className="text-[11px] font-semibold"
                style={{ color: item.text }}
              >
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* 영양소 상세 바 */}
        <div className="mx-5 mt-5 bg-white rounded-3xl p-5 border border-black/[0.05] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
          <p className="text-[12px] font-bold text-[#6A6A6A] uppercase tracking-[0.05em] mb-4">
            영양소 상세
          </p>
          <NutrientBar
            label="탄수화물"
            amount={selectedEntry.carbs}
            minTarget={targetCarbsMin}
            maxTarget={targetCarbsMax}
            barColor={NUTRIENT_COLORS.carbs.bar}
          />
          <NutrientBar
            label="단백질"
            amount={selectedEntry.protein}
            minTarget={targetProteinMin}
            maxTarget={targetProteinMax}
            barColor={NUTRIENT_COLORS.protein.bar}
          />
          <NutrientBar
            label="지방"
            amount={selectedEntry.fat}
            minTarget={targetFatMin}
            maxTarget={targetFatMax}
            barColor={NUTRIENT_COLORS.fat.bar}
          />
        </div>

        {/* 건강 노트 */}
        {selectedEntry.health_notes &&
          selectedEntry.health_notes.length > 0 && (
            <div className="mx-5 mt-4 rounded-2xl bg-[#FFF9E6] border border-[#FFF383] px-4 py-3 space-y-1.5">
              <p className="text-[11px] font-bold text-[#EDA35A] uppercase tracking-[0.05em] mb-1">
                건강 노트
              </p>
              {selectedEntry.health_notes.map((note, i) => (
                <p key={i} className="text-[13px] text-[#EDA35A] leading-snug">
                  • {note}
                </p>
              ))}
            </div>
          )}

        {/* 대안 음식 */}
        {selectedEntry.healthier_alternative && (
          <div className="mx-5 mt-3 mb-2 rounded-2xl bg-[#F0FDF4] border border-[#CBF891] px-4 py-3 flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#CBF891] flex items-center justify-center shrink-0">
              <Utensils className="size-4 text-[#3E8C28]" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-[#2A6020] uppercase tracking-[0.04em] mb-0.5">
                대신 이걸 드셔보세요
              </p>
              <p className="text-[13px] font-bold text-[#3E8C28]">
                {selectedEntry.healthier_alternative.name}
                <span className="text-[12px] font-medium text-[#7A7A7A] ml-1.5">
                  — {selectedEntry.healthier_alternative.reason}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* 하단 고정 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-black/[0.06] flex gap-3 z-50">
          <Button
            className="flex-1 h-12 text-[14px] font-bold rounded-2xl"
            onClick={() => setViewMode("main")}
          >
            확인
          </Button>
        </div>

        {/* 삭제 확인 모달 */}
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          icon={Trash2}
          iconBg="#FFB8CA"
          iconColor="#C0305A"
          title="식단 기록을 삭제할까요?"
          description="삭제된 식단 기록은 복구할 수 없습니다."
          confirmLabel="삭제하기"
          cancelLabel="취소"
          confirmVariant="destructive"
          onConfirm={handleDeleteEntry}
        />
      </div>
    );
  }

  // ─── 메인 화면 ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F9FFEF] pb-28">
      {/* ── 스크롤 시 나타나는 컴팩트 헤더 ── */}
      <ScrollHeader
        title="식단 분석"
        onBack={() => setScreen("home")}
        visible={isScrolled}
      />

      {/* ── 기본 헤더 (default) ── */}
      <div className="bg-white border-b border-black/[0.06]">
        <div className="flex items-center gap-1 px-4 pt-12 pb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setScreen("home")}
            className="shrink-0 text-[#3C3C3C]"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="ms-1">
            <h1 className="text-[18px] font-bold text-[#3C3C3C] leading-snug">
              식단 분석
            </h1>
            <p className="text-[13px] text-[#7A7A7A] font-medium">
              AI가 영양성분을 분석해드려요
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-5">
        {/* ── 오늘의 영양 섭취 카드 ── */}
        <div className="bg-white rounded-3xl border border-black/[0.06] shadow-[0_1px_6px_rgba(0,0,0,0.04)] p-5">
          <p className="text-[12px] font-bold text-[#6A6A6A] uppercase tracking-[0.05em] mb-4">
            오늘의 영양 섭취
          </p>

          {/* 칼로리 게이지 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div
                  className="size-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: NUTRIENT_COLORS.calories.bg }}
                >
                  <Flame
                    className="size-3.5"
                    style={{ color: NUTRIENT_COLORS.calories.icon }}
                  />
                </div>
                <span className="text-[13px] font-semibold text-[#3C3C3C]">
                  칼로리
                </span>
              </div>
              <span className="text-[13px] font-bold text-[#3C3C3C]">
                <span style={{ color: NUTRIENT_COLORS.calories.icon }}>
                  {totalCalories}
                </span>
                <span className="text-[#9B9B9B] font-medium">
                  {" "}
                  / {dailyGoal.calories} kcal
                </span>
              </span>
            </div>
            <div
              className="h-2.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "#F0F0F0" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min((totalCalories / dailyGoal.calories) * 100, 100)}%`,
                  backgroundColor: NUTRIENT_COLORS.calories.bar,
                }}
              />
            </div>
          </div>

          {/* 영양소 3분할 칩 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "탄수화물",
                value: `${totalCarbs}g`,
                goal: `목표 ${dailyGoal.carbs}g`,
                Icon: Wheat,
                ...NUTRIENT_COLORS.carbs,
              },
              {
                label: "단백질",
                value: `${totalProtein}g`,
                goal: `목표 ${dailyGoal.protein}g`,
                Icon: Beef,
                ...NUTRIENT_COLORS.protein,
              },
              {
                label: "지방",
                value: `${totalFat}g`,
                goal: `목표 ${dailyGoal.fat}g`,
                Icon: Droplet,
                ...NUTRIENT_COLORS.fat,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl py-3.5 px-2 flex flex-col items-center gap-1.5 border border-white"
                style={{ backgroundColor: item.bg }}
              >
                <item.Icon className="size-4" style={{ color: item.icon }} />
                <p
                  className="text-[17px] font-black leading-none"
                  style={{ color: item.icon }}
                >
                  {item.value}
                </p>
                <p
                  className="text-[10px] font-semibold"
                  style={{ color: item.text }}
                >
                  {item.label}
                </p>
                <p className="text-[9px] text-[#9B9B9B]">{item.goal}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 끼니 탭 ── */}
        <div className="bg-white rounded-2xl border border-black/[0.06] p-1.5 flex gap-1">
          {(Object.keys(mealTypeLabels) as MealType[]).map((meal) => (
            <button
              key={meal}
              onClick={() => setSelectedMeal(meal)}
              className={cn(
                "flex-1 py-2 rounded-xl text-[13px] font-bold transition-all",
                selectedMeal === meal
                  ? "bg-primary text-white shadow-sm"
                  : "text-[#7A7A7A] hover:bg-[#F9FFEF]",
              )}
            >
              {mealTypeLabels[meal]}
            </button>
          ))}
        </div>

        {/* ── 숨겨진 파일 input (카메라 + 앨범 공용) ── */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* ── 업로드 / 분석 상태 영역 ── */}
        {analysisState === "idle" && (
          <div className="bg-white rounded-3xl border-2 border-dashed border-[#CBF891] p-8 flex flex-col items-center text-center gap-5">
            <div
              className="size-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: NUTRIENT_COLORS.carbs.bg }}
            >
              <Camera
                className="size-8"
                style={{ color: NUTRIENT_COLORS.carbs.icon }}
              />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#3C3C3C] mb-1">
                {mealTypeLabels[selectedMeal]} 사진 업로드
              </h3>
              <p className="text-[13px] text-[#7A7A7A]">
                음식 사진을 촬영하거나 앨범에서 선택하세요
              </p>
            </div>
            <div className="flex gap-2.5 w-full">
              {/* 촬영하기: 카메라 앱 우선 열기 */}
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute("capture", "environment");
                    fileInputRef.current.click();
                  }
                }}
                className="flex-1 rounded-2xl font-bold"
              >
                <Camera className="size-4 mr-1.5" /> 촬영하기
              </Button>
              {/* 앨범에서: capture 없이 갤러리 열기 */}
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute("capture");
                    fileInputRef.current.click();
                  }
                }}
                variant="outline"
                className="flex-1 rounded-2xl font-bold border-[#CBF891] text-[#3E8C28] hover:bg-[#F9FFEF]"
              >
                <Upload className="size-4 mr-1.5" /> 앨범에서
              </Button>
            </div>
            <button
              className="flex justify-center items-center w-full gap-1.5 text-[13px] font-semibold text-[#3E8C28] bg-[#E8F9D6] hover:bg-[#CBF891] px-4 py-2.5 rounded-2xl transition-colors"
              onClick={() => setShowManualModal(true)}
            >
              <PencilLine className="size-4" />
              음식명 직접 입력하기
            </button>
          </div>
        )}

        {(analysisState === "uploading" || analysisState === "analyzing") && (
          <div className="bg-white rounded-3xl border border-black/[0.06] p-10 flex flex-col items-center text-center gap-4">
            <div
              className="size-16 rounded-2xl flex items-center justify-center animate-pulse"
              style={{ backgroundColor: NUTRIENT_COLORS.carbs.bg }}
            >
              <Scan
                className="size-8"
                style={{ color: NUTRIENT_COLORS.carbs.icon }}
              />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#3C3C3C] mb-1">
                {analysisState === "uploading"
                  ? "업로드 중..."
                  : "AI 분석 중..."}
              </h3>
              <p className="text-[13px] text-[#7A7A7A]">
                {analysisState === "uploading"
                  ? "사진을 업로드하고 있어요"
                  : "음식 종류와 영양성분을 분석하고 있어요"}
              </p>
            </div>
            {/* 로딩 점 애니메이션 */}
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="size-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {analysisState === "complete" && analysisResult && (
          <div className="bg-white rounded-3xl border border-black/[0.06] shadow-[0_1px_6px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* 결과 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.05]">
              <div className="flex items-center gap-2">
                <div
                  className="size-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: NUTRIENT_COLORS.carbs.bg }}
                >
                  <Utensils
                    className="size-4"
                    style={{ color: NUTRIENT_COLORS.carbs.icon }}
                  />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[#3C3C3C]">
                    {apiExtra?.food_name ?? "분석 결과"}
                  </p>
                  {apiExtra && apiExtra.confidence < 0.7 && (
                    <p className="text-[11px] text-[#C0305A] font-semibold">
                      인식률 {Math.round(apiExtra.confidence * 100)}% — 확인
                      필요
                    </p>
                  )}
                </div>
              </div>
              <button
                className="size-7 rounded-full bg-[#F0F0F0] hover:bg-[#E4E4E4] flex items-center justify-center text-[#9B9B9B] transition-colors"
                onClick={() => {
                  setAnalysisState("idle");
                  setAnalysisResult(null);
                }}
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* 음식 사진 */}
            <div className="mx-5 mt-4 aspect-video rounded-2xl overflow-hidden bg-[#F9FFEF] flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="분석된 음식 사진"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Utensils className="size-12 text-[#CBF891]" />
              )}
            </div>

            {/* 영양 수치 그리드 — highlight 필드에 해당하는 칩 강조 */}
            <div className="grid grid-cols-2 gap-2.5 mx-5 mt-4">
              {(
                [
                  {
                    key: "calories",
                    label: "칼로리",
                    value: `${analysisResult.calories}`,
                    unit: "kcal",
                    ...NUTRIENT_COLORS.calories,
                  },
                  {
                    key: "carbs",
                    label: "탄수화물",
                    value: `${analysisResult.carbs}`,
                    unit: "g",
                    ...NUTRIENT_COLORS.carbs,
                  },
                  {
                    key: "protein",
                    label: "단백질",
                    value: `${analysisResult.protein}`,
                    unit: "g",
                    ...NUTRIENT_COLORS.protein,
                  },
                  {
                    key: "fat",
                    label: "지방",
                    value: `${analysisResult.fat}`,
                    unit: "g",
                    ...NUTRIENT_COLORS.fat,
                  },
                ] as const
              ).map((item) => {
                const isHighlighted = apiExtra?.highlight === item.key;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl py-4 flex flex-col items-center justify-center gap-0.5 transition-all"
                    style={{
                      backgroundColor: item.bg,
                      border: isHighlighted
                        ? `2px solid ${item.icon}`
                        : "2px solid transparent",
                      boxShadow: isHighlighted
                        ? `0 0 0 3px ${item.icon}22`
                        : undefined,
                    }}
                  >
                    {isHighlighted && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-1 uppercase tracking-wider"
                        style={{ backgroundColor: item.icon, color: "#fff" }}
                      >
                        중요
                      </span>
                    )}
                    <p
                      className="text-[22px] font-black leading-none"
                      style={{ color: item.icon }}
                    >
                      {item.value}
                      <span className="text-[13px] font-bold ml-0.5">
                        {item.unit}
                      </span>
                    </p>
                    <p
                      className="text-[11px] font-semibold mt-1"
                      style={{ color: item.text }}
                    >
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* health_notes */}
            {apiExtra && apiExtra.health_notes.length > 0 && (
              <div className="mx-5 mt-3 rounded-2xl bg-[#FFF9E6] border border-[#FFF383] px-4 py-3 space-y-1">
                {apiExtra.health_notes.map((note, i) => (
                  <p
                    key={i}
                    className="text-[12px] text-[#8C7010] leading-snug"
                  >
                    • {note}
                  </p>
                ))}
              </div>
            )}

            {/* 대안 음식 */}
            {apiExtra?.healthier_alternative && (
              <div className="mx-5 mt-3 rounded-2xl bg-[#F0FDF4] border border-[#CBF891] px-4 py-3 flex items-center gap-3">
                <div className="size-8 rounded-xl bg-[#CBF891] flex items-center justify-center shrink-0">
                  <Utensils className="size-4 text-[#3E8C28]" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-[#2A6020] uppercase tracking-[0.04em] mb-0.5">
                    대신 이걸 드셔보세요
                  </p>
                  <p className="text-[13px] font-bold text-[#3E8C28]">
                    {apiExtra.healthier_alternative.name}
                    <span className="text-[12px] font-medium text-[#7A7A7A] ml-1.5">
                      — {apiExtra.healthier_alternative.reason}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* alternatives — "혹시 이 음식인가요?" (confidence < 0.7일 때만) */}
            {apiExtra &&
              apiExtra.confidence < 0.7 &&
              apiExtra.alternatives.length > 0 && (
                <div className="mx-5 mt-3 rounded-2xl bg-[#F5F5FF] border border-[#D0D0F0] px-4 py-3">
                  <p className="text-[12px] font-bold text-[#5A5AAA] mb-2">
                    혹시 이 음식인가요?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {apiExtra.alternatives.map((alt) => (
                      <button
                        key={alt.name}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold bg-white border border-[#D0D0F0] text-[#5A5AAA] hover:bg-[#EEEEFF] transition-colors"
                        onClick={() => {
                          setApiExtra((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  food_name: alt.name,
                                  confidence: alt.confidence,
                                  alternatives: [],
                                }
                              : prev,
                          );
                        }}
                      >
                        {alt.name}
                        <span className="text-[10px] text-[#9B9BE0] font-medium">
                          {Math.round(alt.confidence * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* 버튼 영역: confidence < 0.7이면 재분석/직접입력 우선 표시 */}
            <div className="px-5 pt-4 pb-5 space-y-2.5 mt-1">
              {apiExtra && apiExtra.confidence < 0.7 && (
                <div className="rounded-2xl bg-[#FFF0F0] border border-[#F09BB0] px-4 py-3 mb-1">
                  <p className="text-[12px] font-bold text-[#C0305A] mb-2">
                    음식을 잘못 인식했나요?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-10 rounded-xl text-[13px] font-bold border-[#F09BB0] text-[#C0305A] hover:bg-[#FFE4ED]"
                      onClick={() => {
                        setAnalysisState("idle");
                        setAnalysisResult(null);
                        setApiExtra(null);
                      }}
                    >
                      다시 분석하기
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-10 rounded-xl text-[13px] font-bold border-[#CBF891] text-[#3E8C28] hover:bg-[#F9FFEF]"
                      onClick={() => setShowManualModal(true)}
                    >
                      직접 입력
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex gap-2.5">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-2xl text-[13px] font-bold border-[#E0E0E0] text-[#7A7A7A]"
                  onClick={() => {
                    setAnalysisState("idle");
                    setAnalysisResult(null);
                    setApiExtra(null);
                  }}
                >
                  다시 분석
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-2xl text-[13px] font-bold border-[#CBF891] text-[#3E8C28] hover:bg-[#F9FFEF]"
                  onClick={() => setShowManualModal(true)}
                >
                  직접 입력
                </Button>
              </div>
              <Button
                onClick={handleSaveEntry}
                className="w-full h-12 rounded-2xl text-[14px] font-bold"
              >
                저장하기
              </Button>
            </div>
          </div>
        )}

        {/* ── 오늘의 식단 목록 ── */}
        {todayEntries.length > 0 && (
          <div>
            <p className="text-[12px] font-bold text-[#6A6A6A] uppercase tracking-[0.05em] mb-3 px-1">
              오늘의 식단
            </p>
            <div className="space-y-2.5">
              {todayEntries.map((entry) => (
                <button
                  key={entry.id}
                  className="w-full bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-3.5 flex items-center gap-3 hover:bg-[#F9FFEF] transition-colors"
                  onClick={() => openDetailView(entry)}
                >
                  <div
                    className="size-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: NUTRIENT_COLORS.carbs.bg }}
                  >
                    <Utensils
                      className="size-5"
                      style={{ color: NUTRIENT_COLORS.carbs.icon }}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[14px] font-bold text-[#3C3C3C]">
                      {mealTypeLabels[entry.mealType]}
                    </p>
                    <p className="text-[12px] text-[#7A7A7A] font-medium">
                      {entry.calories} kcal
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[
                        {
                          v: entry.carbs,
                          unit: "탄",
                          color: NUTRIENT_COLORS.carbs.bar,
                        },
                        {
                          v: entry.protein,
                          unit: "단",
                          color: NUTRIENT_COLORS.protein.bar,
                        },
                        {
                          v: entry.fat,
                          unit: "지",
                          color: NUTRIENT_COLORS.fat.bar,
                        },
                      ].map((n) => (
                        <span
                          key={n.unit}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white"
                          style={{ backgroundColor: n.color }}
                        >
                          {n.unit} {n.v}
                        </span>
                      ))}
                    </div>
                    <ChevronRight className="size-4 text-[#C8C8C8]" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />

      {/* ── 직접 입력 모달 ── */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent showCloseButton={false}>
          <div className="size-14 rounded-full bg-[#FFF383] flex items-center justify-center mx-auto mb-1">
            <PencilLine className="size-7 text-[#8C7010]" strokeWidth={2} />
          </div>
          <DialogTitle className="text-center">음식 직접 입력</DialogTitle>
          <p className="text-[13px] text-[#7A7A7A] leading-normal text-center mt-1">
            사진 분석이 부정확한가요?
            <br />
            드신 음식을 직접 적어주시면 AI가 영양소를 계산해 드립니다.
          </p>
          <div className="space-y-3 mt-5">
            <Input
              placeholder="예: 닭가슴살 샐러드 1인분"
              value={manualFoodName}
              onChange={(e) => setManualFoodName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              className="h-12 rounded-xl text-[15px]"
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 text-[14px] font-bold rounded-2xl"
                onClick={() => setShowManualModal(false)}
              >
                취소
              </Button>
              <Button
                className="flex-1 h-12 text-[14px] font-bold rounded-2xl"
                onClick={handleManualSubmit}
              >
                AI 분석하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
