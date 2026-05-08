"""OpenAI-powered mission generation and answer grading."""
from __future__ import annotations

import json
import random
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from models import Skill, Mission, Completion, UserProfile
from grader import calculate_skill_level


SKILL_STYLE_HINTS = {
    "Trading": "Generate missions about market analysis, chart reading, options strategy, risk management, or interpreting price action. Require written analysis with specific numbers, levels, and reasoning.",
    "Coding": "Generate missions that ask the user to write a Python function from scratch, debug a snippet, or explain the time/space complexity of an algorithm. Require code plus an explanation.",
    "Aptitude": "Generate missions with math word problems, logical reasoning puzzles, or verbal reasoning. Require full step-by-step working to be shown.",
    "General IQ": "Generate missions asking the user to read about a mental model, concept, or idea (e.g., second-order thinking, opportunity cost) and write a 150-word summary plus a real-world application.",
}


def _get_api_provider(db: Session) -> str:
    """Return the selected API provider ('openai' or 'gemini')."""
    profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
    return (profile.api_provider if profile and profile.api_provider else "openai").lower()


def _get_openai_client(db: Session):
    """Create an OpenAI client using the key from user_profile or env."""
    import os
    from openai import OpenAI

    profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
    api_key = (profile.openai_api_key if profile and profile.openai_api_key else None) or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OpenAI API key not configured. Set it in Settings or via OPENAI_API_KEY env var.")
    return OpenAI(api_key=api_key)


def _get_gemini_model(db: Session, model_name: str = "gemini-2.0-flash"):
    """Create a Gemini generative model using the key from user_profile or env."""
    import os
    import google.generativeai as genai

    profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
    api_key = (profile.gemini_api_key if profile and profile.gemini_api_key else None) or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Gemini API key not configured. Set it in Settings or via GEMINI_API_KEY env var.")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(model_name)


def _get_claude_client(db: Session):
    """Create an Anthropic client using the key from user_profile or env."""
    import os
    import anthropic

    profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
    api_key = (profile.claude_api_key if profile and profile.claude_api_key else None) or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("Claude API key not configured. Set it in Settings or via ANTHROPIC_API_KEY env var.")
    return anthropic.Anthropic(api_key=api_key)


def _get_groq_client(db: Session):
    """Create a Groq client using the key from user_profile or env."""
    import os
    from groq import Groq

    profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
    api_key = (profile.groq_api_key if profile and profile.groq_api_key else None) or os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("Groq API key not configured. Set it in Settings or via GROQ_API_KEY env var.")
    return Groq(api_key=api_key)


def _call_single_provider(db: Session, provider: str, system_prompt: str, user_prompt: str, temperature: float, max_tokens: int, use_strong_model: bool) -> str:
    """Call a single LLM provider. Raises on failure."""
    if provider == "gemini":
        model_name = "gemini-2.0-flash" if not use_strong_model else "gemini-2.0-flash"
        model = _get_gemini_model(db, model_name)
        combined_prompt = f"{system_prompt}\n\n{user_prompt}"
        response = model.generate_content(
            combined_prompt,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_tokens,
                "response_mime_type": "application/json",
            },
        )
        return response.text or "{}"
    elif provider == "claude":
        client = _get_claude_client(db)
        model = "claude-haiku-4-5-20241022" if not use_strong_model else "claude-sonnet-4-20250514"
        resp = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt + "\n\nIMPORTANT: Return ONLY valid JSON, no markdown fences or extra text.",
            messages=[
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
        )
        content = resp.content[0].text or "{}"
        # Strip markdown fences if present
        if content.startswith("```"):
            lines = content.split("\n")
            lines = [l for l in lines if not l.startswith("```")]
            content = "\n".join(lines)
        return content
    elif provider == "groq":
        client = _get_groq_client(db)
        model = "llama-3.1-8b-instant" if not use_strong_model else "llama-3.3-70b-versatile"
        resp = client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or "{}"
    else:
        client = _get_openai_client(db)
        model = "gpt-3.5-turbo" if not use_strong_model else "gpt-4o"
        resp = client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or "{}"


