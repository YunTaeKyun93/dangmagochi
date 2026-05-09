import { useState, useEffect, useRef } from "react";
import "@/src/home.css";
import { useAppStore } from "@/lib/store";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BottomNav } from "@/components/ui/navigation-menu";
import {
  Droplets,
  Footprints,
  Apple,
  ChevronRight,
  Sparkles,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  Flame,
  Zap,
  Smile,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Frown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterMood, CharacterLevel } from "@/lib/types";
import { OfflinePenaltyModal } from "./offline-penalty-modal";
import { Character } from "@/components/character";
import { Button } from "@/components/ui/button";
import {
  fetchRecommendations,
  fetchCharacter,
  CHARACTER_THEME,
} from "@/lib/api";
import type {
  CorrectionStatus,
  RiskChangeSummary,
  OverallState,
} from "@/lib/api";

/* ─────────────────────────────────────────────────────────────
   타입 & 상수
───────────────────────────────────────────────────────────── */
interface LocalRec {
  id: string;
  title: string;
  reason: string;
  source: string;
  confidence: number; // 0~1
  difficulty: "easy" | "medium" | "hard";
}

const AI_RECOMMENDATIONS: LocalRec[] = [
  {
    id: "rec-1",
    title: "점심 시간 15분 걷기로 전환해보세요.",
    reason: "화/수 저녁 미션 실패가 반복되어 시간대를 변경했습니다.",
    source: "대한당뇨병학회 가이드 p.52",
    confidence: 0.85,
    difficulty: "easy",
  },
  {
    id: "rec-2",
    title: "저녁 국물 요리를 줄이고 샐러드로 대체해보세요.",
    reason: "최근 나트륨 섭취가 권장량을 초과합니다.",
    source: "고혈압학회 진료지침 p.42",
    confidence: 0.72,
    difficulty: "medium",
  },
];

/* 신뢰도 색상 */
const confidenceStyle = (score: number) => {
  if (score >= 0.8) return { bar: "#3E8C28", bg: "#CBF891", text: "#2A5C34" };
  if (score >= 0.6) return { bar: "#8C7010", bg: "#FFF383", text: "#5C4A00" };
  return { bar: "#C0305A", bg: "#FFB8CA", text: "#8B1A3A" };
};

/* 난이도 뱃지 */
const DIFFICULTY_STYLE = {
  easy: { label: "쉬움", bg: "#E8F9D6", color: "#3E8C28" },
  medium: { label: "보통", bg: "#FFF9D6", color: "#8C7010" },
  hard: { label: "어려움", bg: "#FFE4ED", color: "#C0305A" },
};

/* 추천 카드 — 신뢰도 바 + 난이도 + 피드백 */
type FeedbackType = "helpful" | "not_helpful" | "too_hard";

