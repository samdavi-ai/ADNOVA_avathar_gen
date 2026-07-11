"""
ADNOVA Brand Persona Studio — FastAPI Backend

An enterprise AI Creative Director and Validation Platform that:
1. Validates Brand Research JSONs (Cross Validation & Inference Loop)
2. Automatically infers optimal Representative details (removes manual controls)
3. Prompts & generates Transparent Avatar and Background Scene separately
4. Local PIL composition of layers with occlusion, perspectives, and shadows
5. Preserves validation audits, prompts, and separate assets to disk
"""

import os
import io
import uuid
import json
import base64
import logging
import traceback
import concurrent.futures
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from PIL import Image, ImageFilter
import numpy as np

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = FastAPI(title="ADNOVA Brand Persona Studio Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in environment")

GENERATED_DIR = Path(__file__).parent / "generated"
GENERATED_DIR.mkdir(exist_ok=True)

# ──────────────────────────────────────────────────────────────
# SYSTEM INSTRUCTIONS & SCENE LIBRARY (100+ Templates)
# ──────────────────────────────────────────────────────────────

SCENE_LIBRARY = []
locations = [
    "London townhouse", "New York loft", "Tokyo apartment", "Scandinavian cabin",
    "Parisian salon", "Dubai penthouse", "Milan apartment", "Berlin studio",
    "Sydney beach house", "Toronto condo", "Zurich chalet", "Kyoto tea house",
    "Barcelona flat", "Singapore high-rise", "Mumbai terrace"
]

environments = [
    "living room with minimal light oak furniture and linen curtains",
    "cozy study room with bookshelves and soft warm lighting",
    "bright kitchen with marble countertops and green plants",
    "spacious workspace with industrial exposed brick walls",
    "luxury minimalist bathroom vanity with high-end brass accents",
    "contemporary sunlit office overlook with floor-to-ceiling windows",
    "chic residential balcony showing city skyline at sunset",
    "outdoor terrace patio with tropical plants and comfortable seating",
    "understated retail showroom with warm wooden textures",
    "private studio setting with soft fashion-editorial gallery lighting"
]

# Generate exactly 100 templates
for idx in range(100):
    loc = locations[idx % len(locations)]
    env = environments[idx % len(environments)]
    
    if idx % 8 == 0:
        industries = ["footwear"]
    elif idx % 8 == 1:
        industries = ["fashion"]
    elif idx % 8 == 2:
        industries = ["skincare", "cosmetics"]
    elif idx % 8 == 3:
        industries = ["technology", "saas"]
    elif idx % 8 == 4:
        industries = ["automotive"]
    elif idx % 8 == 5:
        industries = ["healthcare", "wellness"]
    elif idx % 8 == 6:
        industries = ["finance", "corporate"]
    else:
        industries = ["hospitality", "luxury", "retail"]
        
    styles = ["modern"]
    if idx % 3 == 0:
        styles.append("minimalist")
    elif idx % 3 == 1:
        styles.append("scandinavian")
    else:
        styles.append("industrial")
        
    desc = (
        f"A photorealistic, commercially styled background of a {loc} {env}. "
        f"Designed with clean empty space in the center, soft balanced lighting, "
        f"and no people or products in the scene."
    )
    
    SCENE_LIBRARY.append({
        "id": f"sc_template_{idx+1:03d}",
        "description": desc,
        "industries": industries,
        "styles": styles
    })


# ──────────────────────────────────────────────────────────────
# STRUCTURED LLM VALIDATION & INFERENCE ENGINE MODELS
# ──────────────────────────────────────────────────────────────

class ValidatedBrand(BaseModel):
    brandName: str = Field(description="Validated name of the brand")
    industry: str = Field(description="Normalized industry of the brand")
    primaryProduct: str = Field(description="Primary product catalog entry")
    secondaryProducts: list[str] = Field(default_factory=list, description="Secondary products catalog list")
    country: str = Field(description="Target country geography")
    markets: list[str] = Field(default_factory=list, description="Primary target markets list")
    brandColors: list[str] = Field(default_factory=list, description="Validated brand hex color codes")
    visualStyle: str = Field(description="Brand visual aesthetic preference")
    communicationStyle: str = Field(description="Normalized communications style")
    tone: str = Field(description="Tone of brand message")

