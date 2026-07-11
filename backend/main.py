"""
ADNOVA Customer Persona Board Generator — FastAPI Backend

Takes brand JSON data → builds mega-prompt from cc.txt template → 
calls Gemini 2.0 Flash image generation → returns premium persona board image.
"""

import os
import base64
import json
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Load env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = FastAPI(title="ADNOVA Persona Board Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in .env file")

# Directory to persist generated persona boards
GENERATED_DIR = Path(__file__).parent / "generated"
GENERATED_DIR.mkdir(exist_ok=True)


# ──────────────────────────────────────────────────────────────
PROMPT_TEMPLATE = """MASTER PROMPT — ENTERPRISE CUSTOMER PERSONA BOARD GENERATION

ROLE & MISSION
You are a world-class Creative Director, Brand Strategist, UI/UX Designer, Editorial Designer, Commercial Photographer, Fashion Art Director, and Infographic Specialist.
Transform the structured brand research below into a premium visual customer persona board suitable for Fortune 500 marketing teams.
The final output must look like a professionally designed Adobe Illustrator / Figma / Behance presentation. Never make the output resemble generic AI-generated artwork.

========================================================
INPUT DATA
========================================================
Brand Name: {brand_name}
Industry: {industry}
Brand Positioning: {brand_positioning}
Primary Product: {primary_product}
Secondary Products: {secondary_products}
Value Proposition: {value_proposition}
Offer Summary: {offer_summary}
Communication Style: {communication_style}
Tone: {tone}
Voice: {voice}
CTA: {cta}
Brand Colors: {brand_colors}
Fonts: {fonts}
Visual Style: {visual_style}
Country: {country}
Markets: {markets}

========================================================
TARGET CUSTOMER
========================================================
Persona Name: {persona_name}
Avatar Label: {avatar_label}
Summary: {summary}
Age: {age}
Gender: {gender}
Income Level: {income}
Pain Points: {pain_points}
Psychographics: {psychographics}
Buying Motivations: {buying_motivations}
Preferred Platforms: {platforms}
Product Fit: {product_fit}
Ad Angles: {recommended_ad_angles}
Voice Style: {recommended_voice_style}
Music Style: {recommended_music_style}

========================================================
CREATIVE INTELLIGENCE
========================================================
Creative Pattern Summary: {creative_summary}
Hook Styles: {hook_styles}
Ad Directions: {recommended_directions}

========================================================
GLOBAL MARKET & CULTURAL AUTHENTICITY ENGINE
========================================================
Analyze the primary target country ({country}) and target markets ({markets}). Every generated customer avatar must authentically represent the target market, regional context, and cultural nuances described in the research:
- REGIONAL AUTHENTICITY: Match local fashion, climate-appropriate clothing, typical lifestyle, regional architecture, work environments, recreation, and shopping habits.
- DIVERSE HUMAN REPRESENTATION: Represent people who are highly plausible for the target audience. Facial features, hair characteristics, skin tones, and clothing must be guided by the audience and setting, avoiding stereotypes or assuming a single appearance for a country.
- CLIMATE ADAPTATION: Adapt wardrobe and environment to the target market's climate (e.g., layers/coats for cold regions, breathable/lightweight fabrics for hot climates, tropical vegetation, desert natural light, etc.).
- LOCAL ENVIRONMENT: Ensure backgrounds reflect realistic surroundings (cafes, offices, homes, city parks, streetscapes) that match the region rather than generic stock backgrounds.
- FASHION & LIFESTYLE: Clothing must fit the climate, culture, industry, age group, and brand personality. Show everyday activities naturally (commuting, working, relaxing, family).
- PRODUCT CONTEXT: If products are displayed, show them integrated naturally into daily life, not staged.

========================================================
COMPOSITION & LAYOUT
========================================================
Canvas: 1080 x 1350 (Portrait orientation).
Do NOT redesign the layout from scratch. Keep the existing dashboard layout, but elevate its alignment, spacing, padding, and visual rhythm.
- SPLIT LAYOUT: Left side (45% width) displays a large, highly realistic customer portrait. Right side (55% width) displays perfectly aligned information cards.
- GRID & MARGINS: Maintain equal spacing between all sections. Perfect the grid system with large margins and generous whitespace/breathing room.
- VISUAL BALANCE & HIERARCHY: Guide the eye logically: Portrait -> Persona -> Demographics -> Psychographics -> Pain Points -> Motivations -> Platforms -> Quote -> Footer.

========================================================
PORTRAIT & REALISM
========================================================
Generate one highly realistic customer. Keep the person representing the persona naturally (not a fashion model or generic stock photo pose).
- REALISM: Natural skin pores, visible skin texture, realistic wrinkles, expressive eyes, and individual hair strands.
- EXPRESSIONS: Candid expressions, natural friendly smiles, authentic body language, and relaxed posture.
- AVOID: No beauty filters, no over-smoothed plastic skin, no CGI or gaming engine appearance, no artificial symmetry, and no duplicate/malformed limbs.
- CAMERA & LIGHTING: Commercial advertising photography style. Capture with warm natural daylight, soft ambient shadows, and shallow depth of field (e.g., Canon EOS R5, 85mm lens).

========================================================
PRODUCT CATEGORY REPRESENTATION
========================================================
Always match the brand's primary category:
- FOOTWEAR: Shoes should be slightly visible and realistic.
- COSMETICS: Subtle makeup products should naturally appear.
- TECHNOLOGY: A laptop or digital device should naturally appear in the scene.
- HEALTHCARE: A bright clinical or wellness environment.
- FINANCE / ENTERPRISE: A modern, sleek workspace or boardroom.

========================================================
INFORMATION CARDS
========================================================
Generate premium, rounded cards with a clean modern dashboard aesthetic.
- PADDING & BALANCE: Perfect padding and consistent spacing inside and between cards. Equal card heights where possible.
- VISUAL STYLE: Subtle glassmorphism and soft ambient shadows. Use elegant dividers and balanced negative space.
- MONOCHROME ICONS: Include modern, clean outline icons with consistent stroke widths. No emojis, no cartoon icons.

========================================================
TYPOGRAPHY & TEXT ACCURACY (CRITICAL)
========================================================
Use premium editorial typography similar to Apple, Stripe, Linear, Notion, Airbnb, and Framer.
- TEXT ACCURACY: Every word must be spelled correctly. Avoid fake English, gibberish text, overlapping text, or distorted letters. Text must be perfectly crisp and legible.
- CARD HEADINGS: Card headings must exactly match these labels:
  - DEMOGRAPHICS
  - PSYCHOGRAPHICS
  - PAIN POINTS
  - BUYING MOTIVATIONS
  - BRAND VOICE
  - PREFERRED PLATFORMS
  - LIFESTYLE SNAPSHOT
  - VALUES
  - QUOTE
  - PRODUCT FIT
  - RECOMMENDED AD ANGLES
- Each card must contain ONLY the relevant data from the corresponding section.

========================================================
COLOR SYSTEM
========================================================
Strictly use the brand colors supplied:
- Primary Brand Color: {primary_brand_color}
- Secondary Brand Color: {secondary_brand_color}
- Background: Soft white / neutral light gray.
- Cards: Light gray/white with subtle gradients if appropriate.
- Accent: Primary/Secondary brand color.
- Icons: Muted gray/accent brand color.
- Text: Dark charcoal for maximum readability.
- Maintain premium color harmony; avoid oversaturation.

========================================================
QUALITY & OUTPUT STANDARDS
========================================================
- ULTRA REALISTIC: 8K resolution, photorealistic commercial advertising quality.
- PERFECT ANATOMY: Perfect hands, fingers, eyes, face, and body proportions.
- NO ARTIFACTS: No blur, no watermarks, no logo distortions, and no AI generation anomalies.
- FINAL IMPRESSION: Experienced creative directors and UI/UX designers should believe this was manually designed in Figma, Illustrator, and Photoshop.

========================================================
FINAL GOAL
========================================================
Create an award-winning premium customer persona board that visually communicates the target customer, brand identity, buying motivations, psychology, and lifestyle in a single elegant presentation. Every element must feel intentional, balanced, and professionally art-directed.
"""


