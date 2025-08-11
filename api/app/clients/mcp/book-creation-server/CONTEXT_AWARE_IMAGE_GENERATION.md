# Context-Aware Image Generation for LibreChat Book Creation

## Overview

This implementation adds intelligent, context-aware image generation that automatically adapts the visual style based on the book's characteristics. The system analyzes genre, target audience, writing style, and theme to generate images that are contextually appropriate and avoid generating inappropriate content (e.g., romantic adult themes with children's book styles).

## Key Features

### 🎭 Automatic Style Detection
- **Genre Analysis**: Automatically maps genres to appropriate visual styles
- **Audience Targeting**: Ensures age-appropriate imagery based on target audience
- **Writing Style Consideration**: Takes into account tone, vocabulary level, and narrative voice
- **Theme Integration**: Adapts visual mood based on book themes

### 🎨 Style Mapping System
The system includes 10 predefined styles with specific use cases:

1. **children_book_illustration** - Bright, colorful, kid-friendly
2. **cartoon_colorful** - Vibrant cartoon-style illustrations  
3. **watercolor_soft** - Soft, artistic watercolor paintings
4. **realistic_artistic** - Detailed realistic illustrations
5. **fantasy_illustration** - Epic fantasy with magical elements
6. **noir_illustration** - Dark, moody atmosphere for mystery/thriller
7. **romantic_artistic** - Elegant romantic illustrations
8. **digital_art** - Modern digital art style
9. **anime_style** - Anime-inspired illustrations
10. **dark_artistic** - Dark, sophisticated art for mature themes

### 🛡️ Content Appropriateness
- **Age Rating System**: Each style has appropriate age ratings (all-ages, teen, adult, mature)
- **Content Filtering**: Analyzes image prompts for mature content and warns if style mismatch
- **Audience Warnings**: Alerts when selected style may not match target audience

### ⚙️ User Configuration
- **Personal Preferences**: Users can set default styles and overrides
- **Genre/Audience Overrides**: Custom style mappings for specific genres or audiences
- **Banned Styles**: Users can exclude certain styles they never want
- **Manual Selection**: Option to always prompt for style selection

## New MCP Tools

### 1. Enhanced `generate_contextual_image`
```json
{
  "bookId": "string",
  "chapterId": "string", 
  "prompt": "string",
  "style": "string (optional override)",
  "userStylePreference": "string (manual selection)",
  "forceUserPrompt": "boolean (force manual selection)",
  "userId": "string (for applying preferences)"
}
```

**New Behavior:**
- Automatically analyzes book context to determine appropriate style
- Returns style analysis with confidence scores and reasoning
- Prompts user for style selection when confidence is low
- Applies user preferences and configuration

### 2. `analyze_book_image_style`
```json
{
  "bookId": "string"
}
```

Analyzes a book's characteristics and returns:
- Recommended primary style
- Confidence level (0-100%)
- Audience appropriateness check
- Reasoning for style selection
- Style modifiers based on book specifications

### 3. `get_available_image_styles`
```json
{}
```

Returns all available styles with descriptions and age ratings.

### 4. `manage_user_style_preferences`
```json
{
  "userId": "string",
  "action": "get|update",
  "preferences": {
    "defaultStyle": "string",
    "forceManualSelection": "boolean",
    "genreOverrides": "object",
    "audienceOverrides": "object", 
    "bannedStyles": "array"
  }
}
```

Manages user-specific style preferences and overrides.

## Smart Decision Flow

### 1. Context Analysis
```
Book Characteristics → Style Analysis → Confidence Score
    ↓                       ↓              ↓
Genre, Audience,     →  Primary Style  →  0.0 - 1.0
Writing Style,          + Modifiers       (confidence)
Theme, Spec
```

### 2. Decision Logic
```
High Confidence (>0.5) → Auto-generate with detected style
Low Confidence (<0.5)  → Prompt user for style selection
User Preferences       → Apply overrides and filtering
Explicit Style Param  → Override all automatic detection
```

