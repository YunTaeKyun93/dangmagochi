import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppScreen,
  Character,
  UserProfile,
  Mission,
  DietEntry,
  ShopItem,
  GraduatedCharacter,
  BackendUserType,
} from "./types";

interface AppState {
  currentScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;

  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  autoLogin: boolean;
  setAutoLogin: (auto: boolean) => void;
  logout: () => void;

  accessToken: string;
  refreshToken: string;
  setTokens: (access: string, refresh: string) => void;

  naverProfile: {
    id: string;
    email?: string;
    name?: string;
    gender?: "M" | "F";
    age?: string;
    birthyear?: string;
  } | null;
  setNaverProfile: (profile: AppState["naverProfile"]) => void;

  userProfile: UserProfile | null;
  // ✨ 프로필 저장 시 맞춤형 미션도 함께 세팅되도록 변경
  setUserProfile: (profile: UserProfile) => void;

  character: Character | null;
  setCharacter: (character: Character) => void;
  updateCharacterMood: (mood: Character["mood"]) => void;
  addExperience: (exp: number) => void;

  missions: Mission[];
  setMissions: (missions: Mission[]) => void;
  updateMissionProgress: (missionId: string, progress: number) => void;
  completeMission: (missionId: string, inputValue?: string | number) => void;

  dietEntries: DietEntry[];
  addDietEntry: (entry: DietEntry) => void;
  removeDietEntry: (id: string) => void;

  shopItems: ShopItem[];
  setShopItems: (items: ShopItem[]) => void;
  purchaseItem: (itemId: string) => void;
  equipItem: (itemId: string) => void;

  graduatedCharacters: GraduatedCharacter[];
  graduateCharacter: () => void;

  onboardingStep: number;
  setOnboardingStep: (step: number) => void;

  // 알림 설정
  notificationSettings: {
    mission: boolean;
    event: boolean;
    health: boolean;
  } | null;
  setNotificationSettings: (settings: { mission: boolean; event: boolean; health: boolean }) => void;

  // 건강 데이터 연동 설정
  dataSyncSettings: {
    healthData: boolean;
    activityTracking: boolean;
  };
  setDataSyncSettings: (settings: { healthData: boolean; activityTracking: boolean }) => void;

  resetApp: () => void;

  // 자정 기준 미션 일일 초기화
  checkDailyMissionReset: () => void;
}