# ──────────────────────────────────────────────────────────────
# CREATIVE DIRECTOR PROMPT
# ──────────────────────────────────────────────────────────────

CREATIVE_DIRECTOR_PROMPT = """========================================================
ENTERPRISE CREATIVE DIRECTOR ENGINE
========================================================

ROLE

You are the Creative Director of a world-class branding agency.

Your responsibility is NOT to generate the final image.

Your responsibility is to create a unique creative direction for every brand before image generation.

Never reuse the same design language twice.

Every generated persona board should feel like it belongs to a different Fortune 500 company.

Think like the creative directors behind Apple, Nike, Airbnb, Stripe, Adobe, Google, Gymshark, Glossier, Patagonia, Lululemon and Notion.

========================================================
CREATIVE PHILOSOPHY
========================================================

Never generate template-based designs.

Never repeat:

• layout
• composition
• photography
• environment
• card arrangement
• portrait framing
• lighting
• color treatment
• icon placement
• visual rhythm

Each generation must feel custom designed.

========================================================
BRAND ANALYSIS
========================================================

Before making any design decision, analyze:

Industry

Products

Target audience

Brand personality

Brand tone

Communication style

Geography

Lifestyle

Customer motivations

Visual identity

Use these insights to determine the creative direction.

Never ignore the supplied research.

========================================================
INDUSTRY CREATIVE MAPPING
========================================================

ACTIVEWEAR

Design inspiration:

Nike

Gymshark

Lululemon

Alo Yoga

Pangaia

Photography:

Athletic lifestyle

Outdoor fitness

Morning workout

Running

Stretching

Modern gym

Environment:

Dubai Marina

Running track

Luxury gym

Outdoor training

Minimal apartment

Yoga studio

Clothing:

Performance apparel

Sports watch

Running shoes

Gym accessories

--------------------------------------------------------

FOOTWEAR

Design inspiration:

Allbirds

Nike

Adidas

On Running

Patagonia

Photography:

Walking

Coffee shop

Urban exploration

Nature

Minimal apartment

Environment:

Modern city

Park

Scandinavian home

Natural materials

--------------------------------------------------------

COSMETICS

Design inspiration:

Glossier

Rare Beauty

Sephora

Charlotte Tilbury

Dior Beauty

Photography:

Beauty editorial

Mirror

Vanity

Luxury skincare

Environment:

Beauty studio

Luxury bathroom

Minimal vanity

Soft pink lighting

--------------------------------------------------------

TECHNOLOGY

Design inspiration:

Apple

Stripe

Linear

Notion

Arc

Photography:

Modern workspace

Creative office

Startup

Glass architecture

Environment:

Minimal office

Developer workspace

Premium desk

--------------------------------------------------------

FINANCE

Design inspiration:

Bloomberg

McKinsey

Deloitte

Goldman Sachs

Photography:

Executive

Business

Professional

Environment:

Boardroom

Office

Financial district

--------------------------------------------------------

HEALTHCARE

Design inspiration:

Mayo Clinic

Cleveland Clinic

Johns Hopkins

Photography:

Professional

Trustworthy

Human

Environment:

Clinic

Hospital

Wellness

========================================================
DESIGN DNA
========================================================

Generate a unique Design DNA for every project.

Example combinations:

Minimal Scandinavian

Luxury Editorial

Swiss Design

Apple Human Interface

Modern Dashboard

Pinterest Editorial

Magazine Layout

Enterprise SaaS

Glassmorphism

Luxury White Space

Do not reuse the same combination repeatedly.

========================================================
CREATIVE SEED
========================================================

Generate a unique creative seed consisting of:

Layout Concept

Photography Style

Camera Lens

Camera Angle

Lighting Style

Color Mood

Background Style

Environment

Portrait Style

Pose

Card Style

Shadow Style

Typography Mood

Editorial Style

Visual Story

Brand Inspiration

The seed must be different for every generation while remaining appropriate for the supplied brand.

========================================================
CONTROLLED RANDOMIZATION
========================================================

Use controlled diversity.

Never choose random styles that conflict with the industry.

Example:

Footwear should never receive beauty photography.

Healthcare should never receive nightclub lighting.

Finance should never receive fitness layouts.

Technology should never receive cosmetics styling.

Randomization must always remain brand-aware.

========================================================
GENERATION MEMORY
========================================================

Assume previous persona boards already exist.

Avoid repeating:

Same layout

Same portrait crop

Same furniture

Same environment

Same camera

Same lighting

Same pose

Same card arrangement

Same photography

Generate a noticeably different visual experience.

========================================================
VISUAL STORYTELLING
========================================================

Every persona board should communicate a story.

The viewer should immediately understand:

Who this customer is

How they live

Why they buy

What the brand represents

Without reading every card.

========================================================
QUALITY CONTROL
========================================================

Before passing the creative direction to the image generator verify:

✓ Industry matches photography

✓ Environment matches brand

✓ Clothing matches products

✓ Layout is unique

✓ Pose is different from previous generations

✓ Lighting is appropriate

✓ Colors reflect brand identity

✓ Visual storytelling is clear

✓ Design DNA is unique

✓ Creative seed is unique

If any section feels repetitive or generic, redesign the creative direction before generating the final image.

========================================================
FINAL OBJECTIVE
========================================================

Every generated persona board should feel like it was custom designed by a different award-winning creative director.

No two brands should ever look like they came from the same template.

Each board should have its own unique photography, layout, storytelling, atmosphere, and visual identity while remaining completely faithful to the supplied structured research."""