class ValidatedPersona(BaseModel):
    name: str = Field(description="Name of the customer profile")
    age: str = Field(description="Validated age range, corrected if original contains anomalies")
    gender: str = Field(description="Raw audience target gender (e.g. All Genders, Female, Male)")
    summary: str = Field(description="Compact summary of lifestyle")
    painPoints: list[str] = Field(default_factory=list, description="Key client pain points")
    buyingMotivations: list[str] = Field(default_factory=list, description="Key buying triggers")
    platforms: list[str] = Field(default_factory=list, description="Target platform channels")

class InferredRepresentative(BaseModel):
    age: str = Field(description="Specific age or narrow age group resolved for model portrait")
    gender: str = Field(description="Specific representative gender resolved for campaign portrait (e.g. female, male)")
    ethnicity: str = Field(description="Resolved representative ethnicity based on target geographies")
    skinTone: str = Field(description="Specific skin tone of representative model")
    hair: str = Field(description="Hair color and style for model")
    expression: str = Field(description="Facial expression of representative model")
    wardrobe: str = Field(description="Wardrobe colors and materials based on brandColors and industry requirements")
    accessories: str = Field(description="Accessories resolved for the representative model")
    pose: str = Field(description="Pose instructions for the model")
    camera: str = Field(description="Camera and lens specification")
    lighting: str = Field(description="Lighting style and direction")
    background: str = Field(description="Description of the surrounding environment")

class ValidationDiff(BaseModel):
    field: str = Field(description="Field name validated")
    raw_value: str = Field(description="Original unvalidated value from JSON")
    validated_value: str = Field(description="Validated or corrected value")
    reasoning: str = Field(description="Detailed reason for change or validation decision")

class ConfidenceReport(BaseModel):
    score: int = Field(description="Representative inference confidence score (0-100)")
    reasoning: str = Field(description="Strategic justification for representative mapping")

class ValidationInferenceResult(BaseModel):
    validated_brand: ValidatedBrand
    validated_persona: ValidatedPersona
    representative: InferredRepresentative
    validation_report: list[ValidationDiff]
    confidence_report: ConfidenceReport


# ──────────────────────────────────────────────────────────────
# PROMPT COMPOSITION HELPERS
# ──────────────────────────────────────────────────────────────

def select_best_scene(industry: str, visual_style: str) -> str:
    """Score and randomly match the best background template from scene library."""
    scored_templates = []
    ind_lower = industry.lower()
    style_lower = visual_style.lower()
    
    import random
    
    for item in SCENE_LIBRARY:
        score = 0
        # Match industry
        if any(ind in ind_lower for ind in item["industries"]):
            score += 10
        # Match visual style
        if any(sty in style_lower for sty in item["styles"]):
            score += 5
            
        # Add random score noise to prevent background repetition (Quality requirement)
        random_factor = random.uniform(0.0, 4.0)
        scored_templates.append((score + random_factor, item["description"]))
        
    scored_templates.sort(key=lambda x: x[0], reverse=True)
    return scored_templates[0][1]


def build_avatar_prompt_spec(rep: InferredRepresentative, brand_colors: list[str]) -> str:
    """Build the photorealistic avatar prompt incorporating enhancement.txt guidelines."""
    # Try reading enhancement.txt
    enhancement_path = Path(__file__).parent.parent / "enhancement.txt"
    enhancement_content = ""
    if enhancement_path.exists():
        try:
            enhancement_content = enhancement_path.read_text(encoding="utf-8")
        except Exception:
            pass
            
    if not enhancement_content:
        enhancement_content = (
            "ENTERPRISE AVATAR ASSET EXTRACTION ENGINE\n"
            "ROLE: Generate ONLY one person. No background. Center the subject. No scenery."
        )
        
    dossier = (
        f"\n\n========================================================\n"
        f"CURRENT SPECIFICATION (ASSET 1 : PORTRAIT AVATAR ONLY)\n"
        f"========================================================\n"
        f"Subject Details:\n"
        f"- Portrait: Photorealistic {rep.ethnicity} {rep.gender}, age {rep.age}\n"
        f"- Skin Tone & Features: {rep.skinTone}, {rep.hair}\n"
        f"- Facial Expression: {rep.expression}\n"
        f"- Pose: {rep.pose}\n"
        f"- Clothing: {rep.wardrobe} matching accent colors {', '.join(brand_colors[:2])}\n"
        f"- Accessories: {rep.accessories}\n"
        f"- Camera & Lighting: {rep.camera}, {rep.lighting}\n"
        f"BACKGROUND INSTRUCTION: Pure flat uniform solid white #FFFFFF background. "
        f"No shadows outside subject. Easy for automatic background extraction."
    )
    return enhancement_content + dossier