def _call_llm(db: Session, system_prompt: str, user_prompt: str, temperature: float = 0.8, max_tokens: int = 400, use_strong_model: bool = False) -> str:
    """Unified LLM call with auto-fallback: tries primary provider, then falls back to others."""
    import time
    import os

    primary = _get_api_provider(db)
    # Build fallback chain: primary first, then others (only those with keys)
    profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
    available = []
    if profile and profile.openai_api_key or os.getenv("OPENAI_API_KEY"):
        available.append("openai")
    if profile and profile.gemini_api_key or os.getenv("GOOGLE_API_KEY"):
        available.append("gemini")
    if profile and profile.claude_api_key or os.getenv("ANTHROPIC_API_KEY"):
        available.append("claude")
    if profile and profile.groq_api_key or os.getenv("GROQ_API_KEY"):
        available.append("groq")
    providers = [primary] + [p for p in available if p != primary] if primary in available else available

    last_error = None
    for provider in providers:
        for attempt in range(2):  # 2 attempts per provider
            try:
                return _call_single_provider(db, provider, system_prompt, user_prompt, temperature, max_tokens, use_strong_model)
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                is_quota = any(kw in err_str for kw in ["rate", "quota", "429", "resource_exhausted", "too many"])
                if is_quota and attempt == 0:
                    print(f"[agent] {provider} rate-limited, retrying in 3s...")
                    time.sleep(3)
                    continue
                elif is_quota:
                    print(f"[agent] {provider} quota exhausted, switching to next provider...")
                    break  # move to fallback provider
                else:
                    # Non-quota error (bad key, network, etc.) — skip to fallback
                    print(f"[agent] {provider} error: {e}, trying fallback...")
                    break

    raise last_error  # both providers failed


