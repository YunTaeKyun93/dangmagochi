import sys
import os
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.core.config import settings


try:
      sys.path.append("/ml/risk_model")
      import config #type:ignore
      config.SAVE_DIR = "/tmp/risk_model/saved_models"
except ModuleNotFoundError:
      config = None






_model = None
_feats = None
_threshold = None


def get_model():
      global _model, _feats, _threshold
      if _model is None:
            try:
                  from predictor import load_model  # type: ignore
                  _model, _feats, _threshold = load_model()
            except ModuleNotFoundError:
                  return None, None, None
                  
      return  _model, _feats, _threshold


def predict_diabetes_risk(user)->dict:
  model, feats, threshold = get_model()
  if model is None:
      raise HTTPException(status_code=503, detail="모델 미로드")
  input_data = {
        "HighBP":                int(user.is_hypertension or 0),
        "HighChol":              int(user.is_cholesterol or 0),
        "BMI":                   float(user.bmi or 0),
        "HeartDiseaseorAttack":  int(user.is_heart_disease or 0),
        "HvyAlcoholConsump":     int(user.alcohol_status or 0),
        "GenHlth":               int(user.general_health or 3),
        "DiffWalk":              int(user.walking_difficulty or 0),
        "Sex":                   int(user.gender or 0),
        "Age":                   _age_to_group(user.age or 30),
    }
  from predictor import predict as ml_predict
  prob, level, judge = ml_predict(input_data, model, feats, threshold)

  if prob < 0.35:
        risk_level = "low"
  elif prob < 0.60:
        risk_level = "mid"
  else:
        risk_level = "high"

  return {
        "risk_score": round(float(prob), 4),
        "risk_level": risk_level,
        "top_factors": [],
        "is_improved": False,
    }

def _age_to_group(age: int) -> int:
    if age < 25: return 1
    elif age < 30: return 2
    elif age < 35: return 3
    elif age < 40: return 4
    elif age < 45: return 5
    elif age < 50: return 6
    elif age < 55: return 7
    elif age < 60: return 8
    elif age < 65: return 9
    elif age < 70: return 10
    elif age < 75: return 11
    elif age < 80: return 12
    else: return 13