def build_background_prompt_spec(rep: InferredRepresentative, scene_desc: str, brand_colors: list[str]) -> str:
    """Build the background scene prompt incorporating cc.txt guidelines."""
    cc_path = Path(__file__).parent.parent / "cc.txt"
    cc_content = ""
    if cc_path.exists():
        try:
            cc_content = cc_path.read_text(encoding="utf-8")
        except Exception:
            pass
            
    if not cc_content:
        cc_content = (
            "ENTERPRISE ASSET GENERATION ENGINE\n"
            "ROLE: Generate ONLY the background environment. Empty center. No people."
        )
        
    dossier = (
        f"\n\n========================================================\n"
        f"CURRENT SPECIFICATION (ASSET 2 : ENVIRONMENT BACKGROUND SCENE)\n"
        f"========================================================\n"
        f"Scene Details:\n"
        f"- Environment: {scene_desc} ({rep.background})\n"
        f"- Lighting & Harmony: {rep.lighting} (MUST match the avatar's lighting direction)\n"
        f"- Color Accents: Incorporate colors {', '.join(brand_colors[:2])} into background accents.\n"
        f"SUBJECT INSTRUCTION: Generate ONLY the background environment. No people, no avatars, no faces. "
        f"Keep the center clear and open for portrait compositing."
    )
    return cc_content + dossier


# ──────────────────────────────────────────────────────────────
# PILLOW COMPOSITION ENGINE
# ──────────────────────────────────────────────────────────────

def remove_background_and_composite(avatar_bytes: bytes, background_bytes: bytes) -> bytes:
    """Key out flat white background from the avatar and composite onto background with dropshadows."""
    try:
        avatar = Image.open(io.BytesIO(avatar_bytes)).convert("RGBA")
        background = Image.open(io.BytesIO(background_bytes)).convert("RGBA")
        
        # Chromakey / flat background extraction
        data = np.array(avatar)
        r, g, b, a = data.T
        
        # Pixels very close to white/light gray (thresholding)
        white_mask = (r > 240) & (g > 240) & (b > 240)
        data[..., 3] = np.where(white_mask.T, 0, a.T)
        
        avatar_transparent = Image.fromarray(data)
        
        # Resize and align to Split Layout (left display area)
        bg_w, bg_h = background.size
        av_w, av_h = avatar_transparent.size
        
        scale_factor = (bg_h * 0.85) / av_h
        new_w = int(av_w * scale_factor)
        new_h = int(av_h * scale_factor)
        
        avatar_resized = avatar_transparent.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Left side split offset layout (x pos around 5% of width)
        x_pos = int(bg_w * 0.05)
        y_pos = int((bg_h - new_h) / 2)
        
        # Ambient occlusion / soft drop shadow overlay
        shadow = Image.new("RGBA", avatar_resized.size, (0, 0, 0, 0))
        alpha = avatar_resized.split()[3]
        shadow_mask = alpha.point(lambda p: 255 if p > 0 else 0)
        
        # Draw soft shadow mask
        shadow.paste((0, 0, 0, 80), (0, 0), mask=shadow_mask)
        shadow_blurred = shadow.filter(ImageFilter.GaussianBlur(radius=12))
        
        # Paste shadow and avatar onto background layer
        composite = background.copy()
        composite.alpha_composite(shadow_blurred, (x_pos + 12, y_pos + 12))
        composite.alpha_composite(avatar_resized, (x_pos, y_pos))
        
        output = io.BytesIO()
        composite.convert("RGB").save(output, format="JPEG", quality=95)
        return output.getvalue()
        
    except Exception as exc:
        print(f"PIL Compositing failed: {exc}")
        traceback.print_exc()
        return avatar_bytes # Fallback directly to original if compositing fails


# ──────────────────────────────────────────────────────────────
# API ROUTER & SERVICES
# ──────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    brandData: dict
    personaIndex: int = 0