// ==========================================
// 💡 미션 팩토리: 유저 타입별 미션 리스트 생성기
// ==========================================
const generateMissionsForUser = (type: BackendUserType): Mission[] => {
  // 1. 전 유저 공통 미션
  // ── 공통 미션 합계: 250 XP ──────────────────────────────
  // 난이도 기준: hard(신체 활동/달성 어려움) > medium(습관형성) > easy(단순 체크)
  const commonMissions: Mission[] = [
    {
      id: "c1",
      title: "만보 걷기",
      description: "Capacitor Health 연동",
      type: "auto",
      category: "walking",
      target: 10000,
      current: 0,
      exp: 80, // hard — 자동 측정이지만 달성이 어려움
      completed: false,
      icon: "👟",
    },
    {
      id: "c2",
      title: "물 마시기",
      description: "조금씩 자주 물 마시기",
      type: "manual",
      category: "water",
      target: 8,
      current: 0,
      exp: 35, // easy
      completed: false,
      icon: "💧",
    },
    {
      id: "c3",
      title: "운동 30분",
      description: "가벼운 운동으로 활력 찾기",
      type: "manual",
      category: "exercise",
      target: 1,
      current: 0,
      exp: 65, // medium
      completed: false,
      icon: "🏃",
    },
    {
      id: "c4",
      title: "수면 7시간",
      description: "충분한 수면 취하기",
      type: "manual",
      category: "sleep",
      target: 1,
      current: 0,
      exp: 35, // easy
      completed: false,
      icon: "🛌",
    },
    {
      id: "c5",
      title: "야식 안 먹기",
      description: "속 편하게 잠자리에 들기",
      type: "manual",
      category: "diet",
      target: 1,
      current: 0,
      exp: 35, // easy
      completed: false,
      icon: "🚫",
    },
  ]; // 소계: 80+35+65+35+35 = 250 XP

  let specificMissions: Mission[] = [];

  // ── 당뇨 공통 미션 합계: 100 XP ─────────────────────────
  // 미션이 많아 개별 XP를 낮게 설정, 전용 미션 50 XP와 합산해 150 XP
  const diabeticCommonMissions: Mission[] = [
    {
      id: "db1",
      title: "공복 혈당 기록",
      description: "기상 직후 혈당 수치 기록",
      type: "manual",
      inputType: "number",
      category: "health_record",
      target: 1,
      current: 0,
      exp: 20, // medium — 매일 측정 습관
      completed: false,
      icon: "🩸",
    },
    {
      id: "db2",
      title: "식전/식후 혈당 기록",
      description: "식사 전후 혈당 수치 체크",
      type: "manual",
      inputType: "number",
      category: "health_record",
      target: 3,
      current: 0,
      exp: 25, // medium — 3회 측정
      completed: false,
      icon: "🍽️",
    },
    {
      id: "db3",
      title: "취침 전 혈당 기록",
      description: "잠들기 전 안전 확인",
      type: "manual",
      inputType: "number",
      category: "health_record",
      target: 1,
      current: 0,
      exp: 15, // easy
      completed: false,
      icon: "🌙",
    },
    {
      id: "db4",
      title: "식단 사진 기록",
      description: "AI 식단 분석 연동",
      type: "auto",
      category: "diet",
      target: 3,
      current: 0,
      exp: 15, // easy — 앱 사용 유도
      completed: false,
      icon: "📸",
    },
    {
      id: "db5",
      title: "식후 스쿼트/걷기",
      description: "혈당 스파이크 방지",
      type: "manual",
      category: "exercise",
      target: 1,
      current: 0,
      exp: 15, // medium
      completed: false,
      icon: "🚶",
    },
    {
      id: "db6",
      title: "외출 간식 소지",
      description: "저혈당 대비 간식 챙기기",
      type: "manual",
      category: "medicine",
      target: 1,
      current: 0,
      exp: 5, // easy — 단순 체크
      completed: false,
      icon: "🍬",
    },
    {
      id: "db7",
      title: "발 상태 확인",
      description: "상처나 이상이 없는지 확인",
      type: "manual",
      inputType: "text",
      category: "health_record",
      target: 1,
      current: 0,
      exp: 5, // easy — 단순 체크
      completed: false,
      icon: "🦶",
    },
  ]; // 소계: 20+25+15+15+15+5+5 = 100 XP
  switch (type) {
    // ── general_diet 전용: 150 XP ───────────────────────────
    case "general_diet":
      specificMissions = [
        {
          id: "d1",
          title: "유산소 운동 30분",
          description: "체지방 연소를 위한 유산소",
          type: "manual",
          category: "exercise",
          target: 1,
          current: 0,
          exp: 60, // hard — 꾸준한 유산소 운동
          completed: false,
          icon: "🏃‍♀️",
        },
        {
          id: "d2",
          title: "식단 사진 기록",
          description: "AI 칼로리 분석 연동",
          type: "auto",
          category: "diet",
          target: 3,
          current: 0,
          exp: 35, // medium — 3회 기록
          completed: false,
          icon: "📸",
        },
        {
          id: "d3",
          title: "저칼로리 식단",
          description: "식단 분석 70점 이상 달성",
          type: "auto",
          category: "diet",
          target: 1,
          current: 0,
          exp: 40, // hard — AI 판정 기준 달성
          completed: false,
          icon: "🥗",
        },
        {
          id: "d4",
          title: "저녁 8시 이후 금식",
          description: "야간 공복 시간 유지",
          type: "manual",
          category: "diet",
          target: 1,
          current: 0,
          exp: 15, // easy — 자기 통제
          completed: false,
          icon: "⏰",
        },
      ]; // 소계: 60+35+40+15 = 150 XP
      break;

    // ── general_health 전용: 150 XP ──────────────────────────
    case "general_health":
      specificMissions = [
        {
          id: "h1",
          title: "채소 섭취",
          description: "신선한 채소 챙겨 먹기",
          type: "manual",
          category: "diet",
          target: 1,
          current: 0,
          exp: 50, // easy
          completed: false,
          icon: "🥬",
        },
        {
          id: "h2",
          title: "과일 섭취",
          description: "비타민 충전을 위한 과일",
          type: "manual",
          category: "diet",
          target: 1,
          current: 0,
          exp: 50, // easy
          completed: false,
          icon: "🍎",
        },
        {
          id: "h3",
          title: "스트레칭 10분",
          description: "굳은 몸 풀어주기",
          type: "manual",
          category: "exercise",
          target: 1,
          current: 0,
          exp: 50, // easy
          completed: false,
          icon: "🧘",
        },
      ]; // 소계: 50+50+50 = 150 XP
      break;

    // ── general_fitness 전용: 150 XP ─────────────────────────
    case "general_fitness":
      specificMissions = [
        {
          id: "f1",
          title: "근력 운동 45분",
          description: "근육량 증가를 위한 웨이트",
          type: "manual",
          category: "exercise",
          target: 1,
          current: 0,
          exp: 70, // hard — 고강도 운동
          completed: false,
          icon: "🏋️",
        },
        {
          id: "f2",
          title: "단백질 식단 기록",
          description: "AI 단백질 분석 연동",
          type: "auto",
          category: "diet",
          target: 2,
          current: 0,
          exp: 40, // medium
          completed: false,
          icon: "🥩",
        },
        {
          id: "f3",
          title: "수면 8시간",
          description: "근육 회복을 위한 충분한 수면",
          type: "manual",
          category: "sleep",
          target: 1,
          current: 0,
          exp: 25, // easy
          completed: false,
          icon: "🛌",
        },
        {
          id: "f4",
          title: "운동 후 스트레칭",
          description: "부상 방지 및 근육 이완",
          type: "manual",
          category: "exercise",
          target: 1,
          current: 0,
          exp: 15, // easy
          completed: false,
          icon: "🧘‍♂️",
        },
      ]; // 소계: 70+40+25+15 = 150 XP
      break;

    // ── at_risk 전용: 150 XP ─────────────────────────────────
    case "at_risk":
      specificMissions = [
        {
          id: "r1",
          title: "식후 걷기",
          description: "혈당 스파이크 방지",
          type: "manual",
          category: "exercise",
          target: 1,
          current: 0,
          exp: 50, // medium
          completed: false,
          icon: "🚶",
        },
        {
          id: "r2",
          title: "저탄수화물 식단",
          description: "AI 탄수화물 기준치 달성",
          type: "auto",
          category: "diet",
          target: 1,
          current: 0,
          exp: 65, // hard — AI 판정 기준 달성
          completed: false,
          icon: "🍚",
        },
        {
          id: "r3",
          title: "체중 기록",
          description: "체중 변화 모니터링",
          type: "auto",
          category: "health_record",
          target: 1,
          current: 0,
          exp: 15, // easy
          completed: false,
          icon: "⚖️",
        },
        {
          id: "r4",
          title: "식단 분석",
          description: "전반적인 영양소 밸런스 체크",
          type: "auto",
          category: "diet",
          target: 3,
          current: 0,
          exp: 20, // medium
          completed: false,
          icon: "📊",
        },
      ]; // 소계: 50+65+15+20 = 150 XP
      break;

    // ── diabetic_1 전용: 공통100 + 전용50 = 150 XP ──────────
    case "diabetic_1":
      specificMissions = [
        ...diabeticCommonMissions,
        {
          id: "db1_1",
          title: "인슐린 주사 체크",
          description: "매 끼니 인슐린 투여 확인",
          type: "manual",
          category: "medicine",
          target: 3,
          current: 0,
          exp: 25, // hard — 매 끼니 투여 관리
          completed: false,
          icon: "💉",
        },
        {
          id: "db1_2",
          title: "인슐린 조절 (식단)",
          description: "AI 탄수화물 분석 기반 조절",
          type: "auto",
          category: "diet",
          target: 3,
          current: 0,
          exp: 15, // medium
          completed: false,
          icon: "⚖️",
        },
        {
          id: "db1_3",
          title: "혈당 변동폭 기록",
          description: "하루 최고/최저 수치 차이 기록",
          type: "manual",
          category: "health_record",
          inputType: "number",
          target: 1,
          current: 0,
          exp: 10, // medium
          completed: false,
          icon: "📈",
        },
      ]; // 소계: 당뇨공통100 + 25+15+10 = 150 XP
      break;

    // ── diabetic_2 전용: 공통100 + 전용50 = 150 XP ──────────
    case "diabetic_2":
      specificMissions = [
        ...diabeticCommonMissions,
        {
          id: "db2_1",
          title: "하체 운동",
          description: "스쿼트, 걷기 등 인슐린 저항성 개선",
          type: "manual",
          category: "exercise",
          target: 1,
          current: 0,
          exp: 20, // medium
          completed: false,
          icon: "🦵",
        },
        {
          id: "db2_2",
          title: "체중 기록",
          description: "건강 체중 유지를 위한 기록",
          type: "manual",
          inputType: "number",
          category: "health_record",
          target: 1,
          current: 0,
          exp: 10, // easy
          completed: false,
          icon: "⚖️",
        },
        {
          id: "db2_3",
          title: "정제 탄수화물 피하기",
          description: "빵, 면 등 단순당 섭취 제한",
          type: "manual",
          category: "diet",
          target: 1,
          current: 0,
          exp: 20, // medium
          completed: false,
          icon: "🥐",
        },
      ]; // 소계: 당뇨공통100 + 20+10+20 = 150 XP
      break;
  }

  // 공통 미션과 전용 미션을 합쳐서 반환
  return [...commonMissions, ...specificMissions];
};

