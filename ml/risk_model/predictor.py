"""
예측 함수 — 서비스에서 사용하는 예측 로직
"""
import joblib
import pandas as pd
from config import SAVE_DIR
from feature_engineering import compute_risk_count
import os


def load_model(save_dir="/ml/risk_model/saved_models"):
    """저장된 모델, 피처, threshold 로드"""
    model = joblib.load(os.path.join(save_dir, "diabetes_model_v3.pkl"))
    feats = joblib.load(os.path.join(save_dir, "feature_names_v3.pkl"))
    threshold = joblib.load(os.path.join(save_dir, "threshold_v3.pkl"))
    return model, feats, threshold


def predict(input_data: dict, model=None, feats=None, threshold=None):
    """
    단일 사용자 입력에 대한 당뇨 위험도 예측

    Parameters:
        input_data: dict — 사용자 입력 9개
            HighBP, HighChol, BMI, HeartDiseaseorAttack,
            HvyAlcoholConsump, GenHlth, DiffWalk, Sex, Age

    Returns:
        prob: float — 위험 확률 (0.0~1.0)
        level: str — 저위험/주의/고위험/매우 고위험
        judge: str — 정상/당뇨 위험 판정
    """
    if model is None:
        model, feats, threshold = load_model()

    d = {f: 0 for f in feats}
    d.update({k: v for k, v in input_data.items() if k in feats})

    # RiskCount 자동 계산 (사용자 입력 없음!)
    if "RiskCount" in feats:
        d["RiskCount"] = compute_risk_count(input_data)

    X = pd.DataFrame([d])[feats]
    prob = model.predict_proba(X)[0][1]

    if prob < 0.2:
        level = "저위험"
    elif prob < 0.4:
        level = "주의"
    elif prob < 0.6:
        level = "고위험"
    else:
        level = "매우 고위험"

    judge = "⚠️ 당뇨 위험" if prob >= threshold else "✅ 정상"

    return prob, level, judge


def verify_model():
    """가상 환자 3명으로 모델 검증"""
    model, feats, threshold = load_model()

    test_cases = [
        ("건강한 30대 남성", {'HighBP': 0, 'HighChol': 0, 'BMI': 24,
            'HeartDiseaseorAttack': 0, 'HvyAlcoholConsump': 0, 'GenHlth': 2,
            'DiffWalk': 0, 'Sex': 1, 'Age': 5}),
        ("고위험 60대 여성", {'HighBP': 1, 'HighChol': 1, 'BMI': 35,
            'HeartDiseaseorAttack': 1, 'HvyAlcoholConsump': 0, 'GenHlth': 4,
            'DiffWalk': 1, 'Sex': 0, 'Age': 10}),
        ("경계선 50대", {'HighBP': 1, 'HighChol': 0, 'BMI': 28,
            'HeartDiseaseorAttack': 0, 'HvyAlcoholConsump': 0, 'GenHlth': 3,
            'DiffWalk': 0, 'Sex': 1, 'Age': 8}),
    ]

    for label, data in test_cases:
        prob, level, judge = predict(data, model, feats, threshold)
        print(f"  {label}: {prob:.4f} ({prob * 100:.1f}%) → {level} {judge}")
