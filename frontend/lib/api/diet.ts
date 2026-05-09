import { client, fetchWithAuth } from "./client";
import type { DietAnalyzeResponse, DietManualUpdateRequest } from "./types";

/** 백엔드 응답 래퍼 */
interface DietAnalyzeApiResponse {
  success: boolean;
  data: DietAnalyzeResponse & { diet_id: number };
}

/**
 * 음식 사진을 업로드하여 식단을 분석합니다.
 * POST /diet/analyze  (multipart/form-data, field name: "image")
 * - confidence < 0.7이면 프론트에서 [다시분석] / [직접입력] 버튼을 노출하세요.
 * - 401 발생 시 토큰을 자동 갱신하고 재시도합니다.
 */
export async function analyzeDiet(
  imageFile: File,
): Promise<DietAnalyzeResponse & { diet_id: number }> {
  const formData = new FormData();
  formData.append("image", imageFile);

  // fetchWithAuth: Authorization 헤더 자동 첨부 + 401 시 토큰 갱신 재시도
  // Content-Type은 브라우저가 multipart/form-data로 자동 설정 (직접 지정 금지)
  const res = await fetchWithAuth("/diet/analyze", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? body.message ?? `HTTP ${res.status}`);
  }

  const json: DietAnalyzeApiResponse = await res.json();
  return json.data;
}

/**
 * 음식명 텍스트로 영양소를 분석하고 식단 기록을 생성합니다.
 * POST /diet/analyze-text
 * - 사진 없이 음식명만 입력할 때 사용
 * - GPT-4o-mini로 영양소를 추정하고 DB에 저장합니다
 */
export async function analyzeDietByText(
  foodName: string,
): Promise<DietAnalyzeResponse & { diet_id: number }> {
  const json = await client.post<DietAnalyzeApiResponse>("/diet/analyze-text", {
    food_name: foodName,
  });
  return json.data;
}

/**
 * 직접 입력 모달에서 음식 정보를 수정합니다.
 * (confidence < 0.7이고 사용자가 [직접입력] 선택 시)
 */
export async function updateDietManual(
  dietId: string,
  data: DietManualUpdateRequest,
): Promise<DietAnalyzeResponse> {
  return client.put<DietAnalyzeResponse>(`/diet/${dietId}/manual`, data);
}