@app.post("/api/generate-persona-board")
async def generate_persona_board(req: GenerateRequest):
    """Redesigned validation, inference, and multi-asset image compositing endpoint."""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured. Please set it in .env file."
        )
        
    try:
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # 1. Run Validation & Representative Inference Loop
        bi = req.brandData.get("brandIdentity", {})
        personas = req.brandData.get("idealClientProfiles", [])
        if not personas:
            raise HTTPException(status_code=400, detail="No idealClientProfiles found in JSON.")
            
        persona = personas[req.personaIndex] if req.personaIndex < len(personas) else personas[0]
        
        system_instruction = (
            "You are the Lead Brand Strategist, Creative Director, and AI Research Scientist.\n"
            "Analyze the Brand JSON and Persona. Your mission is to Cross-Validate inputs, correct "
            "demographic anomalies, and automatically resolve an optimal Representative photo model.\n"
            "RULES:\n"
            "- Cross-Validate: age profiles and taglines. If age is '88-96' but the lifestyle is sporty/modern, "
            "resolve a realistic visual age (e.g. '28-38') and log this in the validation report.\n"
            "- Target Audience Preservation: Keep raw target audience values unchanged (e.g. if raw gender "
            "is 'All genders', validated gender remains 'All genders'), but infer a specific binary gender "
            "('female' or 'male') for the photo model.\n"
            "- Deduce representative properties: age, gender, ethnicity, skin tone, hair, expression, "
            "pose, camera, lighting, wardrobe matching the brandColors palette, and background scene.\n"
            "- Provide confidence score and detailed logical justification."
        )
        
        validation_prompt = (
            f"Brand Identity:\n{json.dumps(bi, indent=2)}\n\n"
            f"Target Persona:\n{json.dumps(persona, indent=2)}\n\n"
            "Return the validation report and resolved representative mapping."
        )
        
        print("-> Running Validation and Inference Engine...")
        validation_res = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=validation_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=ValidationInferenceResult,
                temperature=0.1,
            )
        )
        
        val_data = json.loads(validation_res.text)
        print("-> Validation & Inference successfully completed.")
        
        # Extract validated elements
        validated_brand = val_data.get("validated_brand", {})
        validated_persona = val_data.get("validated_persona", {})
        rep = val_data.get("representative", {})
        validation_report = val_data.get("validation_report", [])
        confidence_report = val_data.get("confidence_report", {})
        
        # Convert rep dict back to model structure for prompting
        rep_model = InferredRepresentative(**rep)
        brand_colors = validated_brand.get("brandColors") or ["#333333", "#666666"]
        
        # 2. Select scene template from Scene Library
        scene_desc = select_best_scene(validated_brand.get("industry", "fashion"), validated_brand.get("visualStyle", "modern"))
        
        # 3. Compose Prompts
        avatar_prompt = build_avatar_prompt_spec(rep_model, brand_colors)
        background_prompt = build_background_prompt_spec(rep_model, scene_desc, brand_colors)
        
        negative_prompt = (
            "No double exposure, No background bleed, No projected textures, No hallway overlays, "
            "No LED panels, No camera equipment, No tripods, No floating products, No distorted anatomy, "
            "No duplicate limbs, No malformed hands, No ghosting, No surreal textures, No watermark, No text"
        )
        
        heygen_prompt = (
            f"Photorealistic {rep_model.ethnicity} {rep_model.gender} presenter with {rep_model.skinTone}, "
            f"wearing {rep_model.wardrobe}, showing candid visual expression representing {validated_brand.get('brandName')}. "
            f"Camera details: {rep_model.camera}."
        )
        
        # 4. Generate Images (Avatar & Background)
        def generate_image_asset(prompt_text, asset_name):
            print(f"-> Calling Gemini for {asset_name} generation...")
            res = client.models.generate_content(
                model="gemini-3-pro-image",
                contents=prompt_text + f"\nNegative Prompt: {negative_prompt}",
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                )
            )
            if res.candidates and res.candidates[0].content and res.candidates[0].content.parts:
                for part in res.candidates[0].content.parts:
                    if part.inline_data is not None:
                        return part.inline_data.data
            return None
            
        avatar_bytes = None
        background_bytes = None
        
        # Check predefined images in uploaded dossier first to bypass generation if available (for test flows)
        persona_raw = personas[req.personaIndex] if req.personaIndex < len(personas) else {}
        for key in ["api_image", "json-api-image", "json_api_image", "avatar_image", "image", "avatar", "avatarUrl", "imageUrl"]:
            if key in persona_raw:
                val = persona_raw[key]
                if isinstance(val, str) and val.strip():
                    val = val.strip()
                    if val.startswith("data:image"):
                        try:
                            avatar_bytes = base64.b64decode(val.split(",", 1)[1])
                            break
                        except Exception:
                            pass
                    elif val.startswith(("http://", "https://")):
                        try:
                            import httpx
                            r = httpx.get(val, timeout=20.0)
                            if r.status_code == 200:
                                avatar_bytes = r.content
                                break
                        except Exception:
                            pass
                            
        for key in ["background_image", "background", "backgroundUrl", "background_url"]:
            if key in persona_raw:
                val = persona_raw[key]
                if isinstance(val, str) and val.strip():
                    val = val.strip()
                    if val.startswith("data:image"):
                        try:
                            background_bytes = base64.b64decode(val.split(",", 1)[1])
                            break
                        except Exception:
                            pass
                    elif val.startswith(("http://", "https://")):
                        try:
                            import httpx
                            r = httpx.get(val, timeout=20.0)
                            if r.status_code == 200:
                                background_bytes = r.content
                                break
                        except Exception:
                            pass

        # Call Gemini Image models concurrently if not predefined
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            avatar_future = None
            background_future = None
            
            if not avatar_bytes:
                avatar_future = executor.submit(generate_image_asset, avatar_prompt, "Avatar")
            if not background_bytes:
                background_future = executor.submit(generate_image_asset, background_prompt, "Background")
                
            if avatar_future:
                try:
                    avatar_bytes = avatar_future.result()
                except Exception as exc:
                    print(f"Avatar generation task failed: {exc}")
            if background_future:
                try:
                    background_bytes = background_future.result()
                except Exception as exc:
                    print(f"Background generation task failed: {exc}")
                    
        if not avatar_bytes:
            raise HTTPException(status_code=500, detail="Gemini failed to generate visual avatar asset.")
            
        if not background_bytes:
            # Fallback placeholder background (plain gray)
            bg_img = Image.new("RGBA", (1080, 1350), (245, 245, 245, 255))
            bg_bytes = io.BytesIO()
            bg_img.save(bg_bytes, format="PNG")
            background_bytes = bg_bytes.getvalue()
            
        # 5. Composite Layers using PIL
        composite_bytes = remove_background_and_composite(avatar_bytes, background_bytes)
        
        # 6. Save strategic outputs & validation logs to history archive (Acceptance Criteria)
        entry_id = uuid.uuid4().hex[:12]
        
        (GENERATED_DIR / f"{entry_id}_validated_brand.json").write_text(json.dumps(validated_brand, indent=2))
        (GENERATED_DIR / f"{entry_id}_validated_persona.json").write_text(json.dumps(validated_persona, indent=2))
        (GENERATED_DIR / f"{entry_id}_representative.json").write_text(json.dumps(rep, indent=2))
        (GENERATED_DIR / f"{entry_id}_validation_report.json").write_text(json.dumps(validation_report, indent=2))
        (GENERATED_DIR / f"{entry_id}_confidence_report.json").write_text(json.dumps(confidence_report, indent=2))
        
        (GENERATED_DIR / f"{entry_id}_avatar_prompt.txt").write_text(avatar_prompt)
        (GENERATED_DIR / f"{entry_id}_background_prompt.txt").write_text(background_prompt)
        (GENERATED_DIR / f"{entry_id}_negative_prompt.txt").write_text(negative_prompt)
        (GENERATED_DIR / f"{entry_id}_heygen_prompt.txt").write_text(heygen_prompt)
        
        (GENERATED_DIR / f"{entry_id}_avatar.png").write_bytes(avatar_bytes)
        (GENERATED_DIR / f"{entry_id}_background.png").write_bytes(background_bytes)
        (GENERATED_DIR / f"{entry_id}_composite.png").write_bytes(composite_bytes)
        
        # Map validation report and creative brief for frontend compatibility
        frontend_validation_report = []
        for item in validation_report:
            status_val = "corrected" if item.get("raw_value") != item.get("validated_value") else "validated"
            frontend_validation_report.append({
                "field": item.get("field"),
                "status": status_val,
                "raw": item.get("raw_value"),
                "validated": item.get("validated_value"),
                "reason": item.get("reasoning"),
                "confidence": confidence_report.get("score", 90),
            })
            
        # Add entry for Representative Selection if inferred
        frontend_validation_report.append({
            "field": "Representative Selection",
            "status": "resolved",
            "raw": persona.get("gender", "All genders"),
            "validated": rep.get("gender"),
            "reason": confidence_report.get("reasoning"),
            "representative": f"{rep.get('ethnicity')} {rep.get('gender')}, age {rep.get('age')}",
            "confidence": confidence_report.get("score", 90)
        })

        creative_brief_mapped = {
            "climate_wardrobe_direction": rep.get("wardrobe"),
            "background_style": rep.get("background"),
            "lighting_style": rep.get("lighting"),
            "avatar_prompt": avatar_prompt,
            "background_prompt": background_prompt,
            "negative_prompt": negative_prompt,
            "heygen_prompt": heygen_prompt
        }

        # Complete history metadata record
        meta = {
            "id": entry_id,
            "brandName": validated_brand.get("brandName", "Unknown"),
            "industry": validated_brand.get("industry", ""),
            "personaName": validated_persona.get("name", "Persona"),
            "age": str(validated_persona.get("age", "")),
            "gender": validated_persona.get("gender", ""),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "validated_brand": validated_brand,
            "validated_persona": validated_persona,
            "representative": rep,
            "validation_report": validation_report,
            "validationReport": frontend_validation_report,
            "confidence_report": confidence_report,
            "hasBackground": True,
            "avatar_prompt": avatar_prompt,
            "background_prompt": background_prompt,
            "negative_prompt": negative_prompt,
            "heygen_prompt": heygen_prompt,
            "creativeBrief": creative_brief_mapped,
            "avatarFileName": f"{entry_id}_avatar.png",
            "backgroundFileName": f"{entry_id}_background.png",
            "compositeFileName": f"{entry_id}_composite.png"
        }
        (GENERATED_DIR / f"{entry_id}.json").write_text(json.dumps(meta, indent=2))
        
        avatar_b64 = base64.b64encode(avatar_bytes).decode("utf-8")
        background_b64 = base64.b64encode(background_bytes).decode("utf-8")
        composite_b64 = base64.b64encode(composite_bytes).decode("utf-8")
        
        return {
            "avatar": avatar_b64,
            "background": background_b64,
            "final_composite": composite_b64,
            "historyId": entry_id,
            "validated_brand": validated_brand,
            "validated_persona": validated_persona,
            "representative": rep,
            "validation_report": validation_report,
            "validationReport": frontend_validation_report,
            "confidence_report": confidence_report,
            "avatar_prompt": avatar_prompt,
            "background_prompt": background_prompt,
            "negative_prompt": negative_prompt,
            "heygen_prompt": heygen_prompt,
            "creativeBrief": creative_brief_mapped
        }
        
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Generation pipeline failed: {str(exc)}")


