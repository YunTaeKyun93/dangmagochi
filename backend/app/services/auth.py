from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User, UserType, GoalType, RiskLevel, DiabetesType
from app.schemas.auth import RegisterRequest, KakaoRegisterRequest, NaverRegisterRequest
from app.services.challenge import create_default_challenges
from app.services.predict import predict_diabetes_risk

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(user.id), "exp": expire, "user_type": user.user_type.value}

    if user.user_type.value == UserType.normal:
        payload["goal"] = user.goal.value if user.goal else None  # type:ignore
    elif user.user_type.value == UserType.risk:
        payload["risk_level"] = (
            user.risk_level.value if user.risk_level else None
        )  # type:ignore
    elif user.user_type.value == UserType.diabetes:
        payload["diabetes_type"] = (
            user.diabetes_type.value if user.diabetes_type else None  # type:ignore
        )

    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_refresh_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user.id),
        "exp": expire,
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def calc_bmi(height: float, weight: float) -> float:
    height_m = height / 100
    return round(weight / (height_m**2), 1)


def register_user(db: Session, data: RegisterRequest) -> User:
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise ValueError("이미 사용 중인 이메일입니다.")

    bmi = calc_bmi(data.height, data.weight)

    user_type = UserType(data.user_type)
    goal = GoalType(data.goal) if data.goal else None
    diabetes_type = DiabetesType(data.diabetes_type) if data.diabetes_type else None
    risk_level = None

    user = User(
        email=data.email,
        password=hash_password(data.password),
        nickname=data.nickname,
        age=data.age,
        gender=data.gender,
        height=data.height,
        weight=data.weight,
        bmi=bmi,
        user_type=user_type,
        goal=goal,
        diabetes_type=diabetes_type,
        risk_level=risk_level,
        # ML 피처
        is_hypertension=data.is_hypertension,
        is_cholesterol=data.is_cholesterol,
        is_heart_disease=data.is_heart_disease,
        walking_difficulty=data.walking_difficulty,
        general_health=data.general_health,
        alcohol_status=data.alcohol_status,
        # LLM 피처
        smoke_status=data.smoke_status,
        exercise_freq=data.exercise_freq,
        fruit_intake=data.fruit_intake,
        veggie_intake=data.veggie_intake,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    if data.user_type != "diabetes":
        try:
            result = predict_diabetes_risk(user)
            risk_score = result["risk_score"]
            risk_level = result["risk_level"]
            if risk_score < 0.35:
                user.user_type = UserType.normal
                user.risk_level = RiskLevel.low
            else:
                user.user_type = UserType.risk
                user.risk_level = RiskLevel(risk_level)
            db.commit()
            db.refresh(user)
        except Exception:
                pass  
    
    create_default_challenges(db, user)


    return user



def register_kakao_user(
    db: Session,
    data: KakaoRegisterRequest,
) -> User:
    existing_user = db.query(User).filter(User.kakao_id == data.kakao_id).first()
    if existing_user:
        raise ValueError("이미 가입된 카카오 계정입니다.")

    bmi = calc_bmi(data.height, data.weight)

    user_type = UserType(data.user_type)
    goal = GoalType(data.goal) if data.goal else None
    diabetes_type = DiabetesType(data.diabetes_type) if data.diabetes_type else None
    risk_level = None

    user = User(
        kakao_id=data.kakao_id,
        email=f"kakao_{data.kakao_id}@kakao.com",
        password="",
        nickname=data.nickname,
        age=data.age,
        gender=data.gender,
        height=data.height,
        weight=data.weight,
        bmi=bmi,
        user_type=user_type,
        goal=goal,
        diabetes_type=diabetes_type,
        risk_level=risk_level,
        # ML 피처
        is_hypertension=data.is_hypertension,
        is_cholesterol=data.is_cholesterol,
        is_heart_disease=data.is_heart_disease,
        walking_difficulty=data.walking_difficulty,
        general_health=data.general_health,
        alcohol_status=data.alcohol_status,
        # LLM 피처
        smoke_status=data.smoke_status,
        exercise_freq=data.exercise_freq,
        fruit_intake=data.fruit_intake,
        veggie_intake=data.veggie_intake,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    create_default_challenges(db, user)

    return user



def register_naver_user(
    db: Session,
    data: NaverRegisterRequest,
) -> User:
    existing_user = db.query(User).filter(User.naver_id == data.naver_id).first()
    if existing_user:
        raise ValueError("이미 가입된 네이버 계정입니다.")

    bmi = calc_bmi(data.height, data.weight)

    user_type = UserType(data.user_type)
    goal = GoalType(data.goal) if data.goal else None
    diabetes_type = DiabetesType(data.diabetes_type) if data.diabetes_type else None
    risk_level = None

    user = User(
        naver_id=data.naver_id,
        email = data.email if data.email else f"naver_{data.naver_id}@dangmago.com",
        password="",
        nickname=data.nickname,
        age=data.age,
        gender=data.gender,
        height=data.height,
        weight=data.weight,
        bmi=bmi,
        user_type=user_type,
        goal=goal,
        diabetes_type=diabetes_type,
        risk_level=risk_level,
        # ML 피처
        is_hypertension=data.is_hypertension,
        is_cholesterol=data.is_cholesterol,
        is_heart_disease=data.is_heart_disease,
        walking_difficulty=data.walking_difficulty,
        general_health=data.general_health,
        alcohol_status=data.alcohol_status,
        # LLM 피처
        smoke_status=data.smoke_status,
        exercise_freq=data.exercise_freq,
        fruit_intake=data.fruit_intake,
        veggie_intake=data.veggie_intake,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    create_default_challenges(db, user)

    return user

def signin_user(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다.")

    if not verify_password(password, user.password):  # type:ignore
        raise ValueError("이메일 또는 비밀번호가 올바르지 않습니다.")

    if not user.is_active:  # type:ignore
        raise ValueError("비활성화된 계정입니다.")

    return user
