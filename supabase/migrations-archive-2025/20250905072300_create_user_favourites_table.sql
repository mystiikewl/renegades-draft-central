-- Create user_favourites table
CREATE TABLE user_favourites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, player_id)
);

-- Enable Row Level Security
ALTER TABLE user_favourites ENABLE ROW LEVEL SECURITY;

-- Create a function to insert favourites with automatic user_id
CREATE OR REPLACE FUNCTION insert_user_favourite(target_player_id UUID)
RETURNS JSON AS $$
DECLARE
    inserted_row user_favourites;
BEGIN
    INSERT INTO user_favourites (user_id, player_id)
    VALUES (auth.uid(), target_player_id)
    RETURNING * INTO inserted_row;

    RETURN json_build_object('id', inserted_row.id, 'player_id', inserted_row.player_id, 'created_at', inserted_row.created_at);
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object('error', 'Player already in favourites');
    WHEN OTHERS THEN
        RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies
CREATE POLICY "Users can view their own favourites" ON user_favourites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favourites via function" ON user_favourites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favourites" ON user_favourites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favourites" ON user_favourites
  FOR DELETE USING (auth.uid() = user_id);