def _fallback_missions(skill_name: str) -> list[dict]:
    """Offline fallback when LLM call fails — expanded mission bank (#53)."""
    samples = {
        "Trading": [
            {"text": "Analyze today's NIFTY 50 movement. Identify 3 key support/resistance levels and explain your bias for tomorrow with reasoning.", "xp_reward": 120, "difficulty": "medium"},
            {"text": "Explain what a bull call spread is, when you'd use it, and give a concrete numerical example with max profit and loss.", "xp_reward": 130, "difficulty": "medium"},
            {"text": "A stock is trading at 500 with 30-day ATM IV of 40%. Estimate the expected 1-sigma move and explain the calculation.", "xp_reward": 140, "difficulty": "hard"},
            {"text": "Compare the Fibonacci retracement levels and Bollinger Bands for a stock that just dropped 10% in a week. Which tool gives better entry points and why?", "xp_reward": 130, "difficulty": "medium"},
            {"text": "You have ₹1,00,000 to invest. Create a diversified portfolio allocation across equity, debt, and gold with percentage splits. Justify each allocation.", "xp_reward": 110, "difficulty": "easy"},
            {"text": "Explain the difference between a protective put and a covered call. In what market conditions would you prefer each? Show P/L diagrams.", "xp_reward": 140, "difficulty": "hard"},
            {"text": "A company reports EPS of ₹25, PE ratio of 18, and sector average PE of 22. Is the stock undervalued? What other factors should you consider?", "xp_reward": 120, "difficulty": "medium"},
            {"text": "Describe 3 candlestick patterns that indicate a bullish reversal. For each, explain the psychology behind the pattern and how to confirm it.", "xp_reward": 130, "difficulty": "medium"},
            {"text": "What is the Iron Condor strategy? Explain when to use it, construct an example with specific strikes, and calculate max profit/loss.", "xp_reward": 150, "difficulty": "hard"},
            {"text": "Explain the concept of Position Sizing using the Kelly Criterion. Give a numerical example with a trade that has 60% win rate and 2:1 reward-to-risk.", "xp_reward": 140, "difficulty": "hard"},
        ],
        "Coding": [
            {"text": "Write a Python function that returns the longest palindromic substring of a given string. Do not use external libraries. Explain your approach and complexity.", "xp_reward": 130, "difficulty": "medium"},
            {"text": "Write a Python function that merges two sorted lists into one sorted list in O(n+m) time. Explain why the complexity holds.", "xp_reward": 100, "difficulty": "easy"},
            {"text": "Implement a LRU cache in Python with get and put in O(1). Explain the data structures used.", "xp_reward": 150, "difficulty": "hard"},
            {"text": "Write a function to detect a cycle in a linked list using Floyd's algorithm. Explain why it works mathematically.", "xp_reward": 120, "difficulty": "medium"},
            {"text": "Implement a binary search tree with insert, delete, and in-order traversal. What is the worst-case time complexity for each operation?", "xp_reward": 130, "difficulty": "medium"},
            {"text": "Write a Python decorator that retries a function up to 3 times with exponential backoff on exception. Include type hints.", "xp_reward": 110, "difficulty": "medium"},
            {"text": "Given a matrix of 0s and 1s, write a function to find the largest rectangle containing only 1s. Explain the stack-based approach.", "xp_reward": 150, "difficulty": "hard"},
            {"text": "Implement a rate limiter class using the sliding window algorithm. It should support `allow(timestamp)` returning True/False. Support configurable window and max requests.", "xp_reward": 140, "difficulty": "hard"},
            {"text": "Write a Python function that validates whether a string of parentheses, brackets, and braces is balanced. Handle edge cases and explain your approach.", "xp_reward": 90, "difficulty": "easy"},
            {"text": "Implement a trie (prefix tree) with insert, search, and startsWith methods. Explain space vs time tradeoffs compared to a hash set.", "xp_reward": 130, "difficulty": "medium"},
        ],
        "Aptitude": [
            {"text": "A train 150m long crosses a platform 250m long in 20 seconds. Find its speed in km/h. Show full working.", "xp_reward": 90, "difficulty": "easy"},
            {"text": "If the ratio of the ages of A and B is 5:7 and after 10 years it becomes 7:9, find their current ages. Show steps.", "xp_reward": 110, "difficulty": "medium"},
            {"text": "In how many ways can the letters of the word 'MISSISSIPPI' be arranged? Explain the reasoning.", "xp_reward": 120, "difficulty": "medium"},
            {"text": "A man can row 6 km/h in still water. If the river current is 2 km/h, how long does it take to row 16 km upstream and return? Show complete working.", "xp_reward": 100, "difficulty": "easy"},
            {"text": "Three pipes A, B, and C can fill a tank in 6, 8, and 12 hours. If all pipes are opened together, in what time will the tank be filled? Show the step-by-step solution.", "xp_reward": 100, "difficulty": "easy"},
            {"text": "A shopkeeper marks goods 30% above cost price and gives a 10% discount. Find the actual profit percentage. Show complete working.", "xp_reward": 110, "difficulty": "medium"},
            {"text": "In a group of 100 students, 70 passed in English, 80 in Math, and 60 in both. How many failed in both? Use a Venn diagram to explain.", "xp_reward": 100, "difficulty": "easy"},
            {"text": "A and B together can complete a work in 12 days. A alone can do it in 20 days. If B works alone for 8 days, what fraction of work remains? Show full working.", "xp_reward": 110, "difficulty": "medium"},
            {"text": "From a standard deck of 52 cards, what is the probability of drawing 2 aces in a row without replacement? Explain conditional probability.", "xp_reward": 120, "difficulty": "medium"},
            {"text": "A clock shows 3:15. What is the exact angle between the hour and minute hands? Show all calculations including the minute hand's effect on the hour hand.", "xp_reward": 130, "difficulty": "hard"},
        ],
        "General IQ": [
            {"text": "Read about 'Second-Order Thinking'. Write a 150-word summary and describe one real-world decision where it changes your conclusion.", "xp_reward": 100, "difficulty": "medium"},
            {"text": "Explain the concept of 'Opportunity Cost'. Give a 150-word summary and a real-world example from your own life.", "xp_reward": 100, "difficulty": "easy"},
            {"text": "Read about 'Survivorship Bias'. Summarize it in 150 words and describe a field where it is commonly overlooked.", "xp_reward": 110, "difficulty": "medium"},
            {"text": "Explain the Dunning-Kruger effect. Give 2 examples from real life and describe how you can avoid falling into this cognitive trap.", "xp_reward": 100, "difficulty": "easy"},
            {"text": "What is 'Inversion Thinking' (thinking backwards)? Explain the concept and apply it to the problem: 'How to have a great career?'", "xp_reward": 110, "difficulty": "medium"},
            {"text": "Describe the 'Circle of Competence' mental model. How can you identify your circle, and what are the dangers of operating outside it?", "xp_reward": 110, "difficulty": "medium"},
            {"text": "Explain the concept of 'Antifragility' by Nassim Taleb. Give 3 examples of antifragile systems and 3 examples of fragile systems.", "xp_reward": 130, "difficulty": "hard"},
            {"text": "What is the 'Pareto Principle' (80/20 rule)? Analyze how it applies to studying — which 20% of effort yields 80% of results?", "xp_reward": 100, "difficulty": "easy"},
            {"text": "Explain 'Hanlon's Razor' and 'Occam's Razor'. How are they different? Give a real-world scenario where each leads to better decisions.", "xp_reward": 120, "difficulty": "medium"},
            {"text": "Describe the 'Map is Not the Territory' mental model. Give 3 examples where people confuse models with reality, and explain the consequences.", "xp_reward": 130, "difficulty": "hard"},
        ],
    }
    base = samples.get(skill_name, samples["General IQ"])
    return base