# ──────────────────────────────────────────────────────────────
# DATA EXTRACTION HELPERS
# ──────────────────────────────────────────────────────────────

def safe_join(items, separator=", "):
    """Safely join a list of items into a string."""
    if not items:
        return ""
    if isinstance(items, str):
        return items
    return separator.join(str(i) for i in items)


def safe_bullet(items):
    """Convert a list to bullet-point format."""
    if not items:
        return "None specified"
    if isinstance(items, str):
        return f"• {items}"
    return "\n".join(f"• {item}" for item in items)


def extract_brand_fields(data: dict) -> dict:
    """Extract all brand identity template variables from the JSON."""
    bi = data.get("brandIdentity", {})
    geo = bi.get("geography", {})

    return {
        "brand_name": bi.get("brandName", "Unknown Brand"),
        "industry": bi.get("industry", "General"),
        "brand_positioning": bi.get("brandPositioningSummary", "Premium brand"),
        "primary_product": bi.get("productInfo", {}).get("primary", bi.get("productCategories", {}).get("primary", "")),
        "secondary_products": safe_join(bi.get("productInfo", {}).get("secondary", bi.get("productCategories", {}).get("secondary", []))) or "None",
        "value_proposition": bi.get("valueProposition", ""),
        "offer_summary": bi.get("offerSummary", ""),
        "communication_style": bi.get("communicationStyle", "Professional"),
        "tone": bi.get("tone", "Professional"),
        "voice": bi.get("voice", ""),
        "cta": bi.get("ctaPreference", "Learn More"),
        "brand_colors": safe_join(bi.get("brandColors", [])),
        "fonts": safe_join(bi.get("fonts", [])) or "Modern sans-serif",
        "visual_style": bi.get("visualStyle", "Modern and clean"),
        "country": geo.get("country", "Global"),
        "markets": safe_join(geo.get("primaryMarkets", [])),
    }