function RecCard({ rec, index }: { rec: LocalRec; index: number }) {
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const conf = confidenceStyle(rec.confidence);
  const diff = DIFFICULTY_STYLE[rec.difficulty] ?? DIFFICULTY_STYLE.medium;
  const isFirst = index === 0;

  return (
    <div className="bg-white rounded-2xl p-5">
      {/* 헤더: 아이콘 + 난이도 뱃지 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={cn(
              "size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
              isFirst ? "bg-[#FFDBFD]" : "bg-[#CBF891]",
            )}
          >
            <Sparkles
              className={cn(
                "size-4",
                isFirst ? "text-[#C85A54]" : "text-[#6B9B7A]",
              )}
            />
          </div>
          <p className="text-[14px] font-bold text-[#3C3C3C] leading-snug">
            {rec.title}
          </p>
        </div>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: diff.bg, color: diff.color }}
        >
          {diff.label}
        </span>
      </div>

      {/* 이유 */}
      <p className="text-[13px] text-[#7A7A7A] leading-normal mb-3">
        {rec.reason}
      </p>

      {/* 신뢰도 바 */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-[#9B9B9B] font-medium">
            AI 신뢰도
          </span>
          <span className="text-[11px] font-bold" style={{ color: conf.text }}>
            {Math.round(rec.confidence * 100)}%
          </span>
        </div>
        <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${rec.confidence * 100}%`,
              backgroundColor: conf.bar,
            }}
          />
        </div>
      </div>

      {/* 근거 출처 */}
      <div className="flex items-start gap-1.5 py-2.5 border-t border-black/[0.05] mb-3">
        <BookOpen className="size-3 text-[#9B9B9B] mt-0.5 shrink-0" />
        <span className="text-[11px] text-[#9B9B9B] font-medium leading-relaxed">
          {rec.source}
        </span>
      </div>

      {/* 사용자 피드백 */}
      {!feedback ? (
        <div className="flex gap-2">
          {(
            [
              {
                key: "helpful" as FeedbackType,
                icon: ThumbsUp,
                label: "도움됨",
                color: "#3E8C28",
                bg: "#E8F9D6",
              },
              {
                key: "not_helpful" as FeedbackType,
                icon: ThumbsDown,
                label: "별로",
                color: "#C0305A",
                bg: "#FFE4ED",
              },
              {
                key: "too_hard" as FeedbackType,
                icon: Frown,
                label: "어려움",
                color: "#8C7010",
                bg: "#FFF9D6",
              },
            ] as const
          ).map(({ key, icon: Icon, label, color, bg }) => (
            <button
              key={key}
              onClick={() => setFeedback(key)}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-bold transition-colors border"
              style={{
                color,
                backgroundColor: "white",
                borderColor: `${color}30`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = bg)}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "white")
              }
            >
              <Icon className="size-3" />
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-2 bg-[#F0FDF4] rounded-xl text-[12px] font-bold text-[#3E8C28]">
          ✅ 피드백 반영됨 — 다음 추천에 활용됩니다
        </div>
      )}
    </div>
  );
}

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  normal: "😐",
  sad: "😢",
  sick: "🤒",
};

/* ─────────────────────────────────────────────────────────────
   테스트 패널용 상수 & 헬퍼
───────────────────────────────────────────────────────────── */
const OVERALL_STATE_OPTIONS: {
  value: OverallState;
  emoji: string;
  label: string;
}[] = [
  { value: "happy", emoji: "😄", label: "happy" },
  { value: "energetic", emoji: "😊", label: "energetic" },
  { value: "recovering", emoji: "😌", label: "recovering" },
  { value: "tired", emoji: "😪", label: "tired" },
  { value: "struggling", emoji: "😢", label: "struggling" },
];

const TEST_RISK_SCENARIOS: {
  label: string;
  data: RiskChangeSummary;
}[] = [
  {
    label: "큰 개선 ▼16%",
    data: {
      previous_probability: 68,
      current_probability: 52,
      change: 16,
      improved: true,
      message: "68% → 52%",
    },
  },
  {
    label: "소폭 개선 ▼6%",
    data: {
      previous_probability: 68,
      current_probability: 62,
      change: 6,
      improved: true,
      message: "68% → 62%",
    },
  },
  {
    label: "소폭 악화 ▲6%",
    data: {
      previous_probability: 52,
      current_probability: 58,
      change: 6,
      improved: false,
      message: "52% → 58%",
    },
  },
  {
    label: "큰 악화 ▲18%",
    data: {
      previous_probability: 52,
      current_probability: 70,
      change: 18,
      improved: false,
      message: "52% → 70%",
    },
  },
];

function getCharacterMessage(r: RiskChangeSummary): string {
  const {
    previous_probability: prev,
    current_probability: curr,
    change,
    improved,
  } = r;
  const abs = Math.abs(change);
  if (improved && abs >= 15)
    return `와! 위험도가 ${prev}%에서 ${curr}%로 떨어졌어! 정말 대단해! 🎉`;
  if (improved && abs >= 5)
    return `위험도가 ${prev}%에서 ${curr}%로 줄었어! 노력하고 있구나! 💪`;
  if (!improved && abs >= 15) return `위험도가 올랐어... 같이 다시 해보자! 🤝`;
  return `위험도가 조금 올랐어. 괜찮아, 천천히 시작하자. 😊`;
}

const MOOD_STAT: Record<string, number> = {
  happy: 95,
  normal: 72,
  sad: 38,
  sick: 18,
};

/* ─────────────────────────────────────────────────────────────
   StatChip — 캐릭터 스탯 칩
───────────────────────────────────────────────────────────── */
function StatChip({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div
      className="flex-1 rounded-2xl px-3 py-3 flex flex-col items-center gap-1.5"
      style={{
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(255,255,255,0.9)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
      }}
    >
      {/* 아이콘 원형 배경 */}
      <div
        className="size-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <Icon
          className="size-4"
          style={{ color: iconColor }}
          strokeWidth={2.2}
        />
      </div>
      <p className="text-[16px] font-black text-[#1A2E1C] leading-none">
        {value}
      </p>
      <p
        className="text-[9px] font-bold uppercase tracking-[0.07em]"
        style={{ color: iconColor }}
      >
        {label}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MissionRow 서브 컴포넌트
───────────────────────────────────────────────────────────── */
interface MissionRowProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  valueLabel: string;
  progress: number;
  barColor: string;
  completed: boolean;
  action?: React.ReactNode;
}

function MissionRow({
  icon,
  iconBg,
  title,
  valueLabel,
  progress,
  barColor,
  completed,
  action,
}: MissionRowProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div
        className={cn(
          "size-10 rounded-xl flex items-center justify-center shrink-0",
          iconBg,
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[14px] font-bold leading-none text-[#3C3C3C]">
            {title}
          </p>
          <span className="text-[12px] font-medium text-[#9B9B9B]">
            {valueLabel}
          </span>
        </div>
        <div className="h-2 bg-[#E8E6E1] rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              barColor,
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
      <div className="shrink-0 w-[45px] flex justify-end">
        {completed ? (
          <CheckCircle2 className="size-5 text-[#87D57B]" />
        ) : action ? (
          action
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   HomeScreen 메인 컴포넌트
───────────────────────────────────────────────────────────── */
export function HomeScreen() {
  const {
    userProfile,
    character,
    missions,
    setScreen,
    setCharacter,
    updateMissionProgress,
    completeMission,
    checkDailyMissionReset,
  } = useAppStore();

  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  /* ── ML API 상태 ── */
  const [correctionStatus, setCorrectionStatus] =
    useState<CorrectionStatus | null>(null);
  const [escalationMessage, setEscalationMessage] = useState<
    string | undefined
  >(undefined);
  const [displayRecs, setDisplayRecs] =
    useState<LocalRec[]>(AI_RECOMMENDATIONS);
  const [fallbackMessage, setFallbackMessage] = useState<string | undefined>(
    undefined,
  );
  const [riskChangeSummary, setRiskChangeSummary] =
    useState<RiskChangeSummary | null>(null);
  const [overallState, setOverallState] = useState<OverallState | null>(null);

  /* ── 테스트 패널 ── */
  const [showTestPanel, setShowTestPanel] = useState(false);

  /* ── 추천 슬라이더 ── */
  const [currentRecIndex, setCurrentRecIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleSliderScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.offsetWidth);
    setCurrentRecIndex(index);
  };

  const scrollToSlide = (index: number) => {
    const el = sliderRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.offsetWidth, behavior: "smooth" });
  };

  /* ── 일일 미션 초기화 ── */
  useEffect(() => {
    checkDailyMissionReset();
  }, []);

  /* ── ML API 호출 (백엔드 준비 후 아래 주석 해제) ── */
  useEffect(() => {
    fetchRecommendations()
      .then((data) => {
        setCorrectionStatus(data.correction_status);
        setEscalationMessage(data.escalation_message);
        setFallbackMessage(data.fallback_message);
        if (data.correction_status !== "ESCALATED") {
          const mapped: LocalRec[] = data.recommendations.map((r, i) => ({
            id: `api-${i}`,
            title: r.action,
            reason: r.reason,
            source: r.evidence_source,
            confidence: r.confidence ?? 0.75,
            difficulty: r.difficulty ?? "medium",
          }));
          setDisplayRecs(mapped.length > 0 ? mapped : AI_RECOMMENDATIONS);
        }
      })
      .catch(() => {
        setDisplayRecs(AI_RECOMMENDATIONS);
      });
    fetchCharacter()
      .then((rawData) => {
        // 실제 백엔드 응답: { success: true, data: { char_id, name, level, exp, status, ... } }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (rawData as any)?.data;
        if (!data) return;

        // overall_state (status) 업데이트
        setOverallState(data.status ?? null);

        // mood: 백엔드는 0~100 숫자, Zustand는 "happy"|"normal"|"sad"|"sick" 문자열
        const moodNum: number = typeof data.mood === "number" ? data.mood : 50;
        const mood: CharacterMood =
          moodNum >= 70 ? "happy"
          : moodNum >= 40 ? "normal"
          : moodNum >= 20 ? "sad"
          : "sick";

        const EXP_TABLE: Record<number, number> = { 1: 800, 2: 1200, 3: 1600, 4: 2400 };
        const dbLevel = Math.min(Math.max(Number(data.level ?? 1), 1), 5) as CharacterLevel;

        // ── 레벨/경험치 결정 로직 ──────────────────────────────────────────
        // addExperience()는 Zustand만 업데이트하고 백엔드에는 반영하지 않으므로,
        // 로컬(Zustand)이 DB보다 앞서 있을 수 있다.
        // → DB 레벨이 로컬보다 높을 때만 DB 값으로 덮어씀 (DB 직접 수정 반영)
        // → 로컬이 더 높으면 로컬 레벨/경험치를 유지 (게임 내 레벨업 보호)
        const currentStore = useAppStore.getState();
        const localLevel = currentStore.character?.level ?? 1;
        const localExp   = currentStore.character?.experience ?? 0;

        const finalLevel = (dbLevel >= localLevel ? dbLevel : localLevel) as CharacterLevel;
        const finalExp   = dbLevel >= localLevel ? (data.exp ?? 0) : localExp;

        // Zustand 스토어 캐릭터 업데이트 → UI에 즉시 반영
        setCharacter({
          id: String(data.char_id),
          name: data.name ?? currentStore.character?.name ?? "글루",
          level: finalLevel,
          mood,
          experience: finalExp,
          experienceToNextLevel: EXP_TABLE[finalLevel] ?? 2400,
          createdAt: data.created_at
            ? new Date(data.created_at)
            : (currentStore.character?.createdAt ?? new Date()),
        });
      })
      .catch(() => {
        // 캐릭터 조회 실패 시 기존 상태 유지
      });
  }, [userProfile?.id]);

  /* ── 걷기 미션 자동 증가 ── */
  useEffect(() => {
    const interval = setInterval(() => {
      const walkingMission = missions.find((m) => m.category === "walking");
      if (walkingMission && !walkingMission.completed) {
        const next = walkingMission.current + Math.floor(Math.random() * 50);
        if (next >= walkingMission.target) completeMission(walkingMission.id);
        else updateMissionProgress(walkingMission.id, next);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [missions, updateMissionProgress, completeMission]);

  /* ── 시계 ── */
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  /* ── 파생 값 ── */
  const completedMissions = missions.filter((m) => m.completed).length;
  const totalMissions = missions.length > 0 ? missions.length : 1;
  const missionProgress = (completedMissions / totalMissions) * 100;

  const walkingMission = missions.find((m) => m.category === "walking");
  const waterMission = missions.find((m) => m.category === "water");
  const dietMission = missions.find((m) => m.category === "diet");

  const expPercent = character
    ? Math.min(
        Math.round(
          (character.experience / character.experienceToNextLevel) * 100,
        ),
        100,
      )
    : 0;

  /* ── 캐릭터 스탯 파생 ── */
  const energyVal = walkingMission
    ? Math.max(
        30,
        Math.round((walkingMission.current / walkingMission.target) * 100),
      )
    : 50;
  const moodVal = MOOD_STAT[character?.mood ?? "normal"];
  const stabilityVal = Math.max(30, Math.round(missionProgress));

  /* ── 물 한 잔 추가 ── */
  const handleWaterAdd = () => {
    if (!waterMission || waterMission.completed) return;
    const next = waterMission.current + 1;
    if (next >= waterMission.target) completeMission(waterMission.id);
    else updateMissionProgress(waterMission.id, next);
  };

  /* ═══════════════════════════════════════════════════════════
     렌더
  ══════════════════════════════════════════════════════════ */
  const heroBg = overallState
    ? CHARACTER_THEME[overallState].bgColor
    : "#F9FFEF";

  const bgStateClass = overallState ?? "default";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: heroBg,
        transition: "background-color 0.5s ease",
      }}
    >
      {/* ════════════════════════════════════════
          HERO — 캐릭터 영역
      ════════════════════════════════════════ */}
      <div
        className={`bg-image ${bgStateClass} relative flex flex-col items-center px-5 pt-14 pb-7`}
      >
        {/* ── 떠다니는 도형들 ── */}
        {/* 좌상단 영역 */}
        <span
          className="retro-shape rs-triangle rc-blue   rz-sm ra-1"
          style={{ top: "10%", left: "8%", animationDelay: "0s" }}
        />
        <span
          className="retro-shape rs-square img_mushroom_bl  rz-xs ra-2"
          style={{ top: "18%", left: "22%", animationDelay: "0.8s" }}
        />
        <span
          className="retro-shape rs-square   rc-green  rz-sm ra-2"
          style={{ top: "14%", left: "6%", animationDelay: "0.4s" }}
        />
        <span
          className="retro-shape rs-dot      rc-white  rz-xs ra-6"
          style={{ top: "8%", left: "38%", animationDelay: "1.2s" }}
        />

        {/* 우상단 영역 */}
        <span
          className="retro-shape rs-diamond  rc-green  rz-sm ra-1"
          style={{ top: "12%", right: "10%", animationDelay: "0.6s" }}
        />
        <span
          className="retro-shape rs-square  img_star_brw rz-md ra-5"
          style={{ top: "22%", right: "6%", animationDelay: "1.5s" }}
        />
        <span
          className="retro-shape rs-ring     rc-white  rz-sm ra-3"
          style={{ top: "8%", right: "28%", animationDelay: "0.3s" }}
        />
        <span
          className="retro-shape img_star_pr ra-1"
          style={{ top: "8%", right: "28%", animationDelay: "0.3s" }}
        ></span>

        {/* 좌중앙 영역 */}
        <span
          className="retro-shape rs-circle img-flower-iv rz-md ra-3"
          style={{ top: "42%", left: "4%", animationDelay: "2.1s" }}
        />
        <span
          className="retro-shape rs-diamond  rc-yellow rz-xs ra-4"
          style={{ top: "36%", left: "16%", animationDelay: "1.0s" }}
        />
        <span
          className="retro-shape rs-dot      rc-green  rz-xs ra-6"
          style={{ top: "52%", left: "10%", animationDelay: "0.2s" }}
        />

        {/* 우중앙 영역 */}
        <span
          className="retro-shape rs-circle  img_mushroom_gn  rz-lg ra-5"
          style={{ top: "48%", right: "3%", animationDelay: "1.8s" }}
        />
        <span
          className="retro-shape rs-ring rc-yellow rz-sm ra-2"
          style={{ top: "38%", right: "18%", animationDelay: "0.7s" }}
        />
        <span
          className="retro-shape rs-triangle rc-blue   rz-xs ra-1"
          style={{ top: "30%", right: "30%", animationDelay: "2.4s" }}
        />

        {/* 하단 영역 */}
        <span
          className="retro-shape rs-square  img_puding_yw rz-lg ra-2"
          style={{ bottom: "35%", left: "3%", animationDelay: "1.3s" }}
        />
        <span
          className="retro-shape rs-circle img_star_pr rz-xl ra-5"
          style={{
            width: "100px",
            height: "100px",
            bottom: "18%",
            left: "18%",
            animationDelay: "0.9s",
          }}
        />
        <span
          className="retro-shape rs-circle img-flower-iv rz-lg ra-3"
          style={{
            width: "100px",
            height: "100px",
            bottom: "16%",
            right: "8%",
            animationDelay: "2.0s",
          }}
        />
        <span
          className="retro-shape rs-dot rc-yellow rz-xs ra-6"
          style={{ bottom: "30%", right: "22%", animationDelay: "0.5s" }}
        />
        {/* 최상단: 스트릭 + 포인트 */}
        <div className="w-full flex items-center justify-between mb-5 z-2">
          <div>
            <p className="text-[10px] font-bold text-[#2A5C34]/60 uppercase tracking-[0.10em] mb-0.5">
              Streak days
            </p>
            <div className="flex items-center gap-1.5">
              <Flame className="size-5 text-[#F97316]" />
              <span className="text-[30px] font-black text-[#1A2E1C] leading-none">
                {userProfile?.streak ?? 0}
              </span>
            </div>
          </div>

          {/* 경험치 배지 */}
          {/* <div className="flex items-center gap-1.5 bg-white/50 backdrop-blur-sm rounded-full px-3.5 py-2 border border-white/70 shadow-[0_1px_8px_rgba(0,0,0,0.08)]">
            <Zap className="size-3.5 text-[#6366F1]" />
            <span className="text-[13px] font-bold text-[#1A2E1C]">
              {(character?.experience ?? 0).toLocaleString()}
              <span className="text-[11px] font-semibold text-[#3A6B44] ms-0.5">XP</span>
            </span>
          </div> */}
        </div>

        {/* 캐릭터 이미지 — 레벨별 분기 + 말풍선 */}
        <div className="relative flex flex-col items-center">
          {/* 말풍선 — riskChangeSummary 있을 때만 표시 */}
          {riskChangeSummary && (
            <div className="relative mb-1">
              <img
                src="/img-bubble.png"
                alt="말풍선"
                className="w-56 h-auto pointer-events-none"
                style={{ imageRendering: "pixelated" }}
              />
              <p className="absolute mb-2 inset-0 flex items-center justify-center text-center px-5 text-[12px] font-bold text-[#3C3C3C] leading-snug">
                {getCharacterMessage(riskChangeSummary)}
              </p>
            </div>
          )}
          <Character
            level={character?.level ?? 1}
            mood={character?.mood ?? "normal"}
            size="xl"
            showPlatform={false}
            animated
            className="drop-shadow-xl"
          />
        </div>

        {/* 캐릭터 이름 + 레벨 + 기분 */}
        <div className="flex items-center gap-2.5 mt-3 mb-4 z-2">
          <h1 className="text-[22px] font-black text-[#1A2E1C] leading-none tracking-[-0.5px]">
            {character?.name ?? "알"}
          </h1>
          <span className="bg-[#3AAE5A] text-white text-[11px] font-bold px-2.5 py-[5px] rounded-full leading-none">
            Lv.{character?.level ?? 1}
          </span>
        </div>

        {/* XP 바 — 두꺼운 스트라이프 스타일 */}
        <div className="w-full mb-5 z-2">
          {/* 라벨 행 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#3E8C28] uppercase tracking-[0.06em]">
              EXP
            </span>
            <span className="text-[11px] font-semibold text-[#3E8C28]">
              {character?.experience ?? 0}
              <span className="text-[#87D57B] font-medium">
                {" "}
                / {character?.experienceToNextLevel ?? 100}
              </span>
            </span>
          </div>
          {/* 바 */}
          <div
            className="relative h-8 rounded-full overflow-hidden"
            style={{ background: "#E4EFD2" }}
          >
            {/* Fill */}
            <div
              className="absolute left-0 top-0 h-full rounded-full overflow-hidden"
              style={{
                width: `${expPercent}%`,
                background: "linear-gradient(90deg, #5FC952 0%, #87D57B 100%)",
              }}
            >
              {/* 스트라이프 오버레이 */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, transparent, transparent 9px, rgba(255,255,255,0.22) 9px, rgba(255,255,255,0.22) 18px)",
                }}
              />
            </div>
            {/* 수치 텍스트 — 항상 선명하게 */}
            <span
              className="absolute inset-0 flex items-center justify-center text-[12px] font-black"
              style={{
                color: expPercent > 45 ? "#fff" : "#2A5C34",
                textShadow:
                  expPercent > 45 ? "0 1px 4px rgba(0,0,0,0.20)" : "none",
              }}
            >
              {expPercent}%
            </span>
          </div>
          <p className="text-[11px] font-medium text-[#3E8C28] text-center mt-1.5">
            다음 레벨까지{" "}
            <span className="font-bold text-[#2A5C34]">
              {(character?.experienceToNextLevel ?? 100) -
                (character?.experience ?? 0)}
            </span>{" "}
            XP 남았어요
          </p>
        </div>

        {/* 캐릭터 스탯 3종 */}
        <div className="flex gap-2.5 w-full">
          {/* 에너지 — Accent Yellow 톤 */}
          <StatChip
            label="에너지"
            value={energyVal}
            icon={Zap}
            iconColor="#EDA35A"
            iconBg="#FFF383"
          />
          {/* 기분 — Pastel Pink 톤 */}
          <StatChip
            label="기분"
            value={moodVal}
            icon={Smile}
            iconColor="#647FBC"
            iconBg="#CFECF3"
          />
          {/* 안정감 — Primary Green 톤 */}
          <StatChip
            label="안정감"
            value={stabilityVal}
            icon={ShieldCheck}
            iconColor="#3E8C28"
            iconBg="#E9FBA4"
          />
        </div>

        {/* ── 위험도 변화 요약 (재예측 시에만 표시) ── */}
        {riskChangeSummary && (
          <div
            className="w-full mt-3 rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(255,255,255,0.9)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }}
          >
            <div
              className="size-9 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: riskChangeSummary.improved
                  ? "#D5F5E3"
                  : "#FADBD8",
              }}
            >
              <TrendingUp
                className="size-4"
                style={{
                  color: riskChangeSummary.improved ? "#3E8C28" : "#C0305A",
                }}
                strokeWidth={2.5}
              />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-[#6A6A6A] uppercase tracking-[0.07em] mb-0.5">
                위험도 변화
              </p>
              <p
                className="text-[15px] font-black leading-none"
                style={{
                  color: riskChangeSummary.improved ? "#3E8C28" : "#C0305A",
                }}
              >
                {riskChangeSummary.message}{" "}
                <span className="text-[13px]">
                  ({riskChangeSummary.improved ? "▼" : "▲"}
                  {Math.abs(riskChangeSummary.change)}%)
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          SCROLL CONTENT — 흰색 카드 영역
          (배경 컬러가 양옆에 보이도록 mx-4 패딩)
      ════════════════════════════════════════ */}
      <div className="flex-1 px-4 pb-28 space-y-4">
        {/* ── 오늘의 추천 ── */}
        <section>
          {/* ESCALATED: 추천 숨기고 경고 배너만 표시 */}
          {correctionStatus === "ESCALATED" ? (
            <div className="rounded-2xl bg-[#FFF0F0] border border-[#F09BB0] p-5 flex items-start gap-3">
              <div className="size-9 rounded-xl bg-[#FFB8CA] flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="size-5 text-[#C0305A]" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-[#C0305A] mb-1">
                  의료진 상담이 필요해요
                </p>
                <p className="text-[13px] text-[#9B3A55] leading-relaxed">
                  {escalationMessage ??
                    "현재 상태에서는 AI 추천을 제공하기 어렵습니다. 가까운 의료기관에 방문해 주세요."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <h2 className="text-[17px] font-bold text-[#1A2E1C]">
                  오늘의 추천
                </h2>
                <div className="flex items-center gap-2">
                  {displayRecs.length > 1 && (
                    <span className="text-[11px] font-semibold text-[#9B9B9B]">
                      {currentRecIndex + 1} / {displayRecs.length}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-[#2A5C34] uppercase tracking-[0.06em] badge-tint px-2.5 py-1 rounded-full border border-white/70">
                    AI 분석
                  </span>
                </div>
              </div>

              {/* fallback 메시지 (데이터 부족 등) */}
              {fallbackMessage && (
                <div className="rounded-2xl bg-[#FFFDF0] border border-[#FFF383] p-4 flex items-start gap-3 mb-3 ">
                  <div className="size-7 rounded-lg bg-[#FFF383] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="size-3.5 text-[#8C7010]" />
                  </div>
                  <p className="text-[13px] text-[#8C7010] leading-relaxed font-medium">
                    {fallbackMessage}
                  </p>
                </div>
              )}

              {/* ── 카드 슬라이더 ── */}
              <div
                ref={sliderRef}
                onScroll={handleSliderScroll}
                className="rec-slider flex overflow-x-auto "
                style={{
                  scrollSnapType: "x mandatory",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                  gap: "12px",
                }}
              >
                {displayRecs.map((rec, idx) => (
                  <div
                    className="rounded-lg shadow-[0_2px_16px_rgba(0,0,0,0.07)]"
                    key={rec.id}
                    style={{
                      scrollSnapAlign: "start",
                      minWidth: "100%",
                      width: "100%",
                    }}
                  >
                    <RecCard rec={rec} index={idx} />
                  </div>
                ))}
              </div>

              {/* ── 도트 인디케이터 ── */}
              {displayRecs.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {displayRecs.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToSlide(idx)}
                      aria-label={`${idx + 1}번 추천으로 이동`}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: currentRecIndex === idx ? 20 : 6,
                        height: 6,
                        backgroundColor:
                          currentRecIndex === idx ? "#3E8C28" : "#D0D0D0",
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── 오늘의 미션 ── */}
        <section>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <h2 className="text-[17px] font-bold text-[#1A2E1C]">
              오늘의 미션
            </h2>
            <button
              onClick={() => setScreen("missions")}
              className="flex items-center gap-0.5 text-[13px] font-semibold text-[#2A5C34] min-h-10 min-w-10 justify-end"
            >
              전체보기
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] overflow-hidden">
            {/* 달성률 요약 */}
            <div className="px-5 pt-5 pb-4 border-b border-black/[0.05]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold text-[#3C3C3C]">
                  {completedMissions}
                  <span className="text-[#9B9B9B] font-medium">
                    /{totalMissions} 완료
                  </span>
                </p>
                <p className="text-[13px] font-bold text-[#3C3C3C]">
                  {Math.round(missionProgress)}%
                </p>
              </div>
              <div className="h-2 bg-[#E8E6E1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-ring rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${missionProgress}%` }}
                />
              </div>
            </div>

            {/* 미션 개별 행 */}
            <div className="divide-y divide-black/[0.04]">
              {/* 만보 걷기 — Sub Green #CBF891 */}
              {walkingMission && (
                <MissionRow
                  icon={<Footprints className="size-4 text-[#3E8C28]" />}
                  iconBg="bg-[#ADEED9]"
                  title="만보 걷기"
                  valueLabel={`${walkingMission.current.toLocaleString()} / ${walkingMission.target.toLocaleString()}`}
                  progress={
                    (walkingMission.current / walkingMission.target) * 100
                  }
                  barColor="bg-[#ADEED9]"
                  completed={walkingMission.completed}
                />
              )}

              {/* 물 마시기 — Accent Blue #AEE1F9 */}
              {waterMission && (
                <MissionRow
                  icon={<Droplets className="size-4 text-[#2878B0]" />}
                  iconBg="bg-[#AEE1F9]"
                  title="물 마시기"
                  valueLabel={`${waterMission.current} / ${waterMission.target}잔`}
                  progress={(waterMission.current / waterMission.target) * 100}
                  barColor="bg-[#AEE1F9]"
                  completed={waterMission.completed}
                  action={
                    <button
                      onClick={handleWaterAdd}
                      className="h-8 px-3 text-[12px] font-bold text-[#2878B0] bg-[#AEE1F9] rounded-full border border-[#2878B0]/15 min-w-[48px]"
                    >
                      +1잔
                    </button>
                  }
                />
              )}

              {/* 식단 기록 — Accent Yellow #FFF383 */}
              {dietMission && (
                <MissionRow
                  icon={<Apple className="size-4 text-[#8C7010]" />}
                  iconBg="bg-[#FFF383]"
                  title="식단 기록"
                  valueLabel={`${dietMission.current} / ${dietMission.target}끼`}
                  progress={(dietMission.current / dietMission.target) * 100}
                  barColor="bg-[#F4F683]"
                  completed={dietMission.completed}
                  action={
                    <button
                      onClick={() => setScreen("diet")}
                      className="h-8 px-3 text-[12px] font-bold text-[#8C7010] bg-[#FFF9A0] rounded-full border border-[#8C7010]/15 min-w-[48px]"
                    >
                      기록
                    </button>
                  }
                />
              )}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            🧪 테스트 패널 (개발용)
        ══════════════════════════════════════ */}
        <div>
          <button
            onClick={() => setShowTestPanel((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-[12px] font-bold text-[#7A7A7A] bg-[#F0F0F0] hover:bg-[#E4E4E4] transition-colors"
          >
            <span>🧪 테스트 패널 (개발용)</span>
            <span className="text-[10px]">
              {showTestPanel ? "▲ 접기" : "▼ 펼치기"}
            </span>
          </button>

          {showTestPanel && (
            <div className="mt-2 rounded-2xl border border-[#E0E0E0] bg-white overflow-hidden divide-y divide-[#F0F0F0]">
              {/* ── overall_state ── */}
              <div className="p-4">
                <p className="text-[11px] font-bold text-[#9B9B9B] uppercase tracking-[0.06em] mb-3">
                  overall_state — 캐릭터 배경색
                </p>
                <div className="flex flex-wrap gap-2">
                  {OVERALL_STATE_OPTIONS.map(({ value, emoji, label }) => {
                    const theme = CHARACTER_THEME[value];
                    const isActive = overallState === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setOverallState(value)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all"
                        style={{
                          backgroundColor: isActive ? theme.bgColor : "#F5F5F5",
                          border: isActive
                            ? `2px solid #3E8C28`
                            : "2px solid transparent",
                          color: isActive ? "#1A2E1C" : "#7A7A7A",
                        }}
                      >
                        <span>{emoji}</span>
                        <span>{label}</span>
                        <span
                          className="size-3 rounded-full ml-0.5 shrink-0"
                          style={{
                            backgroundColor: theme.bgColor,
                            border: "1px solid #ccc",
                          }}
                        />
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setOverallState(null)}
                    className="px-3 py-2 rounded-xl text-[12px] font-bold text-[#9B9B9B] bg-[#F5F5F5] border-2 border-transparent hover:bg-[#EBEBEB] transition-colors"
                  >
                    초기화
                  </button>
                </div>

                {/* 현재 배경색 미리보기 */}
                {overallState && (
                  <div
                    className="mt-3 rounded-xl px-3 py-2 flex items-center gap-2"
                    style={{
                      backgroundColor: CHARACTER_THEME[overallState].bgColor,
                    }}
                  >
                    <span className="text-[11px] font-bold text-[#5A5A5A]">
                      현재 배경색 →
                    </span>
                    <span className="text-[11px] font-mono text-[#3C3C3C]">
                      {CHARACTER_THEME[overallState].bgColor}
                    </span>
                    <span className="text-[11px] font-bold text-[#3C3C3C]">
                      ({CHARACTER_THEME[overallState].label})
                    </span>
                  </div>
                )}
              </div>

              {/* ── risk_change_summary ── */}
              <div className="p-4">
                <p className="text-[11px] font-bold text-[#9B9B9B] uppercase tracking-[0.06em] mb-3">
                  risk_change_summary — 위험도 변화 & 캐릭터 대사
                </p>
                <div className="flex flex-wrap gap-2">
                  {TEST_RISK_SCENARIOS.map(({ label, data }) => {
                    const isActive =
                      riskChangeSummary?.message === data.message &&
                      riskChangeSummary?.improved === data.improved;
                    return (
                      <button
                        key={label}
                        onClick={() => setRiskChangeSummary(data)}
                        className="px-3 py-2 rounded-xl text-[12px] font-bold transition-all border-2"
                        style={{
                          backgroundColor: isActive
                            ? data.improved
                              ? "#E8F9D6"
                              : "#FFE4ED"
                            : "#F5F5F5",
                          borderColor: isActive
                            ? data.improved
                              ? "#3E8C28"
                              : "#C0305A"
                            : "transparent",
                          color: isActive
                            ? data.improved
                              ? "#2A6020"
                              : "#C0305A"
                            : "#7A7A7A",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setRiskChangeSummary(null)}
                    className="px-3 py-2 rounded-xl text-[12px] font-bold text-[#9B9B9B] bg-[#F5F5F5] border-2 border-transparent hover:bg-[#EBEBEB] transition-colors"
                  >
                    null (숨김)
                  </button>
                </div>

                {/* 캐릭터 대사 미리보기 */}
                {riskChangeSummary && (
                  <div
                    className="mt-3 rounded-xl px-4 py-3 border"
                    style={{
                      backgroundColor: riskChangeSummary.improved
                        ? "#F0FDF4"
                        : "#FFF0F0",
                      borderColor: riskChangeSummary.improved
                        ? "#CBF891"
                        : "#F09BB0",
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.06em] mb-1.5"
                      style={{
                        color: riskChangeSummary.improved
                          ? "#2A6020"
                          : "#C0305A",
                      }}
                    >
                      캐릭터 대사 미리보기
                    </p>
                    <p
                      className="text-[13px] font-bold leading-relaxed"
                      style={{
                        color: riskChangeSummary.improved
                          ? "#1A4020"
                          : "#8B1A1A",
                      }}
                    >
                      "{getCharacterMessage(riskChangeSummary)}"
                    </p>
                    <div
                      className="flex items-center gap-3 mt-2 pt-2 border-t"
                      style={{
                        borderColor: riskChangeSummary.improved
                          ? "#CBF891"
                          : "#F09BB0",
                      }}
                    >
                      <span className="text-[11px] text-[#7A7A7A]">
                        변화량:{" "}
                        <b>
                          {riskChangeSummary.improved ? "▼" : "▲"}
                          {riskChangeSummary.change}%
                        </b>
                      </span>
                      <span className="text-[11px] text-[#7A7A7A]">
                        {riskChangeSummary.previous_probability}% →{" "}
                        {riskChangeSummary.current_probability}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* flex-1 scroll area end */}

      {/* ── 하단 내비게이션 ── */}
      <BottomNav />

      {/* ── 모달 ── */}
      <OfflinePenaltyModal
        open={showPenaltyModal}
        onClose={() => setShowPenaltyModal(false)}
      />

      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent showCloseButton={false} className="text-center">
          <DialogTitle className="sr-only">주간 건강 리포트 알림</DialogTitle>

          {/* 아이콘 헤더 */}
          <div className="size-14 rounded-full bg-[#CBF891] flex items-center justify-center mx-auto mb-1">
            <TrendingUp className="size-7 text-[#3E8C28]" strokeWidth={2} />
          </div>

          {/* 제목 */}
          <p className="text-[18px] font-bold text-[#3C3C3C] leading-snug">
            주간 건강 리포트 도착! 💌
          </p>

          {/* 설명 */}
          <p className="text-[13px] text-[#7A7A7A] leading-normal mt-2">
            이번 주 건강 점수와 AI가 분석한
            <br />
            맞춤 피드백이 준비되었어요.
          </p>

          {/* 버튼 */}
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1 h-12 text-[14px] font-bold rounded-2xl"
              onClick={() => setShowReportModal(false)}
            >
              나중에 보기
            </Button>
            <Button
              className="flex-1 h-12 text-[14px] font-bold rounded-2xl"
              onClick={() => {
                setShowReportModal(false);
                setScreen("report");
              }}
            >
              확인하러 가기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
