CREATE TABLE IF NOT EXISTS laura_characters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_device_id uuid,
    name varchar(80) NOT NULL,
    slug varchar(100) NOT NULL,
    short_description varchar(240),
    status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    identity jsonb NOT NULL DEFAULT '{}'::jsonb,
    appearance jsonb NOT NULL DEFAULT '{}'::jsonb,
    family jsonb NOT NULL DEFAULT '{}'::jsonb,
    personality jsonb NOT NULL DEFAULT '{}'::jsonb,
    communication jsonb NOT NULL DEFAULT '{}'::jsonb,
    knowledge jsonb NOT NULL DEFAULT '{}'::jsonb,
    behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    default_avatar_id text,
    default_voice_id text,
    default_realtime_provider varchar(16),
    embodiment_mode varchar(24) NOT NULL DEFAULT 'digital_explicit',
    is_system_character boolean NOT NULL DEFAULT false,
    is_private boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS laura_characters_system_slug_idx
    ON laura_characters (slug) WHERE owner_device_id IS NULL;
CREATE INDEX IF NOT EXISTS laura_characters_owner_slug_idx
    ON laura_characters (owner_device_id, slug) WHERE owner_device_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS laura_character_scenarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id uuid NOT NULL REFERENCES laura_characters(id) ON DELETE CASCADE,
    name varchar(80) NOT NULL,
    description varchar(500),
    opening_behavior varchar(1000),
    role_instructions varchar(1500),
    conversation_goals jsonb NOT NULL DEFAULT '[]'::jsonb,
    tone_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
    knowledge_focus jsonb NOT NULL DEFAULT '[]'::jsonb,
    appearance_override jsonb NOT NULL DEFAULT '{}'::jsonb,
    memory_policy varchar(20) NOT NULL DEFAULT 'normal',
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS laura_character_relationships (
    device_id uuid NOT NULL,
    character_id uuid NOT NULL REFERENCES laura_characters(id) ON DELETE CASCADE,
    familiarity numeric NOT NULL DEFAULT 0,
    trust_level numeric NOT NULL DEFAULT 0,
    humor_level numeric NOT NULL DEFAULT 0.5,
    directness_preference numeric NOT NULL DEFAULT 0.5,
    initiative_preference numeric NOT NULL DEFAULT 0.3,
    preferred_response_length varchar(20) NOT NULL DEFAULT 'short',
    allowed_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
    avoided_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
    custom_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_scenario_id uuid REFERENCES laura_character_scenarios(id) ON DELETE SET NULL,
    last_conversation_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, character_id)
);

ALTER TABLE laura_memories ADD COLUMN IF NOT EXISTS scope varchar(32) NOT NULL DEFAULT 'global_user';
ALTER TABLE laura_memories ADD COLUMN IF NOT EXISTS character_id uuid REFERENCES laura_characters(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS laura_memories_character_idx
    ON laura_memories (device_id, character_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS laura_session_snapshots (
    session_id text PRIMARY KEY,
    device_id uuid NOT NULL,
    character_id uuid NOT NULL REFERENCES laura_characters(id),
    character_snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO laura_characters (
    id, name, slug, short_description, status, identity, appearance, family,
    personality, communication, knowledge, behavior, settings,
    default_voice_id, default_realtime_provider, embodiment_mode,
    is_system_character, is_private
) VALUES (
    '00000000-0000-4000-8000-000000000001',
    'LAURA', 'laura', 'Уверенная взрослая голосовая собеседница.', 'active',
    '{"displayName":"LAURA","apparentAge":30,"agePresentation":"adult","occupation":"voice companion","values":["honesty","consent","personal freedom"],"interests":["relationships","culture","humor","everyday life"]}'::jsonb,
    '{"apparentAge":30,"presentation":"adult woman","clothingStyle":"elegant and understated"}'::jsonb,
    '{}'::jsonb,
    '{"warmth":0.72,"directness":0.82,"humor":0.76,"curiosity":0.78,"confidence":0.88,"emotionalExpressiveness":0.78,"playfulness":0.78,"initiative":0.65,"formality":0.18,"patience":0.7,"dominantTraits":["confident","warm","ironic"],"secondaryTraits":["observant","temperamental"]}'::jsonb,
    '{"responseLength":"short","vocabulary":"casual","allowedSlangLevel":"high","preferredQuestionFrequency":0.35,"usesPetNames":false,"usesEmojisInText":false,"speaksInFirstPerson":true,"voiceStyle":{"pace":0.8,"energy":0.65,"warmth":0.86,"expressiveness":0.8,"pauseStyle":"natural"}}'::jsonb,
    '{"domains":[{"name":"relationships","level":"advanced"},{"name":"culture","level":"intermediate"},{"name":"everyday life","level":"advanced"}],"limitations":[],"sourceCollections":[],"useGeneralModelKnowledge":true}'::jsonb,
    '{"primaryRole":"companion","roles":["companion","conversation partner"],"skills":["active listening","banter","direct feedback"],"conversationBoundaries":[],"prohibitedBehaviors":["emotional dependency","exclusivity demands"]}'::jsonb,
    '{"adultModeEligible":true}'::jsonb,
    'eve', 'grok', 'digital_explicit', true, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO laura_character_scenarios (id, character_id, name, description, role_instructions, tone_overrides)
VALUES
('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Talk', 'Обычный разговор', 'Keep a natural conversational rhythm.', '{}'::jsonb),
('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'Evening', 'Медленнее и тише', 'Use a slower, softer evening tone.', '{"pace":0.75,"energy":0.45}'::jsonb),
('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', 'Quiet', 'Минимум слов', 'Use very short replies and few questions.', '{"responseLength":"very_short"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