def extract_persona_fields(persona: dict) -> dict:
    """Extract persona-specific template variables."""
    return {
        "persona_name": persona.get("name", "Ideal Customer"),
        "avatar_label": persona.get("avatarLabel", "Primary"),
        "summary": persona.get("summary", ""),
        "age": str(persona.get("age", "25-45")),
        "gender": persona.get("gender", "All genders"),
        "income": persona.get("incomeLevel", "Middle"),
        "pain_points": safe_bullet(persona.get("painPoints", [])),
        "psychographics": safe_bullet(persona.get("psychographics", [])),
        "buying_motivations": safe_bullet(persona.get("buyingMotivations", [])),
        "platforms": safe_join(persona.get("platformPreference", persona.get("preferredChannels", []))),
        "product_fit": persona.get("productFit", ""),
        "recommended_ad_angles": safe_bullet(persona.get("recommendedAdAngles", [])),
        "recommended_voice_style": persona.get("recommendedVoiceStyle", "Professional and engaging"),
        "recommended_music_style": persona.get("recommendedMusicStyle", "Modern ambient"),
    }


def extract_creative_fields(data: dict) -> dict:
    """Extract creative intelligence template variables."""
    cr = data.get("competitorResearch", {}).get("creativeIntelligence", {})
    return {
        "creative_summary": cr.get("creativeIntelligenceSummary", cr.get("patternSummary", "")),
        "hook_styles": safe_bullet(cr.get("hookStyles", [])),
        "recommended_directions": safe_bullet(cr.get("recommendedAdDirections", [])),
    }


def extract_brand_colors_for_prompt(data: dict) -> dict:
    """Extract primary and secondary brand colors for the color system section."""
    colors = data.get("brandIdentity", {}).get("brandColors", [])
    primary = "#333333"
    secondary = "#666666"

    # Find the first two distinct non-white, non-transparent hex colors
    for c in colors:
        c_lower = c.strip().lower()
        # Skip white and very light colors
        if c_lower in ("#ffffff", "#fff", "rgba(255,255,255,0.95)", "white"):
            continue
        # Skip transparent
        if "transparent" in c_lower:
            continue
        # Extract hex from the color
        if c_lower.startswith("#") and len(c_lower) >= 4:
            if primary == "#333333":
                primary = c.strip()
            elif secondary == "#666666":
                secondary = c.strip()
                break
        elif c_lower.startswith("rgb"):
            # Try to convert rgb to hex
            import re
            nums = re.findall(r'\d+', c)
            if len(nums) >= 3:
                r, g, b = int(nums[0]), int(nums[1]), int(nums[2])
                # Skip very light/near-white
                if r > 240 and g > 240 and b > 240:
                    continue
                hex_color = f"#{r:02x}{g:02x}{b:02x}"
                if primary == "#333333":
                    primary = hex_color
                elif secondary == "#666666":
                    secondary = hex_color
                    break

    return {
        "primary_brand_color": primary,
        "secondary_brand_color": secondary,
    }