### 3. Safety Checks
```
Content Analysis → Age Appropriateness → Style Validation → Generation
     ↓                    ↓                    ↓
Mature Content    →  Target Audience   →  Final Style   →  DALL-E Prompt
Detection            Compatibility        Selection
```

## Example Use Cases

### Scenario 1: Children's Adventure Book
```
Book: "The Magic Forest Adventures"
Genre: "children's fantasy"
Audience: "ages 5-8"
Writing Style: simple vocabulary, humorous tone

→ Analysis: children_book_illustration (95% confidence)
→ Result: Bright, colorful cartoon-style illustrations
→ Safety: All-ages appropriate ✓
```

### Scenario 2: Adult Romance Novel
```
Book: "Midnight in Paris"
Genre: "contemporary romance" 
Audience: "adult"
Writing Style: sophisticated vocabulary, romantic tone

→ Analysis: romantic_artistic (85% confidence)
→ Result: Elegant, warm-toned artistic illustrations
→ Safety: Adult content appropriate ✓
```

### Scenario 3: Unclear Context
```
Book: "The Journey"
Genre: "fiction"
Audience: undefined
Writing Style: varied

→ Analysis: Low confidence (30%)
→ Result: Prompt user for style selection
→ Options: Present all appropriate styles with descriptions
```

## Configuration Options

### Environment Variables
```bash
IMAGE_STYLE_ENABLE_CONTEXT_ANALYSIS=true
IMAGE_STYLE_CONFIDENCE_THRESHOLD=0.5
IMAGE_STYLE_ENABLE_AUDIENCE_CHECKS=true
IMAGE_STYLE_ENABLE_CONTENT_FILTERING=true
IMAGE_STYLE_ALLOW_OVERRIDES=true
IMAGE_STYLE_ADMIN_RESTRICTED=dark_artistic,mature_content
```

### User Preferences Example
```json
{
  "userId": "user123",
  "defaultStyle": "watercolor_soft",
  "forceManualSelection": false,
  "genreOverrides": {
    "fantasy": "digital_art",
    "mystery": "noir_illustration"
  },
  "audienceOverrides": {
    "children": "children_book_illustration"
  },
  "bannedStyles": ["dark_artistic", "horror_style"]
}
```

## Implementation Benefits

### For Content Creators
- **Automatic Consistency**: Images automatically match book tone and audience
- **Reduced Decision Fatigue**: Smart defaults reduce the need for manual style selection
- **Safety Assurance**: Prevents inappropriate style/content combinations
- **Customization**: Personal preferences for consistent creative vision

### For Users/Readers
- **Age-Appropriate Content**: Visual content matches the intended audience
- **Coherent Experience**: Consistent visual style throughout the book
- **Quality Assurance**: Professional-looking results with appropriate styling

### For System Administrators
- **Content Moderation**: Built-in checks prevent inappropriate combinations
- **User Management**: Configurable preferences and restrictions
- **Analytics**: Detailed logging of style decisions and confidence levels
- **Flexibility**: Easy to add new styles and modify mappings

## Technical Architecture

### Services
1. **ImageStyleAnalyzer**: Core analysis logic and style mappings
2. **ImageStyleConfig**: User preferences and system configuration management  
3. **ImageService**: Enhanced image generation with context awareness
4. **ImageToolHandlers**: MCP tool implementations

### Key Components
- **Style Mapping Engine**: Maps book characteristics to appropriate styles
- **Confidence Scoring**: Evaluates certainty of style recommendations
- **Content Filter**: Analyzes prompts for age-appropriate content
- **Preference Engine**: Applies user-specific overrides and filtering
- **Configuration Manager**: Handles system-wide and user settings

This implementation ensures that image generation becomes more intelligent, safe, and contextually appropriate while maintaining flexibility for user customization and system administration.