# ──────────────────────────────────────────────────────────────
# HISTORY ENDPOINTS
# ──────────────────────────────────────────────────────────────

@app.get("/api/history")
async def list_history():
    """Return all previously generated persona boards, newest first."""
    items = []
    for meta_file in GENERATED_DIR.glob("*.json"):
        if meta_file.name.endswith(("_validated_brand.json", "_validated_persona.json", "_representative.json", "_validation_report.json", "_confidence_report.json")):
            continue
        try:
            meta = json.loads(meta_file.read_text())
            items.append(meta)
        except Exception:
            continue
    items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return {"items": items}


@app.get("/api/history/{entry_id}/image")
async def get_history_image(entry_id: str, type: str = "board"):
    """Serve individual generated or composited assets."""
    # Map legacy board requested by UI to composite.png
    suffix = "_composite.png" if type in ("board", "composite") else f"_{type}.png"
    img_path = GENERATED_DIR / f"{entry_id}{suffix}"
    
    if img_path.exists():
        return FileResponse(img_path, media_type="image/png", filename=img_path.name)
        
    # Check older/fallback formats
    fallback_path = GENERATED_DIR / f"{entry_id}_avatar.png"
    if fallback_path.exists():
        return FileResponse(fallback_path, media_type="image/png", filename=fallback_path.name)
        
    raise HTTPException(status_code=404, detail="Requested asset image not found.")


@app.delete("/api/history/{entry_id}")
async def delete_history_entry(entry_id: str):
    """Delete all database logs and image assets associated with an entry."""
    meta_path = GENERATED_DIR / f"{entry_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Entry not found")
        
    # Remove files flatly matching the entry ID prefix
    for item in GENERATED_DIR.glob(f"{entry_id}*"):
        try:
            item.unlink()
        except Exception:
            pass
            
    return {"status": "deleted", "id": entry_id}


@app.get("/api/health")
async def health_check():
    """Health check status endpoint."""
    return {
        "status": "ok",
        "api_key_configured": bool(GEMINI_API_KEY),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