def _generate_one_mission(db: Session, skill: Skill) -> list[dict]:
    """Generate 1 mission for a skill via OpenAI, with difficulty scaling and spaced repetition."""
    level = calculate_skill_level(skill.xp or 0)
    difficulty_hint = (
        "beginner-friendly" if level <= 2
        else "intermediate" if level <= 5
        else "advanced and challenging"
    )
    hint = SKILL_STYLE_HINTS.get(skill.name, "Generate challenging, thought-provoking missions.")

    # N1: Spaced repetition — find recent low-scoring topics
    weak_context = ""
    try:
        low_scores = (
            db.query(Mission.text)
            .join(Completion, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == skill.id, Completion.score < 50)
            .order_by(desc(Completion.submitted_at))
            .limit(3)
            .all()
        )
        if low_scores:
            topics = "; ".join([r[0][:80] for r in low_scores])
            weak_context = (
                f" The user previously scored low on these topics: [{topics}]. "
                f"Consider including a review element related to their weak areas."
            )
    except Exception:
        pass

    system_prompt = (
        f"You are a strict skill development coach. Generate exactly 1 challenging mission "
        f"for the skill: {skill.name}. The user is at Level {level}/10 ({difficulty_hint}). "
        f"Scale difficulty accordingly. {hint}{weak_context} "
        f"Return ONLY a JSON object with key 'missions' containing an array of 1 object "
        f"with fields: text (string), xp_reward (integer 80-150), difficulty (easy/medium/hard)."
    )

    try:
        content = _call_llm(
            db,
            system_prompt,
            f"Generate 1 mission for {skill.name} (Level {level}).",
            temperature=0.8,
            max_tokens=400,
        )
        parsed = json.loads(content)
        missions = parsed.get("missions") or parsed.get("data") or []
        if isinstance(missions, list) and len(missions) >= 1:
            return missions[:1]
        raise ValueError("Bad response format")
    except Exception as e:
        print(f"[agent] LLM fallback for {skill.name}: {e}")
        fallback = _fallback_missions(skill.name)
        return [random.choice(fallback)]