const defaultShopItems: ShopItem[] = [
  {
    id: "1",
    name: "봄 정원",
    description: "꽃이 만발한 정원 배경",
    category: "background",
    expCost: 200,
    imageUrl: "/backgrounds/spring-garden.png",
    owned: false,
    equipped: false,
  },
  // ... 생략 (기존 상점 데이터) ...
  {
    id: "5",
    name: "회복 물약",
    description: "캐릭터의 기분을 회복시켜요",
    category: "special",
    expCost: 500,
    imageUrl: "/special/potion.png",
    owned: false,
    equipped: false,
  },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentScreen: "splash",
      setScreen: (screen) => set({ currentScreen: screen }),

      isAuthenticated: false,
      setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
      autoLogin: false,
      setAutoLogin: (auto) => set({ autoLogin: auto }),
      logout: () => set({ isAuthenticated: false, accessToken: "", refreshToken: "", currentScreen: "login" }),

      accessToken: "",
      refreshToken: "",
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),

      naverProfile: null,
      setNaverProfile: (profile) => set({ naverProfile: profile }),

      userProfile: null,

      // ✨ 유저 프로필이 저장될 때, healthType을 읽어서 미션을 자동으로 세팅합니다!
      setUserProfile: (profile) =>
        set({
          userProfile: profile,
          missions: generateMissionsForUser(profile.healthType), // 미션 팩토리 실행!
        }),

      character: null,
      setCharacter: (character) => set({ character }),
      updateCharacterMood: (mood) =>
        set((state) => ({
          character: state.character ? { ...state.character, mood } : null,
        })),
      addExperience: (exp) =>
        set((state) => {
          if (!state.character) return {};
          let newExp = state.character.experience + exp;
          let newLevel = state.character.level;
          let expToNext = state.character.experienceToNextLevel;

          // 레벨별 필요 경험치 (하루 400 XP 기준, 15일 총 6000 XP로 Lv5 달성)
          // Lv1→2: 800 XP (2일), Lv2→3: 1200 XP (3일),
          // Lv3→4: 1600 XP (4일), Lv4→5: 2400 XP (6일)
          const EXP_TABLE: Record<number, number> = { 1: 800, 2: 1200, 3: 1600, 4: 2400 };

          while (newExp >= expToNext && newLevel < 5) {
            newExp -= expToNext;
            newLevel = (newLevel + 1) as 1 | 2 | 3 | 4 | 5;
            expToNext = EXP_TABLE[newLevel] ?? 2400;
          }
          return {
            character: {
              ...state.character,
              experience: newExp,
              level: newLevel,
              experienceToNextLevel: expToNext,
            },
          };
        }),

      // 최초에는 빈 배열 (가입 완료 시 채워짐)
      missions: [],
      setMissions: (missions) => set({ missions }),
      updateMissionProgress: (missionId, progress) =>
        set((state) => ({
          missions: state.missions.map((m) =>
            m.id === missionId
              ? {
                  ...m,
                  current: Math.min(progress, m.target),
                  completed: progress >= m.target,
                }
              : m,
          ),
        })),

      // ✨ 완료 처리 로직에 inputValue(입력값) 파라미터 추가
      completeMission: (missionId, inputValue) => {
        const state = get();
        const mission = state.missions.find((m) => m.id === missionId);
        if (mission && !mission.completed) {
          // 여기서 백엔드로 inputValue를 보내는 로직을 나중에 추가할 수 있습니다.
          // 예: if (mission.inputType === 'number') { await api.post(`/glucose`, { value: inputValue }) }

          const updatedMissions = state.missions.map((m) =>
            m.id === missionId
              ? { ...m, completed: true, current: m.target }
              : m,
          );
          const allCompleted = updatedMissions.every((m) => m.completed);
          const needsHealing =
            state.character?.mood === "sick" || state.character?.mood === "sad";

          set((state) => ({
            missions: updatedMissions,
            character:
              state.character && allCompleted && needsHealing
                ? { ...state.character, mood: "happy" }
                : state.character,
          }));
          state.addExperience(mission.exp);
        }
      },

      dietEntries: [],
      addDietEntry: (entry) =>
        set((state) => {
          const needsHealing =
            state.character?.mood === "sick" || state.character?.mood === "sad";
          return {
            dietEntries: [...state.dietEntries, entry],
            character: state.character
              ? {
                  ...state.character,
                  mood: needsHealing ? "happy" : state.character.mood,
                }
              : null,
          };
        }),
      removeDietEntry: (id) =>
        set((state) => ({
          dietEntries: state.dietEntries.filter((entry) => entry.id !== id),
        })),

      shopItems: defaultShopItems,
      setShopItems: (items) => set({ shopItems: items }),
      purchaseItem: (itemId) => {
        const state = get();
        const item = state.shopItems.find((i) => i.id === itemId);
        if (
          item &&
          state.character &&
          state.character.experience >= item.expCost &&
          !item.owned
        ) {
          set((state) => ({
            shopItems: state.shopItems.map((i) =>
              i.id === itemId ? { ...i, owned: true } : i,
            ),
            character: state.character
              ? {
                  ...state.character,
                  experience: state.character.experience - item.expCost,
                }
              : null,
          }));
        }
      },
      equipItem: (itemId) =>
        set((state) => ({
          shopItems: state.shopItems.map((i) =>
            i.id === itemId
              ? { ...i, equipped: !i.equipped }
              : i.category ===
                  state.shopItems.find((item) => item.id === itemId)?.category
                ? { ...i, equipped: false }
                : i,
          ),
        })),

      graduatedCharacters: [],
      graduateCharacter: () => {
        // ... 생략 (기존 졸업 로직 동일) ...
      },

      onboardingStep: 0,
      setOnboardingStep: (step) => set({ onboardingStep: step }),

      notificationSettings: null,
      setNotificationSettings: (settings) => set({ notificationSettings: settings }),

      dataSyncSettings: { healthData: true, activityTracking: true },
      setDataSyncSettings: (settings) => set({ dataSyncSettings: settings }),

      // ── 일일 미션 초기화 ──────────────────────────────────────────────────
      // 앱 진입 시 호출. lastActiveDate가 오늘과 다르면 미션을 새로 생성하고
      // lastActiveDate를 오늘로 업데이트한다.
      checkDailyMissionReset: () => {
        const state = get();
        if (!state.userProfile) return;

        const today = new Date();
        const todayStr = today.toDateString(); // e.g. "Fri May 09 2026"

        const lastActive = state.userProfile.lastActiveDate
          ? new Date(state.userProfile.lastActiveDate)
          : null;
        const lastStr = lastActive?.toDateString() ?? "";

        // 날짜가 바뀌었을 때만 초기화
        if (todayStr !== lastStr) {
          set({
            missions: generateMissionsForUser(state.userProfile.healthType),
            userProfile: {
              ...state.userProfile,
              lastActiveDate: today,
            },
          });
        }
      },

      resetApp: () =>
        set({
          currentScreen: "splash",
          isAuthenticated: false,
          accessToken: "",
          refreshToken: "",
          autoLogin: false,
          userProfile: null,
          character: null,
          missions: [],
          dietEntries: [],
          shopItems: defaultShopItems,
          graduatedCharacters: [],
          onboardingStep: 0,
          naverProfile: null,   // 소셜 로그인 임시 데이터도 초기화
        }),
    }),
    {
      name: "healthy-friend-storage",
      version: 2, // points → exp 마이그레이션
      migrate: (persisted: any, fromVersion: number) => {
        if (fromVersion < 2) {
          // 캐시된 missions에 points 필드가 있으면 exp로 변환
          if (Array.isArray(persisted.missions)) {
            persisted.missions = persisted.missions.map((m: any) => ({
              ...m,
              exp: m.exp ?? m.points ?? 0,
            }));
          }
          // userProfile.points → exp
          if (persisted.userProfile && persisted.userProfile.points !== undefined) {
            persisted.userProfile.exp = persisted.userProfile.exp ?? persisted.userProfile.points ?? 0;
            delete persisted.userProfile.points;
          }
        }
        return persisted;
      },
      partialize: (state) => {
        // naverProfile은 회원가입 흐름의 임시 데이터이므로 localStorage에 저장하지 않음
        const { currentScreen, isAuthenticated, naverProfile, ...rest } = state;
        return rest;
      },
    },
  ),
);