def build_avatar_prompt(data: dict, creative_brief: dict, persona_index: int = 0) -> str:
    """Build the prompt for the customer avatar generator using cc.txt rules."""
    brand = extract_brand_fields(data)
    personas = data.get("idealClientProfiles", [])

    if not personas:
        raise ValueError("No ideal client profiles found in the JSON data")

    if persona_index >= len(personas):
        persona_index = 0

    persona = extract_persona_fields(personas[persona_index])
    creative = extract_creative_fields(data)
    colors = extract_brand_colors_for_prompt(data)

    # Load enhancement.txt
    enhancement_path = Path(__file__).parent.parent / "enhancement.txt"
    enhancement_content = ""
    if enhancement_path.exists():
        try:
            enhancement_content = enhancement_path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"Error reading enhancement.txt: {e}")
    
    if not enhancement_content:
        enhancement_content = "ENTERPRISE AVATAR ASSET EXTRACTION ENGINE\nROLE: Generate customer avatar."

    # Strip top diagram if present
    if "ENTERPRISE AVATAR ASSET EXTRACTION ENGINE" in enhancement_content:
        enhancement_content = enhancement_content[enhancement_content.index("ENTERPRISE AVATAR ASSET EXTRACTION ENGINE"):]

    # Extract brief details or default
    pose = creative_brief.get("pose", "Standing naturally")
    clothing = creative_brief.get("climate_wardrobe_direction", f"Aesthetic clothing matching {brand['industry']}")
    cultural = creative_brief.get("local_cultural_context", f"Believable representation for {brand['country']}")
    lighting = creative_brief.get("lighting_style", "Warm natural daylight")
    color_mood = creative_brief.get("color_mood", "Balanced natural tones")

    dossier = (
        f"\n\n========================================================\n"
        f"CURRENT GENERATION SPECIFICATION (ASSET 1 : CUSTOMER AVATAR)\n"
        f"========================================================\n"
        f"YOUR TASK: Generate ONLY the customer avatar. No background. Person only.\n\n"
        f"Brand Identity:\n"
        f"- Name: {brand['brand_name']}\n"
        f"- Industry: {brand['industry']}\n"
        f"- Primary Product: {brand['primary_product']}\n"
        f"- Target Country: {brand['country']}\n"
        f"- Primary Markets: {brand['markets']}\n"
        f"- Brand Accent Colors: {colors['primary_brand_color']}, {colors['secondary_brand_color']}\n"
        f"- Visual Style: {brand['visual_style']}\n\n"
        f"Target Persona:\n"
        f"- Name: {persona['persona_name']}\n"
        f"- Age: {persona['age']}\n"
        f"- Gender: {persona['gender']}\n"
        f"- Income level: {persona['income']}\n"
        f"- Summary: {persona['summary']}\n"
        f"- Psychographics: {persona['psychographics']}\n"
        f"- Buying Motivations: {persona['buying_motivations']}\n"
        f"- Pain Points: {persona['pain_points']}\n\n"
        f"Creative Director Visual Directives for Avatar:\n"
        f"- Pose: {pose}\n"
        f"- Clothing/Wardrobe: {clothing}\n"
        f"- Local/Cultural Appearance: {cultural}\n"
        f"- Expression: Friendly, professional, and authentic\n"
        f"- Lighting Direction: {lighting}\n"
        f"- Color Grading & Accents: {color_mood} (apply brand colors {colors['primary_brand_color']} and {colors['secondary_brand_color']} to clothing/accessories)\n"
    )
    return enhancement_content + dossier