def generate_missions_for_today(db: Session, difficulty: Optional[str] = None) -> list[Mission]:
    """
    Generate up to 3 missions for today, distributed across weakest skills.
    Respects already-graded missions — only fills remaining slots.
    """
    today = date.today()

    existing = db.query(Mission).filter(Mission.date == today).all()
    graded = [m for m in existing if m.status == "graded"]
    graded_count = len(graded)

    # Already have 3+ missions (graded or not) — return as-is
    if graded_count >= 3:
        return existing

    needed = 3 - graded_count

    # Delete pending missions (they'll be regenerated fresh)
    for m in existing:
        if m.status == "pending":
            db.delete(m)
    db.commit()

    # Pick weakest skills, avoiding skills that already have a graded mission today
    all_skills = db.query(Skill).order_by(Skill.xp.asc()).all()
    if not all_skills:
        return graded

    graded_skill_ids = {m.skill_id for m in graded}
    available = [s for s in all_skills if s.id not in graded_skill_ids]
    if not available:
        available = all_skills  # fallback: allow repeat skills

    chosen_skills: list[Skill] = []
    for i in range(needed):
        chosen_skills.append(available[i % len(available)])

    saved: list[Mission] = []
    for skill in chosen_skills:
        missions_data = _generate_one_mission(db, skill)
        for m_data in missions_data[:1]:
            text = str(m_data.get("text", "")).strip()
            if not text:
                continue
            try:
                xp_reward = int(m_data.get("xp_reward", 100))
            except (TypeError, ValueError):
                xp_reward = 100
            xp_reward = max(80, min(150, xp_reward))
            if difficulty:
                # User chose a specific difficulty
                pass
            else:
                difficulty = str(m_data.get("difficulty", "medium")).lower()
            if difficulty not in ("easy", "medium", "hard"):
                difficulty = "medium"

            mission = Mission(
                skill_id=skill.id,
                text=text,
                xp_reward=xp_reward,
                date=today,
                status="pending",
                difficulty=difficulty,
            )
            db.add(mission)
            saved.append(mission)
    db.commit()
    for m in saved:
        db.refresh(m)
    return graded + saved


def grade_answer(mission_text: str, answer: str, skill_name: str, db: Session) -> dict:
    """
    Grade a user answer with GPT-4o. Returns dict: score, feedback, grade_label.
    """
    try:
        system_prompt = (
            f"You are a strict expert evaluator for {skill_name}. Grade the following answer on: "
            f"Accuracy (40 points), Depth (30 points), Clarity (20 points), Effort (10 points). "
            f"Total out of 100. Return ONLY a JSON object with keys: "
            f"score (integer 0-100), feedback (string, 2-3 sentences, specific and constructive), "
            f"grade_label (one of: Excellent, Good, Average, Poor)."
        )
        user_msg = f"MISSION:\n{mission_text}\n\nUSER ANSWER:\n{answer}"

        content = _call_llm(
            db,
            system_prompt,
            user_msg,
            temperature=0.3,
            max_tokens=400,
            use_strong_model=True,
        )
        parsed = json.loads(content)
        score = int(parsed.get("score", 0))
        score = max(0, min(100, score))
        feedback = str(parsed.get("feedback", "No feedback provided.")).strip()
        label = str(parsed.get("grade_label", "Average")).strip()
        if label not in ("Excellent", "Good", "Average", "Poor"):
            if score >= 85:
                label = "Excellent"
            elif score >= 70:
                label = "Good"
            elif score >= 50:
                label = "Average"
            else:
                label = "Poor"
        return {"score": score, "feedback": feedback, "grade_label": label}
    except Exception as e:
        print(f"[agent] LLM grading failed (both providers exhausted): {e}")

        # Heuristic fallback: length + keyword scoring
        answer_text = (answer or "").strip()
        length = len(answer_text)
        words = len(answer_text.split())
        # Bonus for structured answers
        has_steps = any(kw in answer_text.lower() for kw in ["step", "first", "second", "because", "therefore", "hence"])
        has_numbers = any(c.isdigit() for c in answer_text)
        has_code = "def " in answer_text or "```" in answer_text or "return " in answer_text

        base_score = 25
        if words >= 10: base_score += 10
        if words >= 30: base_score += 10
        if words >= 60: base_score += 10
        if words >= 100: base_score += 5
        if has_steps: base_score += 10
        if has_numbers: base_score += 5
        if has_code: base_score += 10
        score = min(80, base_score)

        if score >= 70: label = "Good"
        elif score >= 50: label = "Average"
        else: label = "Poor"

        return {
            "score": score,
            "feedback": f"Your answer was graded offline because the AI service is temporarily unavailable. The score is based on answer structure, length, and detail. For accurate AI grading, check your API key and quota in Settings. (Error: {e})",
            "grade_label": label,
        }