def build_background_prompt(data: dict, creative_brief: dict, persona_index: int = 0) -> str:
    """Build the prompt for the background environment generator using cc.txt rules."""
    brand = extract_brand_fields(data)
    personas = data.get("idealClientProfiles", [])

    if not personas:
        raise ValueError("No ideal client profiles found in the JSON data")

    if persona_index >= len(personas):
        persona_index = 0

    persona = extract_persona_fields(personas[persona_index])
    colors = extract_brand_colors_for_prompt(data)

    # Load cc.txt
    cc_path = Path(__file__).parent.parent / "cc.txt"
    cc_content = ""
    if cc_path.exists():
        try:
            cc_content = cc_path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"Error reading cc.txt: {e}")
    
    if not cc_content:
        cc_content = "ENTERPRISE ASSET GENERATION ENGINE\nROLE: Generate background environment."

    # Strip top diagram if present
    if "ENTERPRISE ASSET GENERATION ENGINE" in cc_content:
        cc_content = cc_content[cc_content.index("ENTERPRISE ASSET GENERATION ENGINE"):]

    # Extract brief details or default
    environment = creative_brief.get("environment", f"Stylish clean scene for {brand['industry']}")
    bg_style = creative_brief.get("background_style", "Aesthetic minimal setting")
    lighting = creative_brief.get("lighting_style", "Warm natural daylight")
    color_mood = creative_brief.get("color_mood", "Balanced natural tones")
    cultural = creative_brief.get("local_cultural_context", f"Authentic setting in {brand['country']}")

    dossier = (
        f"\n\n========================================================\n"
        f"CURRENT GENERATION SPECIFICATION (ASSET 2 : BACKGROUND ENVIRONMENT)\n"
        f"========================================================\n"
        f"YOUR TASK: Generate ONLY the environment background. No people, no face, no avatar.\n\n"
        f"Brand Identity:\n"
        f"- Name: {brand['brand_name']}\n"
        f"- Industry: {brand['industry']}\n"
        f"- Target Country: {brand['country']}\n"
        f"- Primary Markets: {brand['markets']}\n"
        f"- Brand Accent Colors: {colors['primary_brand_color']}, {colors['secondary_brand_color']}\n"
        f"- Visual Style: {brand['visual_style']}\n\n"
        f"Persona Environment Context (The person who belongs here):\n"
        f"- Name: {persona['persona_name']}\n"
        f"- Age: {persona['age']}\n"
        f"- Gender: {persona['gender']}\n"
        f"- Lifestyle summary: {persona['summary']}\n\n"
        f"Creative Director Visual Directives for Background:\n"
        f"- Environment/Setting: {environment}\n"
        f"- Background Style: {bg_style}\n"
        f"- Architecture/Location details: {cultural} matching {brand['country']}\n"
        f"- Lighting & Shadow Direction: {lighting} (MUST match the avatar's lighting direction)\n"
        f"- Color Grading & Accents: {color_mood} (apply brand colors {colors['primary_brand_color']} and {colors['secondary_brand_color']} into furniture, accents, lighting highlights, and materials)\n"
    )
    return cc_content + dossier


# ──────────────────────────────────────────────────────────────
# API ENDPOINTS
# ──────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    brandData: dict
    personaIndex: int = 0


@app.post("/api/generate-persona-board")
async def generate_persona_board(req: GenerateRequest):
    """Generate modular customer persona assets using Gemini."""
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured. Please set it in .env file.")

    try:
        from google import genai
        from google.genai import types
        import concurrent.futures
        import json

        client = genai.Client(api_key=GEMINI_API_KEY)

        # STAGE 1: CREATIVE DIRECTOR (Text LLM)
        brand_info = extract_brand_fields(req.brandData)
        personas = req.brandData.get("idealClientProfiles", [])
        persona_info = {}
        if personas and req.personaIndex < len(personas):
            persona_info = extract_persona_fields(personas[req.personaIndex])

        creative_director_input = (
            f"{CREATIVE_DIRECTOR_PROMPT}\n\n"
            f"========================================================\n"
            f"BRAND & TARGET CUSTOMER DOSSIER\n"
            f"========================================================\n"
            f"Brand Name: {brand_info['brand_name']}\n"
            f"Brand Industry: {brand_info['industry']}\n"
            f"Primary Product: {brand_info['primary_product']}\n"
            f"Secondary Products: {brand_info['secondary_products']}\n"
            f"Brand Positioning: {brand_info['brand_positioning']}\n"
            f"Target Geography: {brand_info['country']}\n"
            f"Target Markets: {brand_info['markets']}\n"
            f"Visual Style Preference: {brand_info['visual_style']}\n\n"
            f"Persona Name: {persona_info.get('persona_name', 'Unknown')}\n"
            f"Persona Age: {persona_info.get('age', 'Unknown')}\n"
            f"Persona Gender: {persona_info.get('gender', 'Unknown')}\n"
            f"Persona Summary: {persona_info.get('summary', '')}\n"
            f"Persona Pain Points: {persona_info.get('pain_points', '')}\n"
            f"Persona Buying Motivations: {persona_info.get('buying_motivations', '')}\n\n"
            f"OUTPUT A JSON OBJECT with the following keys exactly:\n"
            f"- layout\n"
            f"- photography_style\n"
            f"- camera_lens\n"
            f"- camera_angle\n"
            f"- lighting_style\n"
            f"- color_mood\n"
            f"- background_style\n"
            f"- environment\n"
            f"- portrait_style\n"
            f"- pose\n"
            f"- card_style\n"
            f"- shadow_style\n"
            f"- typography_mood\n"
            f"- editorial_style\n"
            f"- visual_story\n"
            f"- brand_inspiration\n"
            f"- local_cultural_context\n"
            f"- climate_wardrobe_direction\n"
            f"Ensure values are highly descriptive phrases (e.g., 'Luxury vanity with soft pink lighting' for environment)."
        )

        print("-> Calling Creative Director (Stage 1)...")
        cd_response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=creative_director_input,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
            )
        )
        
        try:
            creative_brief = json.loads(cd_response.text)
            print("-> Creative Brief Generated:", list(creative_brief.keys()))
        except Exception as e:
            print("-> Failed to parse Creative Brief:", e)
            creative_brief = {}

        # STAGE 2: MULTI-ASSET GENERATION
        # Build individual prompts
        avatar_prompt = build_avatar_prompt(req.brandData, creative_brief, req.personaIndex)
        background_prompt = build_background_prompt(req.brandData, creative_brief, req.personaIndex)

        print(f"\n{'='*60}")
        print(f"Generating modular assets for persona index: {req.personaIndex}")
        print(f"Avatar prompt length: {len(avatar_prompt)} characters")
        print(f"Background prompt length: {len(background_prompt)} characters")
        print(f"{'='*60}\n")

        # Worker function for parallel image generation
        def generate_asset_image(prompt_text, asset_name):
            print(f"-> Call Gemini for {asset_name} image...")
            res = client.models.generate_content(
                model="gemini-3-pro-image",
                contents=prompt_text,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                )
            )
            # Find and return image bytes
            if res.candidates and res.candidates[0].content and res.candidates[0].content.parts:
                for part in res.candidates[0].content.parts:
                    if part.inline_data is not None:
                        return part.inline_data.data
            return None

        avatar_bytes = None
        background_bytes = None

        persona_raw = personas[req.personaIndex] if personas and req.personaIndex < len(personas) else {}

        # 1. Try to load predefined avatar from JSON
        for img_key in ["api_image", "json-api-image", "json_api_image", "avatar_image", "image", "avatar", "avatarUrl", "imageUrl"]:
            if img_key in persona_raw:
                val = persona_raw[img_key]
                if isinstance(val, str) and val.strip():
                    val = val.strip()
                    if val.startswith("data:image"):
                        try:
                            header, encoded = val.split(",", 1)
                            import base64
                            avatar_bytes = base64.b64decode(encoded)
                            print(f"-> Loaded avatar image from base64 data URL in key '{img_key}'")
                            break
                        except Exception as e:
                            print(f"Failed to decode base64 avatar: {e}")
                    elif val.startswith(("http://", "https://")):
                        try:
                            import httpx
                            print(f"-> Fetching avatar image from URL in key '{img_key}': {val}")
                            r = httpx.get(val, timeout=30.0)
                            if r.status_code == 200:
                                avatar_bytes = r.content
                                break
                        except Exception as e:
                            print(f"Failed to fetch avatar from URL: {e}")
                    else:
                        try:
                            import os
                            if os.path.exists(val):
                                avatar_bytes = Path(val).read_bytes()
                                print(f"-> Loaded avatar image from local path in key '{img_key}': {val}")
                                break
                        except Exception as e:
                            print(f"Failed to read local avatar file: {e}")

        # 2. Try to load predefined background from JSON
        for bg_key in ["background_image", "background", "backgroundUrl", "background_url"]:
            if bg_key in persona_raw:
                val = persona_raw[bg_key]
                if isinstance(val, str) and val.strip():
                    val = val.strip()
                    if val.startswith("data:image"):
                        try:
                            header, encoded = val.split(",", 1)
                            import base64
                            background_bytes = base64.b64decode(encoded)
                            print(f"-> Loaded background image from base64 data URL in key '{bg_key}'")
                            break
                        except Exception as e:
                            print(f"Failed to decode base64 background: {e}")
                    elif val.startswith(("http://", "https://")):
                        try:
                            import httpx
                            print(f"-> Fetching background image from URL in key '{bg_key}': {val}")
                            r = httpx.get(val, timeout=30.0)
                            if r.status_code == 200:
                                background_bytes = r.content
                                break
                        except Exception as e:
                            print(f"Failed to fetch background from URL: {e}")
                    else:
                        try:
                            import os
                            if os.path.exists(val):
                                background_bytes = Path(val).read_bytes()
                                print(f"-> Loaded background image from local path in key '{bg_key}': {val}")
                                break
                        except Exception as e:
                            print(f"Failed to read local background file: {e}")

        # 3. Fallback to Gemini Image Generation if not provided in JSON
        if not avatar_bytes or not background_bytes:
            # Prepare prompts for whichever is missing
            avatar_future = None
            background_future = None
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                if not avatar_bytes:
                    avatar_future = executor.submit(generate_asset_image, avatar_prompt, "Avatar")
                if not background_bytes:
                    background_future = executor.submit(generate_asset_image, background_prompt, "Background")

                if avatar_future:
                    try:
                        avatar_bytes = avatar_future.result()
                    except Exception as e:
                        print(f"❌ Avatar generation failed: {e}")

                if background_future:
                    try:
                        background_bytes = background_future.result()
                    except Exception as e:
                        print(f"❌ Background generation failed: {e}")

        # Check critical asset
        if not avatar_bytes:
            raise HTTPException(status_code=500, detail="Gemini failed to generate the customer avatar asset.")

        # Persist to disk
        entry_id = uuid.uuid4().hex[:12]
        avatar_path = GENERATED_DIR / f"{entry_id}_avatar.png"
        avatar_path.write_bytes(avatar_bytes)

        if background_bytes:
            background_path = GENERATED_DIR / f"{entry_id}_background.png"
            background_path.write_bytes(background_bytes)

        # Build complete reconstruction metadata JSON
        bi = req.brandData.get("brandIdentity", {})
        personas = req.brandData.get("idealClientProfiles", [])
        persona = personas[req.personaIndex] if req.personaIndex < len(personas) else {}

        meta = {
            "id": entry_id,
            "brandName": bi.get("brandName", "Unknown"),
            "industry": bi.get("industry", ""),
            "personaName": persona.get("name", "Persona"),
            "personaLabel": persona.get("avatarLabel", ""),
            "age": str(persona.get("age", "")),
            "gender": persona.get("gender", ""),
            "mimeType": "image/png",
            "avatarFileName": f"{entry_id}_avatar.png",
            "backgroundFileName": f"{entry_id}_background.png" if background_bytes else None,
            "hasBackground": bool(background_bytes),
            "sizeBytes": len(avatar_bytes) + (len(background_bytes) if background_bytes else 0),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            # Save raw data for dynamic frontend HTML/CSS board reconstruction
            "brandData": req.brandData,
            "personaIndex": req.personaIndex,
            "creativeBrief": creative_brief,
        }

        meta_path = GENERATED_DIR / f"{entry_id}.json"
        meta_path.write_text(json.dumps(meta, indent=2))
        print(f"💾 Saved modular history files for ID: {entry_id}")

        avatar_b64 = base64.b64encode(avatar_bytes).decode("utf-8")
        background_b64 = base64.b64encode(background_bytes).decode("utf-8") if background_bytes else None

        return {
            "avatar": avatar_b64,
            "background": background_b64,
            "hasBackground": bool(background_bytes),
            "historyId": entry_id,
            "brandData": req.brandData,
            "personaIndex": req.personaIndex,
            "creativeBrief": creative_brief,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


# ──────────────────────────────────────────────────────────────
# HISTORY ENDPOINTS
# ──────────────────────────────────────────────────────────────

@app.get("/api/history")
async def list_history():
    """Return all previously generated persona boards, newest first."""
    items = []
    for meta_file in GENERATED_DIR.glob("*.json"):
        try:
            meta = json.loads(meta_file.read_text())
            items.append(meta)
        except Exception:
            continue
    # Sort newest first
    items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return {"items": items}


@app.get("/api/history/{entry_id}/image")
async def get_history_image(entry_id: str, type: str = "avatar"):
    """Serve individual generated assets (avatar, background)."""
    filename = f"{entry_id}_{type}.png"
    img_path = GENERATED_DIR / filename
    
    if img_path.exists():
        return FileResponse(img_path, media_type="image/png", filename=img_path.name)
        
    # Check fallback for older format
    if type == "board" or type == "avatar":
        for ext in ["png", "jpg", "jpeg", "webp"]:
            old_path = GENERATED_DIR / f"{entry_id}.{ext}"
            if old_path.exists():
                return FileResponse(old_path, media_type=f"image/{ext}", filename=old_path.name)
                
    raise HTTPException(status_code=404, detail=f"Image type '{type}' not found for entry {entry_id}")


@app.delete("/api/history/{entry_id}")
async def delete_history_entry(entry_id: str):
    """Delete a previously generated persona board."""
    meta_path = GENERATED_DIR / f"{entry_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Entry not found")

    # Delete all possible files
    for ext in ["png", "jpg", "jpeg", "webp"]:
        # New formats
        for suffix in ["_avatar", "_background"]:
            img_path = GENERATED_DIR / f"{entry_id}{suffix}.{ext}"
            if img_path.exists():
                img_path.unlink()
        # Old format
        old_path = GENERATED_DIR / f"{entry_id}.{ext}"
        if old_path.exists():
            old_path.unlink()

    # Delete metadata
    meta_path.unlink()
    return {"status": "deleted", "id": entry_id}


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "api_key_configured": bool(GEMINI_API_KEY),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
